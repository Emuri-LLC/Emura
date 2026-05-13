'use client';

import { useDragSort } from '@/hooks/useDragSort';
import InfoIcon from '@/components/InfoIcon';
import EquipmentSelector from '@/components/EquipmentSelector';
import type { AppState, DirectOp, IndirectOp, Subcontract } from '@/lib/calculations';
import { getTaktInfo } from '@/lib/calculations';
import { uid } from '@/lib/state';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
}

function fmtN(n: number, d = 0) {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function OperationsTab({ state, onUpdate }: Props) {
  const dlSort  = useDragSort(state.directOps,   ops  => onUpdate({ ...state, directOps: ops }));
  const subSort = useDragSort(state.subcontracts, subs => onUpdate({ ...state, subcontracts: subs }));
  const ilSort  = useDragSort(state.indirectOps,  ops  => onUpdate({ ...state, indirectOps: ops }));

  // ── Direct ops helpers ──────────────────────────────────────
  function setDL(i: number, patch: Partial<DirectOp>) {
    const ops = state.directOps.map((op, idx) => idx === i ? { ...op, ...patch } : op);
    onUpdate({ ...state, directOps: ops });
  }
  function addDL() {
    onUpdate({ ...state, directOps: [...state.directOps, { id: uid(), name: '', operators: 1, cycleTimeSec: 0, orderSetupMin: 0, lineSetupMin: 0, equipmentIds: [], notes: '' }] });
  }
  function deleteDL(i: number) {
    onUpdate({ ...state, directOps: state.directOps.filter((_, idx) => idx !== i) });
  }
  function createEquipment(name: string) {
    const newEq = { id: uid(), name, capex: 0, hourlyRunCost: 0, annualMaintenance: 0, projectSpecific: false };
    onUpdate({ ...state, equipment: [...state.equipment, newEq] });
    return newEq.id;
  }

  // ── Subcontract helpers ─────────────────────────────────────
  function setSub(i: number, patch: Partial<Subcontract>) {
    const subs = state.subcontracts.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    onUpdate({ ...state, subcontracts: subs });
  }
  function addSub() {
    onUpdate({ ...state, subcontracts: [...state.subcontracts, { id: uid(), name: '', priceEach: 0, pricePerLine: 0, pricePerOrder: 0, pricePerYear: 0, notes: '' }] });
  }
  function deleteSub(i: number) {
    onUpdate({ ...state, subcontracts: state.subcontracts.filter((_, idx) => idx !== i) });
  }

  // ── Indirect ops helpers ────────────────────────────────────
  function setIL(i: number, patch: Partial<IndirectOp>) {
    const ops = state.indirectOps.map((op, idx) => idx === i ? { ...op, ...patch } : op);
    onUpdate({ ...state, indirectOps: ops });
  }
  function addIL() {
    onUpdate({ ...state, indirectOps: [...state.indirectOps, { id: uid(), name: '', annualHours: 0, orderSetupHrs: 0, lineSetupHrs: 0, notes: '' }] });
  }
  function deleteIL(i: number) {
    onUpdate({ ...state, indirectOps: state.indirectOps.filter((_, idx) => idx !== i) });
  }

  // ── Takt notice ─────────────────────────────────────────────
  const takt = getTaktInfo(state);
  let taktEl: React.ReactNode = null;
  if (takt) {
    const ts = takt.taktSec.toFixed(2);
    if (takt.exceeding.length) {
      taktEl = (
        <div className="inline-warn">
          Takt at <b>{takt.maxLabel}</b> ({fmtN(takt.maxTau)}/yr): <b>{ts} sec/unit</b>.
          {' '}One or more operations exceed required takt time:{' '}
          <b>{takt.exceeding.map(o => o.name || '(unnamed)').join(', ')}</b>
        </div>
      );
    } else {
      taktEl = (
        <div className="inline-info">
          Takt at <b>{takt.maxLabel}</b> ({fmtN(takt.maxTau)}/yr): <b>{ts} sec/unit</b>. All cycle times are within takt.
        </div>
      );
    }
  }

  return (
    <>
      {/* ── Direct Labor ── */}
      <div className="card">
        <div className="card-hdr">
          Direct Labor Operations
          <button className="btn btn-add btn-sm" onClick={addDL}>+ Add Operation</button>
        </div>
        <div className="card-body">
          <div className="inline-info">
            Shop Rate: <b>${state.settings.shopRate}/hr</b>. Equipment utilization includes cycle time + both setup types.
          </div>
          {taktEl}
          {state.directOps.length === 0 && <p className="empty-msg">No direct labor operations.</p>}
          {state.directOps.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th></th>
                  <th className="op-name">Operation <InfoIcon k="dlName" /></th>
                  <th>Operators <InfoIcon k="dlOps" /></th>
                  <th>Cycle Time<br />(sec) <InfoIcon k="dlCt" /></th>
                  <th>Order Setup<br />(min) <InfoIcon k="dlOs" /></th>
                  <th>Line Setup<br />(min) <InfoIcon k="dlLs" /></th>
                  <th>Equipment <InfoIcon k="dlEq" /></th>
                  <th className="notes-col">Notes <InfoIcon k="dlNotes" /></th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {state.directOps.map((op, i) => (
                    <tr key={op.id} {...dlSort.dragProps(i)} className={dlSort.rowClass(i)}>
                      <td className="drag-h">&#9776;</td>
                      <td className="op-name"><input type="text" value={op.name ?? ''} onChange={e => setDL(i, { name: e.target.value })} /></td>
                      <td><input type="number" min={1} style={{ maxWidth: 50 }} value={op.operators ?? 1} onChange={e => setDL(i, { operators: parseInt(e.target.value) || 1 })} /></td>
                      <td><input type="number" min={0} step="any" value={op.cycleTimeSec || ''} onChange={e => setDL(i, { cycleTimeSec: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" min={0} step="any" value={op.orderSetupMin || ''} onChange={e => setDL(i, { orderSetupMin: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" min={0} step="any" value={op.lineSetupMin || ''} onChange={e => setDL(i, { lineSetupMin: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ minWidth: 140 }}>
                        <EquipmentSelector
                          selectedIds={op.equipmentIds || []}
                          equipment={state.equipment}
                          onChange={ids => setDL(i, { equipmentIds: ids })}
                          onCreateEquipment={name => {
                            const newId = uid();
                            const newEq = { id: newId, name, capex: 0, hourlyRunCost: 0, annualMaintenance: 0, projectSpecific: false };
                            onUpdate({ ...state, equipment: [...state.equipment, newEq], directOps: state.directOps.map((o, idx) => idx === i ? { ...o, equipmentIds: [...(o.equipmentIds || []), newId] } : o) });
                          }}
                        />
                      </td>
                      <td className="notes-col">
                        <textarea value={op.notes ?? ''} rows={1} style={{ minHeight: 28, resize: 'vertical' }}
                          onChange={e => setDL(i, { notes: e.target.value })} />
                      </td>
                      <td><button className="btn btn-del btn-sm" onClick={() => deleteDL(i)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Subcontracts ── */}
      <div className="card">
        <div className="card-hdr">
          Subcontracts
          <button className="btn btn-add btn-sm" onClick={addSub}>+ Add Subcontract</button>
        </div>
        <div className="card-body">
          <div className="inline-info">
            <b>$/Each</b>: per unit. <b>$/Line</b>: per FG line/order event. <b>$/Order</b>: per order event. <b>$/Year</b>: fixed annual.
          </div>
          {state.subcontracts.length === 0 && <p className="empty-msg">No subcontracts defined.</p>}
          {state.subcontracts.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th></th>
                  <th className="op-name">Name <InfoIcon k="subName" /></th>
                  <th>$/Each <InfoIcon k="subEa" /></th>
                  <th>$/Line <InfoIcon k="subLine" /></th>
                  <th>$/Order <InfoIcon k="subOrder" /></th>
                  <th>$/Year <InfoIcon k="subYr" /></th>
                  <th className="notes-col">Notes</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {state.subcontracts.map((s, i) => (
                    <tr key={s.id} {...subSort.dragProps(i)} className={subSort.rowClass(i)}>
                      <td className="drag-h">&#9776;</td>
                      <td className="op-name"><input type="text" value={s.name ?? ''} onChange={e => setSub(i, { name: e.target.value })} /></td>
                      <td><input type="number" min={0} step="any" value={s.priceEach || ''} onChange={e => setSub(i, { priceEach: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" min={0} step="any" value={s.pricePerLine || ''} onChange={e => setSub(i, { pricePerLine: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" min={0} step="any" value={s.pricePerOrder || ''} onChange={e => setSub(i, { pricePerOrder: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" min={0} step="any" value={s.pricePerYear || ''} onChange={e => setSub(i, { pricePerYear: parseFloat(e.target.value) || 0 })} /></td>
                      <td className="notes-col">
                        <textarea value={s.notes ?? ''} rows={1} style={{ minHeight: 28, resize: 'vertical' }}
                          onChange={e => setSub(i, { notes: e.target.value })} />
                      </td>
                      <td><button className="btn btn-del btn-sm" onClick={() => deleteSub(i)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Indirect Labor ── */}
      <div className="card">
        <div className="card-hdr">
          Indirect Labor
          <button className="btn btn-add btn-sm" onClick={addIL}>+ Add Category</button>
        </div>
        <div className="card-body">
          <div className="inline-info">
            Indirect Rate: <b>${state.settings.indirectRate}/hr</b>. Annual Hrs spread over all units. Setup hours are per event.
          </div>
          {state.indirectOps.length === 0 && <p className="empty-msg">No indirect labor categories.</p>}
          {state.indirectOps.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th></th>
                  <th className="op-name">Category <InfoIcon k="ilName" /></th>
                  <th>Annual Hrs <InfoIcon k="ilAh" /></th>
                  <th>Order Setup (hrs) <InfoIcon k="ilOs" /></th>
                  <th>Line Setup (hrs) <InfoIcon k="ilLs" /></th>
                  <th className="notes-col">Notes</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {state.indirectOps.map((op, i) => (
                    <tr key={op.id} {...ilSort.dragProps(i)} className={ilSort.rowClass(i)}>
                      <td className="drag-h">&#9776;</td>
                      <td className="op-name"><input type="text" value={op.name ?? ''} onChange={e => setIL(i, { name: e.target.value })} /></td>
                      <td><input type="number" min={0} step="any" value={op.annualHours || ''} onChange={e => setIL(i, { annualHours: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" min={0} step="any" value={op.orderSetupHrs || ''} onChange={e => setIL(i, { orderSetupHrs: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" min={0} step="any" value={op.lineSetupHrs || ''} onChange={e => setIL(i, { lineSetupHrs: parseFloat(e.target.value) || 0 })} /></td>
                      <td className="notes-col">
                        <textarea value={op.notes ?? ''} rows={1} style={{ minHeight: 28, resize: 'vertical' }}
                          onChange={e => setIL(i, { notes: e.target.value })} />
                      </td>
                      <td><button className="btn btn-del btn-sm" onClick={() => deleteIL(i)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
