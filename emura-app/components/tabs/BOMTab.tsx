'use client';

import { useState, useRef } from 'react';
import { useDragSort } from '@/hooks/useDragSort';
import { TIPS } from '@/components/InfoIcon';
import SectionCard from '@/components/mcx/SectionCard';
import Icon from '@/components/mcx/Icon';
import { Grip, Chk, Note, HelpI } from '@/components/mcx/primitives';
import type { AppState, BOMItem, LibraryPart } from '@/lib/calculations';
import { annualPurchQty, applicablePrice, setCost } from '@/lib/calculations';
import { uid, parseFraction } from '@/lib/state';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  resetKey?: number;
  libraryParts?: LibraryPart[];
}

// ── Part number autocomplete ──────────────────────────────────
function PartNumberInput({ value, libraryParts, onCommit }: {
  value: string;
  libraryParts: LibraryPart[];
  onCommit: (pn: string, extra?: { description: string; uom: string }, libPart?: LibraryPart) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  function openMenu() {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setMenuStyle({ position: 'fixed', top: r.bottom + 2, left: r.left, width: Math.max(260, r.width), zIndex: 9999 });
    setOpen(true);
  }

  const libMatches = query.length > 0
    ? libraryParts.filter(lp => lp.partNumber.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className="mcx-input is-mono"
        style={{ width: 130 }}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); if (e.target.value.length > 0) openMenu(); else setOpen(false); }}
        onFocus={() => { if (query.length > 0) openMenu(); }}
        onBlur={() => { setTimeout(() => { setOpen(false); onCommit(query); }, 150); }}
        autoComplete="off"
      />
      {open && libMatches.length > 0 && (
        <div className="eq-menu mcx-menu" style={menuStyle}>
          {libMatches.map(lp => (
            <div key={lp.id} className="eq-item">
              <label onMouseDown={e => e.preventDefault()} onClick={() => {
                setQuery(lp.partNumber);
                setOpen(false);
                onCommit(lp.partNumber, { description: lp.description, uom: lp.uom }, lp);
              }}>
                <span className="mono" style={{ fontSize: 12 }}>{lp.partNumber}</span>
                {lp.description && <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>{lp.description}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ok-2)' }}>← copy</span>
                {lp.locked && <span style={{ fontSize: 10, color: 'var(--warn)' }}>locked</span>}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BOMTab({ state, onUpdate, resetKey = 0, libraryParts = [] }: Props) {
  const fgs    = state.finishedGoods;
  const common = state.bom.filter(item => !item.fgSpecific);
  const fgspec = state.bom.filter(item => item.fgSpecific);

  const bomSort = useDragSort(state.bom, bom => onUpdate({ ...state, bom }));

  function updateItem(globalIdx: number, patch: Partial<BOMItem>) {
    onUpdate({ ...state, bom: state.bom.map((item, i) => i === globalIdx ? { ...item, ...patch } : item) });
  }
  function setQtyBlur(globalIdx: number, value: string) {
    updateItem(globalIdx, { qty: parseFraction(value) });
  }
  function setFGQtyBlur(globalIdx: number, fgId: string, value: string) {
    const item = state.bom[globalIdx];
    updateItem(globalIdx, { fgQtys: { ...item.fgQtys, [fgId]: parseFraction(value) } });
  }
  function deleteItem(globalIdx: number) {
    onUpdate({ ...state, bom: state.bom.filter((_, i) => i !== globalIdx) });
  }
  function addCommon() {
    onUpdate({ ...state, bom: [...state.bom, { id: uid(), partNumber: '', description: '', uom: 'EA', fgSpecific: false, customerSupplied: false, qty: 1, fgQtys: {} }] });
  }
  function addFGSpec() {
    onUpdate({ ...state, bom: [...state.bom, { id: uid(), partNumber: '', description: '', uom: 'EA', fgSpecific: true, customerSupplied: false, qty: 0, fgQtys: {} }] });
  }

  function partCommit(gi: number, item: BOMItem) {
    return (pn: string, extra?: { description: string; uom: string }, libPart?: LibraryPart) => {
      const patch: Partial<BOMItem> = { partNumber: pn };
      if (extra) { if (!item.description) patch.description = extra.description; if (!item.uom || item.uom === 'EA') patch.uom = extra.uom; }
      let newState = { ...state, bom: state.bom.map((b, i2) => i2 === gi ? { ...b, ...patch } : b) };
      if (libPart && libPart.prices.length > 0) {
        const updatedItem = { ...item, ...patch };
        newState = { ...newState, materialCosts: { ...newState.materialCosts } };
        state.breaks.forEach((_, bki) => {
          const aq = annualPurchQty(newState, updatedItem, bki);
          if (aq > 0) { const price = applicablePrice(libPart.prices, aq); if (price !== null) setCost(newState, updatedItem.id, aq, price.unitCost); }
        });
      }
      onUpdate(newState);
    };
  }

  const sharedHdr = (
    <>
      <th style={{ width: 26 }} />
      <th>Part Number <HelpI tip={TIPS.bomPn} /></th>
      <th>Description <HelpI tip={TIPS.bomDesc} /></th>
      <th style={{ width: 64 }}>UOM <HelpI tip={TIPS.bomUom} /></th>
    </>
  );

  const trailingHdr = (
    <>
      <th className="ta-c" style={{ width: 78 }}>FG-Spec <HelpI tip={TIPS.bomFgSpec} /></th>
      <th className="ta-c" style={{ width: 84 }}>Cust.Sup <HelpI tip={TIPS.bomCustSup} /></th>
      <th className="ta-c" style={{ width: 56 }} title="Standard material — one flat price applies at any volume">Std</th>
      <th style={{ width: 40 }} />
    </>
  );

  return (
    <>
      {/* ── Common Materials ── */}
      <SectionCard icon="doc" title="Common Materials" sub="— Cust.Sup = customer-supplied, zero cost" action="Add Common" onAction={addCommon} bodyPad={false}>
        {common.length === 0 && <div style={{ padding: 16 }}><Note kind="accent">No common materials yet.</Note></div>}
        {common.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="mcx-table">
              <thead><tr>
                {sharedHdr}
                <th style={{ width: 110 }}>Qty / Unit <HelpI tip={TIPS.bomQty} /></th>
                {trailingHdr}
              </tr></thead>
              <tbody>
                {common.map(item => {
                  const gi = state.bom.indexOf(item);
                  return (
                    <tr key={item.id} {...bomSort.dragProps(gi)} className={bomSort.rowClass(gi, item.customerSupplied ? 'cs-row' : '')}>
                      <td className="drag-h"><Grip /></td>
                      <td><PartNumberInput value={item.partNumber ?? ''} libraryParts={libraryParts} onCommit={partCommit(gi, item)} /></td>
                      <td><input className="mcx-input" style={{ minWidth: 240 }} key={item.id + '-desc-' + resetKey} defaultValue={item.description ?? ''} onBlur={e => updateItem(gi, { description: e.target.value })} /></td>
                      <td><input className="mcx-input" style={{ width: 56, textAlign: 'center' }} key={item.id + '-uom-' + resetKey} defaultValue={item.uom ?? ''} onBlur={e => updateItem(gi, { uom: e.target.value })} /></td>
                      <td><input className="mcx-input is-num" style={{ width: 96 }} key={`${item.id}-qty-${resetKey}`} defaultValue={item.qty ?? ''} onBlur={e => setQtyBlur(gi, e.target.value)} /></td>
                      <td className="ta-c"><Chk on={false} title="Check to make FG-Specific" onChange={v => updateItem(gi, { fgSpecific: v })} /></td>
                      <td className="ta-c"><Chk on={item.customerSupplied ?? false} title="Customer Supplied — no cost" onChange={v => updateItem(gi, { customerSupplied: v })} /></td>
                      <td className="ta-c"><Chk on={item.standard ?? false} title="Standard material — one flat price applies at any volume" onChange={v => updateItem(gi, { standard: v })} /></td>
                      <td className="ta-c"><button className="mcx-btn is-sm is-quiet is-icon" style={{ color: 'var(--err)' }} onClick={() => deleteItem(gi)}><Icon name="x" size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── FG-Specific Materials ── */}
      <SectionCard icon="layers" title="FG-Specific Materials" action="Add FG-Specific" onAction={addFGSpec} bodyPad={false}>
        <div style={{ padding: '12px 16px 4px' }}>
          <Note kind="accent">Each FG may use a different quantity. Uncheck <b>FG-Spec</b> to move a part to Common.</Note>
        </div>
        {fgspec.length === 0 && <div style={{ padding: 16 }}><Note kind="accent">No FG-specific materials yet.</Note></div>}
        {fgspec.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="mcx-table">
              <thead><tr>
                {sharedHdr}
                {fgs.length > 0
                  ? fgs.map(fg => <th key={fg.id} className="ta-c" style={{ minWidth: 76 }}>{fg.name.slice(0, 10)}</th>)
                  : <th style={{ width: 120 }}>Qty / Unit</th>}
                {trailingHdr}
              </tr></thead>
              <tbody>
                {fgspec.map(item => {
                  const gi = state.bom.indexOf(item);
                  return (
                    <tr key={item.id} {...bomSort.dragProps(gi)} className={bomSort.rowClass(gi, item.customerSupplied ? 'cs-row' : '')}>
                      <td className="drag-h"><Grip /></td>
                      <td><PartNumberInput value={item.partNumber ?? ''} libraryParts={libraryParts} onCommit={partCommit(gi, item)} /></td>
                      <td><input className="mcx-input" style={{ minWidth: 240 }} key={item.id + '-desc-' + resetKey} defaultValue={item.description ?? ''} onBlur={e => updateItem(gi, { description: e.target.value })} /></td>
                      <td><input className="mcx-input" style={{ width: 56, textAlign: 'center' }} key={item.id + '-uom-' + resetKey} defaultValue={item.uom ?? ''} onBlur={e => updateItem(gi, { uom: e.target.value })} /></td>
                      {fgs.length > 0
                        ? fgs.map(fg => (
                          <td key={fg.id} className="ta-c">
                            <input className="mcx-input is-num" style={{ width: 72 }} key={`${item.id}-${fg.id}-qty-${resetKey}`} defaultValue={(item.fgQtys || {})[fg.id] ?? ''} onBlur={e => setFGQtyBlur(gi, fg.id, e.target.value)} />
                          </td>
                        ))
                        : <td><span style={{ color: 'var(--ink-4)', fontSize: 12, fontStyle: 'italic' }}>Add FGs first</span></td>}
                      <td className="ta-c"><Chk on title="Uncheck to make Common" onChange={v => updateItem(gi, { fgSpecific: v })} /></td>
                      <td className="ta-c"><Chk on={item.customerSupplied ?? false} title="Customer Supplied — no cost" onChange={v => updateItem(gi, { customerSupplied: v })} /></td>
                      <td className="ta-c"><Chk on={item.standard ?? false} title="Standard material — one flat price applies at any volume" onChange={v => updateItem(gi, { standard: v })} /></td>
                      <td className="ta-c"><button className="mcx-btn is-sm is-quiet is-icon" style={{ color: 'var(--err)' }} onClick={() => deleteItem(gi)}><Icon name="x" size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
