'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { saveState, defaultState, migrateState, STORE_KEY } from '@/lib/state';
import type { AppState, LibraryPart, LibraryEquipment, LibraryLaborRate, ReviewItem } from '@/lib/calculations';
import { createClient } from '@/lib/supabase';
import type { OrgContext } from '@/lib/db';
import { getMyOrgContext, listQuotes, loadQuote, createQuote, saveQuote, deleteQuote, saveRevision, loadQuoteRevision, syncPartsToLibrary, syncEquipmentToLibrary, syncLaborRatesToLibrary, listLibraryParts, listLibraryEquipment, listLibraryLaborRates, pushPartToLibrary, pushEquipmentToLibrary } from '@/lib/db';
import { QUOTE_STATUS_ENABLED, computeStatusEntry } from '@/lib/quoteStatus';
import type { QuoteStatusEntry } from '@/lib/quoteStatus';
import type { QuoteSummary } from '@/lib/db';

import QuoteInfoTab      from '@/components/tabs/QuoteInfoTab';
import FinishedGoodsTab  from '@/components/tabs/FinishedGoodsTab';
import BOMTab            from '@/components/tabs/BOMTab';
import MaterialCostsTab  from '@/components/tabs/MaterialCostsTab';
import EquipmentTab      from '@/components/tabs/EquipmentTab';
import OperationsTab     from '@/components/tabs/OperationsTab';
import SummaryTab        from '@/components/tabs/SummaryTab';
import MfgSummaryTab     from '@/components/tabs/MfgSummaryTab';
import QuotesList        from '@/components/QuotesList';
import AdminDrawer       from '@/components/AdminDrawer';

const TABS = [
  { id: 'info',       label: 'Quote Info'        },
  { id: 'fgs',        label: 'Finished Goods'    },
  { id: 'bom',        label: 'Bill of Materials' },
  { id: 'matcost',    label: 'Material Costs'    },
  { id: 'equip',      label: 'Equipment'         },
  { id: 'ops',        label: 'Operations'        },
  { id: 'summary',    label: 'Summary'           },
  { id: 'mfgsummary', label: 'Mfg Summary'       },
];

