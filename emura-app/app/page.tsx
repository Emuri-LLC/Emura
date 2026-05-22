'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { saveState, defaultState, migrateState, STORE_KEY } from '@/lib/state';
import type { AppState, LibraryPart, LibraryEquipment } from '@/lib/calculations';
import { createClient } from '@/lib/supabase';
import type { OrgContext } from '@/lib/db';
import { getMyOrgContext, listQuotes, loadQuote, createQuote, saveQuote, deleteQuote, syncPartsToLibrary, listLibraryParts, listLibraryEquipment } from '@/lib/db';
import type { QuoteSummary } from '@/lib/db';

import QuoteInfoTab      from '@/components/tabs/QuoteInfoTab';
import FinishedGoodsTab  from '@/components/tabs/FinishedGoodsTab';
import BOMTab            from '@/components/tabs/BOMTab';
import MaterialCostsTab  from '@/components/tabs/MaterialCostsTab';
import EquipmentTab      from '@/components/tabs/EquipmentTab';
import OperationsTab     from '@/components/tabs/OperationsTab';
import SummaryTab        from '@/components/tabs/SummaryTab';
import QuotesList        from '@/components/QuotesList';
import AdminDrawer       from '@/components/AdminDrawer';

const TABS = [
  { id: 'info',    label: 'Quote Info'        },
  { id: 'fgs',     label: 'Finished Goods'    },
  { id: 'bom',     label: 'Bill of Materials' },
  { id: 'matcost', label: 'Material Costs'    },
  { id: 'equip',   label: 'Equipment'         },
  { id: 'ops',     label: 'Operations'        },
  { id: 'summary', label: 'Summary'           },
];

export default function Home() {
  const [appState, setAppState]       = useState<AppState | null>(null);
  const [quoteId, setQuoteId]         = useState<string | null>(null);
  const [orgCtx, setOrgCtx]           = useState<OrgContext | null>(null);
  const [quotes, setQuotes]           = useState<QuoteSummary[]>([]);
  const [userId, setUserId]           = useState('');
  const [currentTab, setCurrentTab]   = useState('info');
  const [history, setHistory]         = useState<AppState[]>([]);
  const [resetKey, setResetKey]       = useState(0);
  const [adminOpen, setAdminOpen]     = useState(false);
  const [saveStatus, setSaveStatus]         = useState('Saved');
  const [loaded, setLoaded]                 = useState(false);
  const [libraryParts, setLibraryParts]     = useState<LibraryPart[]>([]);
  const [libraryEquipment, setLibraryEquip] = useState<LibraryEquipment[]>([]);

  // Debounce timer for cloud saves
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so cloudSave (useCallback with [] deps) always sees current orgCtx
  const orgCtxRef  = useRef<OrgContext | null>(null);

  const supabase = createClient();

  // ── Bootstrap ───────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const ctx = await getMyOrgContext(supabase);
      setOrgCtx(ctx);
      orgCtxRef.current = ctx;

      if (ctx) {
        const [qs, lp, le] = await Promise.all([
          listQuotes(supabase),
          listLibraryParts(supabase),
          listLibraryEquipment(supabase),
        ]);
        setQuotes(qs);
        setLibraryParts(lp);
        setLibraryEquip(le);
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
          ? { ...q, name: state.quote.name || 'New Quote', customer: state.quote.customer || '', updatedAt: new Date().toISOString() }
          : q
      ));
      const ctx = orgCtxRef.current;
      if (ctx) {
        await syncPartsToLibrary(supabase, ctx.orgId, state);
        const lp = await listLibraryParts(supabase);
        setLibraryParts(lp);
      }
      setSaveStatus('Saved');
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ────────────────────────────────────────────────

  function handleUpdate(newState: AppState) {
    setHistory(prev => [...prev.slice(-39), appState!]);
    setAppState(newState);
    saveState(newState);                           // localStorage cache
    if (quoteId) cloudSave(quoteId, newState);    // cloud save (debounced)
  }

  function handleUndo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setAppState(prev);
    saveState(prev);
    if (quoteId) cloudSave(quoteId, prev);
    setResetKey(k => k + 1);
  }

  async function handleNew() {
    if (!orgCtx?.departmentId) return;
    const fresh = defaultState();
    // Don't push null into history when creating from the list (appState is null there);
    // that would make history.length===1 and enable undo with nothing to revert to.
    if (appState !== null) setHistory(prev => [...prev.slice(-39), appState]);
    else setHistory([]);
    const id = await createQuote(supabase, fresh, orgCtx.departmentId);
    if (!id) return;
    setQuoteId(id);
    setAppState(fresh);
    saveState(fresh);
    setResetKey(k => k + 1);
    setQuotes(prev => [{
      id,
      name:      fresh.quote.name,
      customer:  fresh.quote.customer,
      updatedAt: new Date().toISOString(),
      createdBy: userId,
    }, ...prev]);
  }

  async function handleOpenQuote(id: string) {
    const state = await loadQuote(supabase, id);
    if (!state) return;
    setHistory([]);
    setQuoteId(id);
    setAppState(state);
    saveState(state);
    setResetKey(k => k + 1);
  }

  function handleBackToList() {
    setQuoteId(null);
    setAppState(null);
    setHistory([]);
  }

  async function handleDeleteQuote(id: string) {
    await deleteQuote(supabase, id);
    setQuotes(prev => prev.filter(q => q.id !== id));
    if (quoteId === id) handleBackToList();
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
      case 'info':    return <QuoteInfoTab     {...sharedProps} libraryParts={libraryParts} libraryEquipment={libraryEquipment} />;
      case 'fgs':     return <FinishedGoodsTab {...sharedProps} />;
      case 'bom':     return <BOMTab           {...sharedProps} />;
      case 'matcost': return <MaterialCostsTab {...sharedProps} />;
      case 'equip':   return <EquipmentTab     {...sharedProps} />;
      case 'ops':     return <OperationsTab    {...sharedProps} />;
      case 'summary': return <SummaryTab       {...sharedProps} />;
      default:        return <QuoteInfoTab     {...sharedProps} />;
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
              <button className="btn btn-undo btn-sm"
                onClick={handleUndo} disabled={history.length === 0}>
                &#8630; Undo
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
            onOpen={handleOpenQuote}
            onNew={handleNew}
            onDelete={handleDeleteQuote}
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
                  case 'info':    return <QuoteInfoTab     {...viewProps} libraryParts={libraryParts} libraryEquipment={libraryEquipment} />;
                  case 'fgs':     return <FinishedGoodsTab {...viewProps} />;
                  case 'bom':     return <BOMTab           {...viewProps} />;
                  case 'matcost': return <MaterialCostsTab {...viewProps} />;
                  case 'equip':   return <EquipmentTab     {...viewProps} />;
                  case 'ops':     return <OperationsTab    {...viewProps} />;
                  case 'summary': return <SummaryTab       {...viewProps} />;
                  default:        return <QuoteInfoTab     {...viewProps} />;
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
          onOrgRenamed={name => setOrgCtx(prev => prev ? { ...prev, orgName: name } : prev)}
        />
      )}
    </div>
  );
}
