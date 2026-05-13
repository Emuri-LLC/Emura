'use client';

import { useState, useEffect } from 'react';
import { loadState, saveState, defaultState } from '@/lib/state';
import type { AppState } from '@/lib/calculations';

import QuoteInfoTab      from '@/components/tabs/QuoteInfoTab';
import FinishedGoodsTab  from '@/components/tabs/FinishedGoodsTab';
import BOMTab            from '@/components/tabs/BOMTab';
import MaterialCostsTab  from '@/components/tabs/MaterialCostsTab';
import EquipmentTab      from '@/components/tabs/EquipmentTab';
import OperationsTab     from '@/components/tabs/OperationsTab';
import SummaryTab        from '@/components/tabs/SummaryTab';

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
  const [appState, setAppState]     = useState<AppState | null>(null);
  const [currentTab, setCurrentTab] = useState('info');
  const [history, setHistory]       = useState<AppState[]>([]);
  // Incrementing this key forces tabs with uncontrolled inputs to remount
  // and pick up fresh defaultValues after undo / import / new.
  const [resetKey, setResetKey]     = useState(0);

  useEffect(() => { setAppState(loadState()); }, []);

  function handleUpdate(newState: AppState) {
    setHistory(prev => [...prev.slice(-39), appState!]);
    setAppState(newState);
    saveState(newState);
  }

  function handleUndo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setAppState(prev);
    saveState(prev);
    setResetKey(k => k + 1);
  }

  function handleNew() {
    const fresh = defaultState();
    setHistory(prev => [...prev.slice(-39), appState!]);
    setAppState(fresh);
    saveState(fresh);
    setResetKey(k => k + 1);
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
        const imported = JSON.parse(ev.target?.result as string) as AppState;
        setHistory(prev => [...prev.slice(-39), appState!]);
        setAppState(imported);
        saveState(imported);
        setResetKey(k => k + 1);
      } catch { /* invalid file */ }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  if (!appState) return null;

  const sharedProps = { state: appState, onUpdate: handleUpdate, resetKey };

  function renderTab() {
    switch (currentTab) {
      case 'info':    return <QuoteInfoTab     {...sharedProps} />;
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
        <h1>&#9883; Manufacturing Cost Estimator</h1>
        <div className="hdr-r">
          <span id="save-status">Saved</span>
          <button className="btn btn-undo btn-sm"
            onClick={handleUndo} disabled={history.length === 0}>
            &#8630; Undo
          </button>
          <button className="btn btn-neu btn-sm" onClick={handleNew}>New</button>
          <button className="btn btn-neu btn-sm" onClick={handleExport}>Export</button>
          <label className="btn btn-neu btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
            Import
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </header>

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
        {renderTab()}
      </main>
    </div>
  );
}
