'use client';

import { useDragSort } from '@/hooks/useDragSort';
import InfoIcon from '@/components/InfoIcon';
import type { AppState, BOMItem } from '@/lib/calculations';
import { uid, parseFraction } from '@/lib/state';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  resetKey?: number;
}

export default function BOMTab({ state, onUpdate, resetKey = 0 }: Props) {
  const fgs    = state.finishedGoods;
  const common = state.bom.filter(item => !item.fgSpecific);
  const fgspec = state.bom.filter(item => item.fgSpecific);

  // Drag operates on the full bom array using global indices
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

  const sharedColHdrs = (
    <>
      <th></th>
      <th>Part Number <InfoIcon k="bomPn" /></th>
      <th>Description <InfoIcon k="bomDesc" /></th>
      <th>UOM <InfoIcon k="bomUom" /></th>
    </>
  );

  const fgHdr = fgs.map(fg => (
    <th key={fg.id} style={{ textAlign: 'center', minWidth: 72 }}>
      {fg.name.slice(0, 9)}
    </th>
  ));

  return (
    <>
      {/* ── Common Materials ── */}
      <div className="card">
        <div className="card-hdr">
          Common Materials
          <span style={{ fontSize: 11, color: '#888', fontWeight: 400, marginLeft: 8 }}>
            Cust.Sup = customer-supplied, zero cost
          </span>
          <button className="btn btn-add btn-sm" onClick={addCommon}>+ Add Common</button>
        </div>
        <div className="card-body">
          {common.length === 0 && <p className="empty-msg">No common materials.</p>}
          {common.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  {sharedColHdrs}
                  <th>Qty/Unit <InfoIcon k="bomQty" /></th>
                  <th style={{ textAlign: 'center' }}>FG-Spec <InfoIcon k="bomFgSpec" /></th>
                  <th style={{ textAlign: 'center' }}>Cust.Sup <InfoIcon k="bomCustSup" /></th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {common.map(item => {
                    const gi = state.bom.indexOf(item);
                    return (
                      <tr key={item.id}
                        {...bomSort.dragProps(gi)}
                        className={bomSort.rowClass(gi, item.customerSupplied ? 'cs-row' : '')}>
                        <td className="drag-h">&#9776;</td>
                        <td><input type="text" value={item.partNumber ?? ''} onChange={e => updateItem(gi, { partNumber: e.target.value })} /></td>
                        <td><input type="text" value={item.description ?? ''} onChange={e => updateItem(gi, { description: e.target.value })} /></td>
                        <td style={{ width: 52 }}><input type="text" value={item.uom ?? ''} onChange={e => updateItem(gi, { uom: e.target.value })} /></td>
                        {/* Qty uses defaultValue+onBlur so fractions can be typed without interruption */}
                        <td style={{ width: 80 }}>
                          <input type="text"
                            key={`${item.id}-qty-${resetKey}`}
                            defaultValue={item.qty ?? ''}
                            onBlur={e => setQtyBlur(gi, e.target.value)} />
                        </td>
                        <td style={{ textAlign: 'center', width: 52 }}>
                          <input type="checkbox" checked={false} title="Check to make FG-Specific"
                            onChange={e => updateItem(gi, { fgSpecific: e.target.checked })} />
                        </td>
                        <td style={{ textAlign: 'center', width: 52 }}>
                          <input type="checkbox" checked={item.customerSupplied ?? false} title="Customer Supplied — no cost"
                            onChange={e => updateItem(gi, { customerSupplied: e.target.checked })} />
                        </td>
                        <td><button className="btn btn-del btn-sm" onClick={() => deleteItem(gi)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── FG-Specific Materials ── */}
      <div className="card">
        <div className="card-hdr">
          FG-Specific Materials
          <button className="btn btn-add btn-sm" onClick={addFGSpec}>+ Add FG-Specific</button>
        </div>
        <div className="card-body">
          <div className="inline-info" style={{ marginBottom: 8 }}>
            Each FG may use a different quantity. Uncheck FG-Spec to move to Common.
          </div>
          {fgspec.length === 0 && <p className="empty-msg">No FG-specific materials.</p>}
          {fgspec.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  {sharedColHdrs}
                  {fgs.length > 0 ? fgHdr : <th>Qty/Unit</th>}
                  <th style={{ textAlign: 'center' }}>FG-Spec</th>
                  <th style={{ textAlign: 'center' }}>Cust.Sup</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {fgspec.map(item => {
                    const gi = state.bom.indexOf(item);
                    return (
                      <tr key={item.id}
                        {...bomSort.dragProps(gi)}
                        className={bomSort.rowClass(gi, item.customerSupplied ? 'cs-row' : '')}>
                        <td className="drag-h">&#9776;</td>
                        <td><input type="text" value={item.partNumber ?? ''} onChange={e => updateItem(gi, { partNumber: e.target.value })} /></td>
                        <td><input type="text" value={item.description ?? ''} onChange={e => updateItem(gi, { description: e.target.value })} /></td>
                        <td style={{ width: 52 }}><input type="text" value={item.uom ?? ''} onChange={e => updateItem(gi, { uom: e.target.value })} /></td>
                        {fgs.length > 0
                          ? fgs.map(fg => (
                            <td key={fg.id} style={{ textAlign: 'center' }}>
                              <input type="text"
                                key={`${item.id}-${fg.id}-qty-${resetKey}`}
                                defaultValue={(item.fgQtys || {})[fg.id] ?? ''}
                                onBlur={e => setFGQtyBlur(gi, fg.id, e.target.value)} />
                            </td>
                          ))
                          : <td><span style={{ color: '#aaa', fontSize: 11 }}>Add FGs first</span></td>
                        }
                        <td style={{ textAlign: 'center', width: 52 }}>
                          <input type="checkbox" checked={true} title="Uncheck to make Common"
                            onChange={e => updateItem(gi, { fgSpecific: e.target.checked })} />
                        </td>
                        <td style={{ textAlign: 'center', width: 52 }}>
                          <input type="checkbox" checked={item.customerSupplied ?? false} title="Customer Supplied — no cost"
                            onChange={e => updateItem(gi, { customerSupplied: e.target.checked })} />
                        </td>
                        <td><button className="btn btn-del btn-sm" onClick={() => deleteItem(gi)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
