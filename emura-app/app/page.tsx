'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { saveState, defaultState, migrateState, STORE_KEY } from '@/lib/state';
import type { AppState, LibraryPart, LibraryEquipment, LibraryLaborRate, ReviewItem } from '@/lib/calculations';
import { resolvePrimaryIndices, calcCosts, computeCostDrivers, totalAnnualUnits } from '@/lib/calculations';
import { computeTabStatuses } from '@/lib/tabStatus';
import { createClient } from '@/lib/supabase';
import type { OrgContext } from '@/lib/db';
import { getMyOrgContext, listQuotes, loadQuote, createQuote, saveQuote, deleteQuote, saveRevision, loadQuoteRevision, searchQuotes, syncPartsToLibrary, syncEquipmentToLibrary, syncLaborRatesToLibrary, listLibraryParts, listLibraryEquipment, listLibraryLaborRates, pushPartToLibrary, pushEquipmentToLibrary } from '@/lib/db';
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
import RevisionCompare   from '@/components/RevisionCompare';
import TabErrorBoundary  from '@/components/TabErrorBoundary';
import UtilBar           from '@/components/mcx/UtilBar';
import RibbonStepper     from '@/components/mcx/RibbonStepper';

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

// Highest-volume break (fallback "lens" when no primary break is set).
function highestVolBreak(state: AppState): number {
  let idx = 0, best = -1;
  state.breaks.forEach((_, j) => {
    const u = totalAnnualUnits(state, j);
    if (u > best) { best = u; idx = j; }
  });
  return idx;
}

