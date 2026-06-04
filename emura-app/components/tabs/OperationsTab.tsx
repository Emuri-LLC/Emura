'use client';

import { useDragSort } from '@/hooks/useDragSort';
import { TIPS } from '@/components/InfoIcon';
import EquipmentSelector from '@/components/EquipmentSelector';
import LaborRateSelector from '@/components/LaborRateSelector';
import SectionCard from '@/components/mcx/SectionCard';
import NumX from '@/components/mcx/NumX';
import Icon from '@/components/mcx/Icon';
import { Grip, Note, HelpI } from '@/components/mcx/primitives';
import type { AppState, DirectOp, IndirectOp, Subcontract, LaborRate, LibraryLaborRate } from '@/lib/calculations';
import { getTaktInfo, resolvePrimaryIndices, computePrimaryThroughput } from '@/lib/calculations';
import { uid } from '@/lib/state';
import { fmtN, fmtH } from '@/lib/format';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  resetKey?: number;
  libraryLaborRates?: LibraryLaborRate[];
}

export default function OperationsTab({ state, onUpdate, resetKey = 0, libraryLaborRates = [] }: Props) {
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
    onUpdate({ ...state, indirectOps: [...state.indirectOps, { id: uid(), name: '', annualHours: 0, orderSetupHrs: 0, lineSetupHrs: 0, notes: '', rateId: '' }] });
  }
  function deleteIL(i: number) {
    onUpdate({ ...state, indirectOps: state.indirectOps.filter((_, idx) => idx !== i) });
  }

  // ── Labor rate helpers ──────────────────────────────────────
  function createRate(name: string, rate = 0): string {
    const newRate: LaborRate = { id: uid(), name, rate };
    onUpdate({ ...state, laborRates: [...(state.laborRates ?? []), newRate] });
    return newRate.id;
  }

  // ── Primary FG/break throughput helpers (grey pc/hr numbers) ──
  const { fgi: pFgi, bki: pBki } = resolvePrimaryIndices(state);
  const throughput = (pFgi >= 0 && pBki >= 0) ? computePrimaryThroughput(state, pFgi, pBki) : null;
  const opThru = new Map((throughput?.ops ?? []).map(o => [o.opId, o]));
  const primaryFg  = pFgi >= 0 ? state.finishedGoods[pFgi] : null;
  const primaryBrk = pBki >= 0 ? state.breaks[pBki] : null;

  // ── Takt notice ─────────────────────────────────────────────
  const takt = getTaktInfo(state);
  let taktEl: React.ReactNode = null;
  if (takt) {
    const ts = takt.taktSec.toFixed(2);
    if (takt.exceeding.length) {
      taktEl = (
        <Note kind="warn">
          Takt at <b>{takt.maxLabel}</b> ({fmtN(takt.maxTau)}/yr): <b>{ts} sec/unit</b>.
          {' '}One or more operations exceed required takt time:{' '}
          <b>{takt.exceeding.map(o => o.name || '(unnamed)').join(', ')}</b>
        </Note>
      );
    } else {
      taktEl = (
        <Note kind="accent">
          Takt at <b>{takt.maxLabel}</b> ({fmtN(takt.maxTau)}/yr): <b>{ts} sec/unit</b>. All cycle times are within takt.
        </Note>
      );
    }
  }

  const hasRates = (state.laborRates ?? []).length > 0;

  return (
    <>
      {/* ── Direct Labor ── */}
      <SectionCard icon="bolt" title="Direct Labor Operations" action="Add Operation" onAction={addDL} bodyPad={false}>
        <div style={{ display: 'grid', gap: 8, padding: state.directOps.length || !hasRates || taktEl || throughput ? '12px 16px 0' : 0 }}>
          {!hasRates && (
            <Note kind="warn">No labor rates defined — operations will cost $0. Add rates on the Quote Info tab.</Note>
          )}
          {taktEl}
          {throughput && primaryFg && primaryBrk && (
            <Note kind="accent">
              Primary: <b>{primaryFg.name || '(unnamed)'}</b> @ <b>{primaryBrk.label}</b> ({fmtN(throughput.qty)} units/build).{' '}
              Line labor rate: <b>{fmtN(throughput.linePcPerHour, 1)} pc/hr</b>{' '}
              ({fmtH(throughput.linePersonHours)} person-hrs/build incl. setup, all operators). Grey numbers below are per-operation rates.
            </Note>
          )}
        </div>
        {state.directOps.length === 0 && <div style={{ padding: 16 }}><Note kind="accent">No direct labor operations yet.</Note></div>}
        {state.directOps.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="mcx-table is-top">
              <thead><tr>
                <th style={{ width: 26 }} />
                <th>Operation <HelpI tip={TIPS.dlName} /></th>
                <th>Rate <HelpI tip={TIPS.shopRate} /></th>
                <th className="ta-r">Operators <HelpI tip={TIPS.dlOps} /></th>
                <th className="ta-r">Cycle (sec) <HelpI tip={TIPS.dlCt} /></th>
                <th className="ta-r">Order Setup (min) <HelpI tip={TIPS.dlOs} /></th>
                <th className="ta-r">Line Setup (min) <HelpI tip={TIPS.dlLs} /></th>
                <th>Equipment <HelpI tip={TIPS.dlEq} /></th>
                <th>Notes <HelpI tip={TIPS.dlNotes} /></th>
                <th style={{ width: 40 }} />
              </tr></thead>
              <tbody>
                {state.directOps.map((op, i) => (
                  <tr key={op.id} {...dlSort.dragProps(i)} className={dlSort.rowClass(i)}>
                    <td className="drag-h"><Grip /></td>
                    <td>
                      <input className="mcx-input" style={{ width: 150 }} type="text" key={op.id + '-name-' + resetKey} defaultValue={op.name ?? ''} onBlur={e => setDL(i, { name: e.target.value })} />
                      {opThru.has(op.id) && (
                        <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }} title="pieces per labor-hour at the primary FG+break, incl. setup, all operators">
                          {fmtN(opThru.get(op.id)!.pcPerHour, 1)} pc/hr
                        </div>
                      )}
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <LaborRateSelector
                        selectedId={op.rateId ?? ''}
                        rates={state.laborRates ?? []}
                        libraryRates={libraryLaborRates}
                        onChange={rateId => setDL(i, { rateId })}
                        onCreateRate={(name, rate) => createRate(name, rate)}
                        onCopyFromLibrary={lr => {
                          const newRate: LaborRate = { id: uid(), name: lr.name, rate: lr.rate };
                          onUpdate({
                            ...state,
                            laborRates: [...(state.laborRates ?? []), newRate],
                            directOps: state.directOps.map((op, idx) => idx === i ? { ...op, rateId: newRate.id } : op),
                          });
                        }}
                      />
                    </td>
                    <td className="ta-r"><NumX value={op.operators ?? 1} min={0.1} width={80} key={op.id + '-ops-' + resetKey} onCommit={v => setDL(i, { operators: v || 1 })} /></td>
                    <td className="ta-r"><NumX value={op.cycleTimeSec || 0} min={0} blankZero width={90} key={op.id + '-ct-' + resetKey} onCommit={v => setDL(i, { cycleTimeSec: v })} /></td>
                    <td className="ta-r"><NumX value={op.orderSetupMin || 0} min={0} blankZero width={100} key={op.id + '-os-' + resetKey} onCommit={v => setDL(i, { orderSetupMin: v })} /></td>
                    <td className="ta-r"><NumX value={op.lineSetupMin || 0} min={0} blankZero width={100} key={op.id + '-ls-' + resetKey} onCommit={v => setDL(i, { lineSetupMin: v })} /></td>
                    <td style={{ minWidth: 150 }}>
                      <EquipmentSelector
                        selectedIds={op.equipmentIds || []}
                        equipment={state.equipment}
                        onChange={ids => setDL(i, { equipmentIds: ids })}
                        onCreateEquipment={name => {
                          const newId = uid();
                          const newEq = { id: newId, name, capex: 0, hourlyRunCost: 0, annualMaintenance: 0, projectSpecific: false };
                          onUpdate({ ...state, equipment: [...state.equipment, newEq], directOps: state.directOps.map((o, idx) => idx === i ? { ...o, equipmentIds: [...(o.equipmentIds || []), newId] } : o) });
                        }}
                        onCopyFromLibrary={le => {
                          const existing = state.equipment.find(e => e.name.trim().toLowerCase() === le.name.trim().toLowerCase());
                          const eqId = existing?.id ?? uid();
                          if (!existing) {
                            const newEq = { id: eqId, name: le.name, capex: le.capex, hourlyRunCost: le.hourlyRunCost, annualMaintenance: le.annualMaintenance, projectSpecific: false };
                            onUpdate({ ...state, equipment: [...state.equipment, newEq], directOps: state.directOps.map((o, idx) => idx === i ? { ...o, equipmentIds: [...(o.equipmentIds || []), eqId] } : o) });
                          } else {
                            setDL(i, { equipmentIds: [...(op.equipmentIds || []), eqId] });
                          }
                        }}
                      />
                    </td>
                    <td>
                      <textarea className="mcx-input" key={op.id + '-notes-' + resetKey} defaultValue={op.notes ?? ''} rows={1} style={{ minHeight: 30, minWidth: 120, resize: 'vertical' }}
                        onBlur={e => setDL(i, { notes: e.target.value })} />
                    </td>
                    <td className="ta-c"><button className="mcx-btn is-sm is-quiet is-icon" style={{ color: 'var(--err)' }} onClick={() => deleteDL(i)}><Icon name="x" size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Subcontracts ── */}
      <SectionCard icon="layers" title="Subcontracts" action="Add Subcontract" onAction={addSub} bodyPad={false}>
        <div style={{ padding: '12px 16px 0' }}>
          <Note kind="accent">
            <b>$/Each</b>: per unit. <b>$/Line</b>: per FG line/order event. <b>$/Order</b>: per order event. <b>$/Year</b>: fixed annual.
          </Note>
        </div>
        {state.subcontracts.length === 0 && <div style={{ padding: 16 }}><Note kind="accent">No subcontracts defined.</Note></div>}
        {state.subcontracts.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="mcx-table is-top">
              <thead><tr>
                <th style={{ width: 26 }} />
                <th>Name <HelpI tip={TIPS.subName} /></th>
                <th className="ta-r">$/Each <HelpI tip={TIPS.subEa} /></th>
                <th className="ta-r">$/Line <HelpI tip={TIPS.subLine} /></th>
                <th className="ta-r">$/Order <HelpI tip={TIPS.subOrder} /></th>
                <th className="ta-r">$/Year <HelpI tip={TIPS.subYr} /></th>
                <th>Notes</th>
                <th style={{ width: 40 }} />
              </tr></thead>
              <tbody>
                {state.subcontracts.map((s, i) => (
                  <tr key={s.id} {...subSort.dragProps(i)} className={subSort.rowClass(i)}>
                    <td className="drag-h"><Grip /></td>
                    <td><input className="mcx-input" style={{ width: 150 }} type="text" key={s.id + '-name-' + resetKey} defaultValue={s.name ?? ''} onBlur={e => setSub(i, { name: e.target.value })} /></td>
                    <td className="ta-r"><NumX value={s.priceEach || 0} min={0} blankZero suffix="$" width={100} key={s.id + '-ea-' + resetKey} onCommit={v => setSub(i, { priceEach: v })} /></td>
                    <td className="ta-r"><NumX value={s.pricePerLine || 0} min={0} blankZero suffix="$" width={100} key={s.id + '-line-' + resetKey} onCommit={v => setSub(i, { pricePerLine: v })} /></td>
                    <td className="ta-r"><NumX value={s.pricePerOrder || 0} min={0} blankZero suffix="$" width={100} key={s.id + '-ord-' + resetKey} onCommit={v => setSub(i, { pricePerOrder: v })} /></td>
                    <td className="ta-r"><NumX value={s.pricePerYear || 0} min={0} blankZero suffix="$" width={100} key={s.id + '-yr-' + resetKey} onCommit={v => setSub(i, { pricePerYear: v })} /></td>
                    <td>
                      <textarea className="mcx-input" key={s.id + '-notes-' + resetKey} defaultValue={s.notes ?? ''} rows={1} style={{ minHeight: 30, minWidth: 120, resize: 'vertical' }}
                        onBlur={e => setSub(i, { notes: e.target.value })} />
                    </td>
                    <td className="ta-c"><button className="mcx-btn is-sm is-quiet is-icon" style={{ color: 'var(--err)' }} onClick={() => deleteSub(i)}><Icon name="x" size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Indirect Labor ── */}
      <SectionCard icon="bolt" title="Indirect Labor" action="Add Category" onAction={addIL} bodyPad={false}>
        <div style={{ padding: '12px 16px 0' }}>
          <Note kind="accent">Annual Hrs spread over all units. Setup hours are per event.</Note>
        </div>
        {state.indirectOps.length === 0 && <div style={{ padding: 16 }}><Note kind="accent">No indirect labor categories.</Note></div>}
        {state.indirectOps.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="mcx-table is-top">
              <thead><tr>
                <th style={{ width: 26 }} />
                <th>Category <HelpI tip={TIPS.ilName} /></th>
                <th>Rate <HelpI tip={TIPS.indRate} /></th>
                <th className="ta-r">Annual Hrs <HelpI tip={TIPS.ilAh} /></th>
                <th className="ta-r">Order Setup (hrs) <HelpI tip={TIPS.ilOs} /></th>
                <th className="ta-r">Line Setup (hrs) <HelpI tip={TIPS.ilLs} /></th>
                <th>Notes</th>
                <th style={{ width: 40 }} />
              </tr></thead>
              <tbody>
                {state.indirectOps.map((op, i) => (
                  <tr key={op.id} {...ilSort.dragProps(i)} className={ilSort.rowClass(i)}>
                    <td className="drag-h"><Grip /></td>
                    <td><input className="mcx-input" style={{ width: 150 }} type="text" key={op.id + '-name-' + resetKey} defaultValue={op.name ?? ''} onBlur={e => setIL(i, { name: e.target.value })} /></td>
                    <td style={{ minWidth: 140 }}>
                      <LaborRateSelector
                        selectedId={op.rateId ?? ''}
                        rates={state.laborRates ?? []}
                        libraryRates={libraryLaborRates}
                        onChange={rateId => setIL(i, { rateId })}
                        onCreateRate={(name, rate) => createRate(name, rate)}
                        onCopyFromLibrary={lr => {
                          const newRate: LaborRate = { id: uid(), name: lr.name, rate: lr.rate };
                          onUpdate({
                            ...state,
                            laborRates: [...(state.laborRates ?? []), newRate],
                            indirectOps: state.indirectOps.map((op, idx) => idx === i ? { ...op, rateId: newRate.id } : op),
                          });
                        }}
                      />
                    </td>
                    <td className="ta-r"><NumX value={op.annualHours || 0} min={0} blankZero width={100} key={op.id + '-ah-' + resetKey} onCommit={v => setIL(i, { annualHours: v })} /></td>
                    <td className="ta-r"><NumX value={op.orderSetupHrs || 0} min={0} blankZero width={110} key={op.id + '-os-' + resetKey} onCommit={v => setIL(i, { orderSetupHrs: v })} /></td>
                    <td className="ta-r"><NumX value={op.lineSetupHrs || 0} min={0} blankZero width={110} key={op.id + '-ls-' + resetKey} onCommit={v => setIL(i, { lineSetupHrs: v })} /></td>
                    <td>
                      <textarea className="mcx-input" key={op.id + '-notes-' + resetKey} defaultValue={op.notes ?? ''} rows={1} style={{ minHeight: 30, minWidth: 120, resize: 'vertical' }}
                        onBlur={e => setIL(i, { notes: e.target.value })} />
                    </td>
                    <td className="ta-c"><button className="mcx-btn is-sm is-quiet is-icon" style={{ color: 'var(--err)' }} onClick={() => deleteIL(i)}><Icon name="x" size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