export default function Home() {
  const [appState, setAppState]       = useState<AppState | null>(null);
  const [quoteId, setQuoteId]         = useState<string | null>(null);
  const [orgCtx, setOrgCtx]           = useState<OrgContext | null>(null);
  const [quotes, setQuotes]           = useState<QuoteSummary[]>([]);
  const [userId, setUserId]           = useState('');
  const [currentTab, setCurrentTab]     = useState('info');
  const [history, setHistory]           = useState<AppState[]>([]);
  const [future, setFuture]             = useState<AppState[]>([]);
  const [pendingRevClear, setPendingRevClear] = useState(false);
  const [resetKey, setResetKey]         = useState(0);
  const [adminOpen, setAdminOpen]       = useState(false);
  const [saveStatus, setSaveStatus]           = useState('Saved');
  const [loaded, setLoaded]                   = useState(false);
  const [libraryParts, setLibraryParts]       = useState<LibraryPart[]>([]);
  const [libraryEquipment, setLibraryEquip]   = useState<LibraryEquipment[]>([]);
  const [libraryLaborRates, setLibraryLaborRates] = useState<LibraryLaborRate[]>([]);

  const [emailMap, setEmailMap] = useState<Record<string, string>>({});

  // Quote status indicators
  const [statusCache, setStatusCache] = useState<Record<string, QuoteStatusEntry | 'loading'>>({});
  const loadGenRef = useRef(0);

  // Debounce timer for cloud saves
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs so cloudSave (useCallback with [] deps) always sees current values
  const orgCtxRef  = useRef<OrgContext | null>(null);
  const userIdRef  = useRef<string>('');

  const supabase = createClient();

  // ── Bootstrap ───────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { setUserId(user.id); userIdRef.current = user.id; }

      const ctx = await getMyOrgContext(supabase);
      setOrgCtx(ctx);
      orgCtxRef.current = ctx;

      if (ctx) {
        const [qs, lp, le, llr, emailsResult] = await Promise.all([
          listQuotes(supabase),
          listLibraryParts(supabase),
          listLibraryEquipment(supabase),
          listLibraryLaborRates(supabase),
          supabase.rpc('get_org_member_emails', { p_org_id: ctx.orgId }),
        ]);
        setQuotes(qs);
        setLibraryParts(lp);
        setLibraryEquip(le);
        setLibraryLaborRates(llr);
        if (emailsResult.data) {
          const map: Record<string, string> = {};
          (emailsResult.data as { user_id: string; email: string }[]).forEach(r => {
            map[r.user_id] = r.email;
          });
          setEmailMap(map);
        }
      }

      setLoaded(true);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cloud save (debounced) ───────────────────────────────────

  const cloudSave = useCallback((id: string, state: AppState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('Saving…');
    saveTimer.current = setTimeout(async () => {
      await saveQuote(supabase, id, state);
      setQuotes(prev => prev.map(q =>
        q.id === id
          ? { ...q, name: state.quote.name || 'New Quote', customer: state.quote.customer || '', updatedAt: new Date().toISOString(), lastUpdatedBy: userIdRef.current }
          : q
      ));
      const ctx = orgCtxRef.current;
      if (ctx) {
        await Promise.all([
          syncPartsToLibrary(supabase, ctx.orgId, id, state),
          syncEquipmentToLibrary(supabase, ctx.orgId, id, state),
          syncLaborRatesToLibrary(supabase, ctx.orgId, id, state),
        ]);
        const [lp, le, llr] = await Promise.all([
          listLibraryParts(supabase),
          listLibraryEquipment(supabase),
          listLibraryLaborRates(supabase),
        ]);
        setLibraryParts(lp);
        setLibraryEquip(le);
        setLibraryLaborRates(llr);
      }
      setSaveStatus('Saved');
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ────────────────────────────────────────────────

  function handleUpdate(newState: AppState) {
    // On first edit after saving a revision, clear the revision note
    if (pendingRevClear) {
      newState = { ...newState, quote: { ...newState.quote, revision: '' } };
      setPendingRevClear(false);
    }
    setHistory(prev => [...prev.slice(-39), appState!]);
    setFuture([]);  // clear redo stack on new action
    setAppState(newState);
    saveState(newState);                           // localStorage cache
    if (quoteId) cloudSave(quoteId, newState);    // cloud save (debounced)
  }

  function handleUndo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setFuture(f => [...f.slice(-39), appState!]); // push current to redo stack
    setHistory(h => h.slice(0, -1));
    setAppState(prev);
    saveState(prev);
    if (quoteId) cloudSave(quoteId, prev);
    setResetKey(k => k + 1);
  }

  function handleRedo() {
    if (!future.length) return;
    const next = future[future.length - 1];
    setHistory(h => [...h.slice(-39), appState!]); // push current to undo stack
    setFuture(f => f.slice(0, -1));
    setAppState(next);
    saveState(next);
    if (quoteId) cloudSave(quoteId, next);
    setResetKey(k => k + 1);
  }

  async function handleNew() {
    if (!orgCtx?.departmentId) return;
    const fresh = defaultState();
    if (appState !== null) setHistory(prev => [...prev.slice(-39), appState]);
    else setHistory([]);
    setFuture([]);
    const result = await createQuote(supabase, fresh, orgCtx.departmentId);
    if (!result) return;
    const { id, quoteNumber } = result;
    setQuoteId(id);
    setAppState(fresh);
    saveState(fresh);
    setResetKey(k => k + 1);
    setQuotes(prev => [{
      id,
      name:          fresh.quote.name,
      customer:      fresh.quote.customer,
      updatedAt:     new Date().toISOString(),
      createdBy:     userId,
      lastUpdatedBy: userId,
      quoteNumber,
      revisions:     [],
    }, ...prev]);
  }

  async function handleOpenQuote(id: string, revisionId?: string) {
    const state = revisionId
      ? await loadQuoteRevision(supabase, revisionId)
      : await loadQuote(supabase, id);
    if (!state) return;
    setHistory([]);
    setFuture([]);
    setPendingRevClear(false);
    setQuoteId(id);
    setAppState(state);
    saveState(state);
    setResetKey(k => k + 1);
  }

  function handleBackToList() {
    setQuoteId(null);
    setAppState(null);
    setHistory([]);
    setFuture([]);
    setPendingRevClear(false);
  }

  async function handleSaveRevision() {
    if (!quoteId || !appState || !canEdit) return;
    setSaveStatus('Saving revision…');
    const rev = await saveRevision(supabase, quoteId, appState);
    if (rev) {
      setQuotes(prev => prev.map(q =>
        q.id === quoteId
          ? { ...q, revisions: [rev, ...q.revisions.filter(r => r.id !== rev.id)].sort((a, b) => b.revNumber - a.revNumber) }
          : q
      ));
      setPendingRevClear(true); // clear revision note on next edit
      setSaveStatus(`Rev ${rev.revNumber} saved`);
      setTimeout(() => setSaveStatus('Saved'), 2000);
    } else {
      setSaveStatus('Save failed');
      setTimeout(() => setSaveStatus('Saved'), 2000);
    }
  }

  async function handleDeleteQuote(id: string) {
    await deleteQuote(supabase, id);
    setQuotes(prev => prev.filter(q => q.id !== id));
    if (quoteId === id) handleBackToList();
  }

  async function handlePushToLibrary(item: ReviewItem) {
    const ctx = orgCtxRef.current;
    if (!ctx || !appState) return;
    if (item.kind === 'part') {
      const bomItem = appState.bom.find(
        b => b.partNumber.trim().toLowerCase() === item.itemName.trim().toLowerCase(),
      );
      if (!bomItem) return;
      const entries = (appState.materialCosts[bomItem.id] ?? []).filter(
        e => e.annualQty > 0 && e.cost > 0,
      );
      await pushPartToLibrary(supabase, ctx.orgId, bomItem.partNumber, bomItem.description, bomItem.uom, entries);
    } else {
      const eq = appState.equipment.find(
        e => e.name.trim().toLowerCase() === item.itemName.trim().toLowerCase(),
      );
      if (!eq) return;
      await pushEquipmentToLibrary(supabase, ctx.orgId, eq.name, eq.capex, eq.hourlyRunCost, eq.annualMaintenance);
    }
    const [lp, le] = await Promise.all([listLibraryParts(supabase), listLibraryEquipment(supabase)]);
    setLibraryParts(lp);
    setLibraryEquip(le);
  }

  async function handleVisibleIdsChange(ids: string[]) {
    if (!QUOTE_STATUS_ENABLED) return;
    const gen = ++loadGenRef.current;
    const toLoad = ids.filter(id => !statusCache[id]);
    if (!toLoad.length) return;

    setStatusCache(prev => {
      const patch: Record<string, 'loading'> = {};
      for (const id of toLoad) patch[id] = 'loading';
      return { ...prev, ...patch };
    });

    await Promise.all(toLoad.map(async id => {
      const state = await loadQuote(supabase, id);
      if (!state || loadGenRef.current !== gen) return;
      const entry = computeStatusEntry(state, libraryParts, libraryEquipment);
      setStatusCache(prev => ({ ...prev, [id]: entry }));
    }));
  }

  function handleExport() {
    if (!appState) return;
    const a = document.createElement('a');
    a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(appState, null, 2));
    a.download = (appState.quote.name || 'quote').replace(/[^a-z0-9_-]/gi, '_') + '.json';
    a.click();
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = migrateState(JSON.parse(ev.target?.result as string));
        setHistory(prev => [...prev.slice(-39), appState!]);
        setFuture([]);
        setAppState(imported);
        saveState(imported);
        if (quoteId) cloudSave(quoteId, imported);
        setResetKey(k => k + 1);
      } catch { /* invalid file */ }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem(STORE_KEY);
    window.location.href = '/login';
  }

  // ── Render ───────────────────────────────────────────────────

  // Still bootstrapping — show nothing to avoid any flash
  if (!loaded) return null;

  // No org row found — trigger didn't fire or user confirmed email before trigger was created
  if (orgCtx === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#eef0f4', gap: 12 }}>
        <p style={{ color: '#555', fontSize: 14 }}>No organization found for your account.</p>
        <p style={{ color: '#888', fontSize: 12, maxWidth: 320, textAlign: 'center' }}>
          This can happen if your account was created before the setup was complete.
          Please sign out and create a new account, or contact your administrator.
        </p>
        <button
          onClick={handleLogout}
          style={{ padding: '8px 20px', background: '#1a2940', color: '#fff', border: 'none', borderRadius: 3, fontSize: 13, cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  const canEdit = orgCtx.role === 'admin' || orgCtx.role === 'estimator';

  const sharedProps = { state: appState!, onUpdate: handleUpdate, resetKey };

  function renderTab() {
    switch (currentTab) {
      case 'info':       return <QuoteInfoTab     {...sharedProps} libraryParts={libraryParts} libraryEquipment={libraryEquipment} onPushToLibrary={handlePushToLibrary} />;
      case 'fgs':        return <FinishedGoodsTab {...sharedProps} />;
      case 'bom':        return <BOMTab           {...sharedProps} libraryParts={libraryParts} />;
      case 'matcost':    return <MaterialCostsTab {...sharedProps} />;
      case 'equip':      return <EquipmentTab     {...sharedProps} libraryEquipment={libraryEquipment} />;
      case 'ops':        return <OperationsTab    {...sharedProps} libraryLaborRates={libraryLaborRates} />;
      case 'summary':    return <SummaryTab       {...sharedProps} />;
      case 'mfgsummary': return <MfgSummaryTab    {...sharedProps} />;
      default:           return <QuoteInfoTab     {...sharedProps} />;
    }
  }

  return (
    <div id="app">
      <header>
        <h1>
          {quoteId && (
            <button
              onClick={handleBackToList}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6',
                fontSize: 13, fontWeight: 600, marginRight: 10, padding: 0 }}
              title="Back to quotes list"
            >
              ← Quotes
            </button>
          )}
          &#9883; Manufacturing Cost Estimator
        </h1>
        <div className="hdr-r">
          <span id="save-status">{quoteId ? saveStatus : ''}</span>

          {orgCtx.role === 'admin' && (
            <button className="btn btn-neu btn-sm" onClick={() => setAdminOpen(true)} title="Settings">⚙</button>
          )}

          <button className="btn btn-neu btn-sm" onClick={handleLogout}>Logout</button>

          {quoteId && appState && (
            <>
              {canEdit && (
                <button className="btn btn-add btn-sm" onClick={handleSaveRevision}>
                  Save Revision
                </button>
              )}
              <button className="btn btn-undo btn-sm"
                onClick={handleUndo} disabled={history.length === 0}>
                &#8630; Undo
              </button>
              <button className="btn btn-redo btn-sm"
                onClick={handleRedo} disabled={future.length === 0}>
                Redo &#8631;
              </button>
              <button className="btn btn-neu btn-sm" onClick={handleExport}>Export</button>
              <label className="btn btn-neu btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                Import
                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
              </label>
            </>
          )}

          {!quoteId && canEdit && (
            <button className="btn btn-add btn-sm" onClick={handleNew}>+ New Quote</button>
          )}
        </div>
      </header>

      {/* Quote list view */}
      {!quoteId && (
        <main style={{ padding: '14px 16px', flex: 1, overflowX: 'auto' }}>
          <QuotesList
            quotes={quotes}
            userId={userId}
            role={orgCtx.role}
            emailMap={emailMap}
            onOpen={handleOpenQuote}
            onNew={handleNew}
            onDelete={handleDeleteQuote}
            statusCache={statusCache}
            onVisibleIdsChange={handleVisibleIdsChange}
          />
        </main>
      )}

      {/* Quote editor view */}
      {quoteId && appState && (
        <>
          <nav id="tabs">
            {TABS.map(tab => (
              <button key={tab.id}
                className={`tab-btn${currentTab === tab.id ? ' active' : ''}`}
                onClick={() => setCurrentTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </nav>
          <main style={{ padding: '14px 16px', flex: 1, overflowX: 'auto' }}>
            {canEdit ? renderTab() : (
              // Viewer: render tab but onUpdate is a no-op
              (() => {
                const viewProps = { state: appState, onUpdate: () => {}, resetKey };
                switch (currentTab) {
                  case 'info':       return <QuoteInfoTab     {...viewProps} libraryParts={libraryParts} libraryEquipment={libraryEquipment} />;
                  case 'fgs':        return <FinishedGoodsTab {...viewProps} />;
                  case 'bom':        return <BOMTab           {...viewProps} libraryParts={libraryParts} />;
                  case 'matcost':    return <MaterialCostsTab {...viewProps} />;
                  case 'equip':      return <EquipmentTab     {...viewProps} libraryEquipment={libraryEquipment} />;
                  case 'ops':        return <OperationsTab    {...viewProps} libraryLaborRates={libraryLaborRates} />;
                  case 'summary':    return <SummaryTab       {...viewProps} />;
                  case 'mfgsummary': return <MfgSummaryTab    {...viewProps} />;
                  default:           return <QuoteInfoTab     {...viewProps} />;
                }
              })()
            )}
          </main>
        </>
      )}

      {adminOpen && (
        <AdminDrawer
          open={adminOpen}
          onClose={() => setAdminOpen(false)}
          orgCtx={orgCtx}
          currentUserId={userId}
          onOrgRenamed={name => setOrgCtx(prev => prev ? { ...prev, orgName: name } : prev)}
        />
      )}
    </div>
  );
}