// Adaptive headline for the ribbon's Annual Cost read-out:
//   primary FG selected → per-unit cost; otherwise → aggregate annual cost.
function computeHeadline(state: AppState): { eyebrow: string; figure: string; unitSuffix?: string } {
  const { fgi, bki } = resolvePrimaryIndices(state);
  const fb = highestVolBreak(state);
  if (fgi >= 0) {
    const useBki = bki >= 0 ? bki : fb;
    const c = calcCosts(state, fgi, useBki);
    const perUnit = c ? c.total : 0;
    const fgName = state.finishedGoods[fgi]?.name?.trim() || 'FG';
    const brk = state.breaks[useBki]?.label?.trim();
    return {
      eyebrow: `$/Unit · ${fgName}${brk ? ' · ' + brk : ''}`,
      figure: perUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      unitSuffix: '/unit',
    };
  }
  const drivers = computeCostDrivers(state, fb);
  const total = drivers ? drivers.totalAnnual : 0;
  const brk = state.breaks[fb]?.label?.trim();
  return {
    eyebrow: `Annual Cost${brk ? ' · ' + brk : ''}`,
    figure: Math.round(total).toLocaleString(),
  };
}

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
  const [compareOpen, setCompareOpen]   = useState(false);
  const [saveStatus, setSaveStatus]           = useState('Saved');
  const [loaded, setLoaded]                   = useState(false);
  const [libraryParts, setLibraryParts]       = useState<LibraryPart[]>([]);
  const [libraryEquipment, setLibraryEquip]   = useState<LibraryEquipment[]>([]);
  const [libraryLaborRates, setLibraryLaborRates] = useState<LibraryLaborRate[]>([]);

  const [emailMap, setEmailMap] = useState<Record<string, string>>({});

  // Quote status indicators
  const [statusCache, setStatusCache] = useState<Record<string, QuoteStatusEntry | 'loading'>>({});
  const loadGenRef = useRef(0);

  // Advanced content search (server-side over all org quotes)
  const [contentMatchIds, setContentMatchIds] = useState<string[] | null>(null);
  const [contentSearching, setContentSearching] = useState(false);

  // Debounce timer for cloud saves
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs so cloudSave (useCallback with [] deps) always sees current values
  const orgCtxRef  = useRef<OrgContext | null>(null);
  const userIdRef  = useRef<string>('');

  const supabase = useMemo(() => createClient(), []);

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
      // Invalidate this quote's cached status dot + est. cost so it recomputes
      // when the list is next viewed (it goes stale after an edit otherwise).
      setStatusCache(prev => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
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
        e => e.annualQty >= 0 && e.cost > 0,
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

  async function handleContentSearch(term: string) {
    if (!term.trim()) { setContentMatchIds(null); return; }
    setContentSearching(true);
    const ids = await searchQuotes(supabase, term);
    setContentMatchIds(ids);
    setContentSearching(false);
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
      } catch {
        // Non-blocking feedback via the existing save-status channel (no pop-up,
        // per the no-warnings design principle). Reverts after a few seconds.
        setSaveStatus('Import failed — invalid file');
        setTimeout(() => setSaveStatus('Saved'), 3000);
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem(STORE_KEY);
    window.location.href = '/login';
  }

  // ── Derived header data (live, synchronous) ──────────────────

  const tabStatuses = useMemo(() => appState ? computeTabStatuses(appState) : [], [appState]);
  const headline    = useMemo(() => appState ? computeHeadline(appState) : { eyebrow: '', figure: '0' }, [appState]);

  // Keyboard shortcuts: ⌘S save revision, ⌘Z / ⌘⇧Z undo/redo (app-level only
  // when not editing a text field, so native input undo still works).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || !quoteId || !appState) return;
      const k = e.key.toLowerCase();
      const el = document.activeElement as HTMLElement | null;
      const editing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (k === 's') { e.preventDefault(); handleSaveRevision(); }
      else if (k === 'z' && !editing) { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, appState, history, future]);

  // ── Render ───────────────────────────────────────────────────

  // Still bootstrapping — show nothing to avoid any flash
  if (!loaded) return null;

  // No org row found — trigger didn't fire or user confirmed email before trigger was created
  if (orgCtx === null) {
    return (
      <div className="mcx" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 12 }}>
        <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>No organization found for your account.</p>
        <p style={{ color: 'var(--ink-4)', fontSize: 12, maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
          This can happen if your account was created before the setup was complete.
          Please sign out and create a new account, or contact your administrator.
        </p>
        <button className="mcx-btn is-primary" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    );
  }

  const canEdit = orgCtx.role === 'admin' || orgCtx.role === 'estimator';

  function renderTab() {
    const tabProps = {
      state: appState!,
      onUpdate: canEdit ? handleUpdate : () => {},
      resetKey,
    };
    switch (currentTab) {
      case 'info':       return <TabErrorBoundary tabName={currentTab}><QuoteInfoTab     {...tabProps} libraryParts={libraryParts} libraryEquipment={libraryEquipment} onPushToLibrary={canEdit ? handlePushToLibrary : undefined} /></TabErrorBoundary>;
      case 'fgs':        return <TabErrorBoundary tabName={currentTab}><FinishedGoodsTab {...tabProps} /></TabErrorBoundary>;
      case 'bom':        return <TabErrorBoundary tabName={currentTab}><BOMTab           {...tabProps} libraryParts={libraryParts} /></TabErrorBoundary>;
      case 'matcost':    return <TabErrorBoundary tabName={currentTab}><MaterialCostsTab {...tabProps} /></TabErrorBoundary>;
      case 'equip':      return <TabErrorBoundary tabName={currentTab}><EquipmentTab     {...tabProps} libraryEquipment={libraryEquipment} /></TabErrorBoundary>;
      case 'ops':        return <TabErrorBoundary tabName={currentTab}><OperationsTab    {...tabProps} libraryLaborRates={libraryLaborRates} /></TabErrorBoundary>;
      case 'summary':    return <TabErrorBoundary tabName={currentTab}><SummaryTab       {...tabProps} /></TabErrorBoundary>;
      case 'mfgsummary': return <TabErrorBoundary tabName={currentTab}><MfgSummaryTab    {...tabProps} /></TabErrorBoundary>;
      default:           return <TabErrorBoundary tabName={currentTab}><QuoteInfoTab     {...tabProps} libraryParts={libraryParts} libraryEquipment={libraryEquipment} /></TabErrorBoundary>;
    }
  }

  const tabIndex = TABS.findIndex(t => t.id === currentTab);

  return (
    <div id="app" className="mcx mcx-app">
      {quoteId && appState ? (
        /* ── Quote editor view ── */
        <>
          <UtilBar
            mode="editor"
            quoteName={appState.quote.name}
            revision={appState.quote.revision}
            saveStatus={saveStatus}
            isAdmin={orgCtx.role === 'admin'}
            canEdit={canEdit}
            canUndo={history.length > 0}
            canRedo={future.length > 0}
            onBack={handleBackToList}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onCompare={() => setCompareOpen(true)}
            onExport={handleExport}
            onImport={handleImport}
            onSaveRevision={handleSaveRevision}
            onSettings={() => setAdminOpen(true)}
            onLogout={handleLogout}
          />
          <RibbonStepper
            tabs={TABS}
            statuses={tabStatuses}
            current={tabIndex < 0 ? 0 : tabIndex}
            onNavigate={i => setCurrentTab(TABS[i].id)}
            annual={headline}
          />
          {/* hidden mirror of save status for QA/back-compat */}
          <span id="save-status" style={{ display: 'none' }}>{saveStatus}</span>
          <main className="mcx-page" style={{ flex: 1, overflowX: 'auto' }}>
            {renderTab()}
          </main>
        </>
      ) : (
        /* ── Quote list view ── */
        <>
          <UtilBar
            mode="list"
            isAdmin={orgCtx.role === 'admin'}
            canEdit={canEdit}
            onNew={handleNew}
            onSettings={() => setAdminOpen(true)}
            onLogout={handleLogout}
          />
          <main className="mcx-page" style={{ flex: 1, overflowX: 'auto' }}>
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
              contentMatchIds={contentMatchIds}
              contentSearching={contentSearching}
              onContentSearch={handleContentSearch}
            />
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

      {compareOpen && quoteId && appState && (
        <RevisionCompare
          workingDraft={appState}
          revisions={quotes.find(q => q.id === quoteId)?.revisions ?? []}
          loadRevision={revId => loadQuoteRevision(supabase, revId)}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}
