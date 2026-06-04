'use client';

import type { AppState, BOMItem } from '@/lib/calculations';
import { annualPurchQty, findCost, setCost, clearCost, priceAnomalyBreaks } from '@/lib/calculations';
import SectionCard from '@/components/mcx/SectionCard';
import Icon from '@/components/mcx/Icon';
import { Note, Chip } from '@/components/mcx/primitives';
import { fmtN } from '@/lib/format';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  resetKey?: number;
}

export default function MaterialCostsTab({ state, onUpdate, resetKey = 0 }: Props) {
  const costable = state.bom.filter(item => !item.customerSupplied);

  if (!costable.length) {
    return (
      <SectionCard icon="sum" title="Material Costs">
        <Note kind="accent">Add non-customer-supplied BOM items first.</Note>
      </SectionCard>
    );
  }

  let missingCount = 0;
  for (const item of costable) {
    if (item.standard) continue;
    for (let j = 0; j < state.breaks.length; j++) {
      const aq = annualPurchQty(state, item, j);
      if (aq > 0 && !findCost(state, item.id, aq)) missingCount++;
    }
  }

  function setCostNum(item: BOMItem, aq: number, value: string) {
    const updated = { ...state, materialCosts: { ...state.materialCosts } };
    if (value.trim() === '') {
      // Emptied field → remove the entry (don't silently revert to the old value).
      clearCost(updated, item.id, aq);
      onUpdate(updated);
      return;
    }
    const cost = parseFloat(value);
    if (isNaN(cost)) return;
    setCost(updated, item.id, aq, cost);
    onUpdate(updated);
  }
  function handleFlatCostChange(item: BOMItem, value: string) {
    const updated = { ...state, materialCosts: { ...state.materialCosts } };
    if (value.trim() === '') {
      clearCost(updated, item.id, 0);
      onUpdate(updated);
      return;
    }
    const cost = parseFloat(value);
    if (isNaN(cost)) return;
    setCost(updated, item.id, 0, cost);
    onUpdate(updated);
  }
  function handleSourceChange(item: BOMItem, j: number, value: string) {
    onUpdate({ ...state, materialSources: { ...state.materialSources, [`${item.id}|${j}`]: value } });
  }
  function pushSource(item: BOMItem, srcBrki: number) {
    const val = state.materialSources?.[`${item.id}|${srcBrki}`] ?? '';
    const sources = { ...(state.materialSources || {}) };
    state.breaks.forEach((_, j) => { sources[`${item.id}|${j}`] = val; });
    onUpdate({ ...state, materialSources: sources });
  }

  return (
    <SectionCard
      icon="sum" title="Material Costs" sub="— $/unit at annual purchasing volume" bodyPad={false}
      right={missingCount > 0 ? <Chip kind="err" style={{ marginRight: 4 }}>{missingCount} missing</Chip> : undefined}
    >
      <div style={{ padding: '12px 16px' }}>
        <Note kind="warn">
          <b style={{ color: 'var(--err)' }}>Pink</b> = missing cost (blocks finalize). <b style={{ color: 'var(--warn)' }}>Yellow</b> = archived break or price anomaly (higher price at higher volume) — review before finalizing.
        </Note>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="mcx-table">
          <thead><tr>
            <th style={{ width: 96 }}>Part #</th>
            <th style={{ width: 160 }}>Description</th>
            <th style={{ width: 54 }}>UOM</th>
            {state.breaks.map((b, j) => (
              <th key={j} style={{ minWidth: 150 }}>
                {b.label} <span style={{ fontWeight: 500, color: 'var(--ink-4)' }}>· {b.buildsPerYear}×/yr</span>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {costable.map(item => {
              const flat = (state.materialCosts[item.id] ?? []).find(e => e.annualQty === 0);
              const anomalyBreaks = priceAnomalyBreaks(state, item);
              return (
                <tr key={item.id}>
                  <td className="mono" style={{ fontWeight: 600, verticalAlign: 'top', paddingTop: 14 }}>{item.partNumber || '—'}</td>
                  <td style={{ color: 'var(--ink-2)', verticalAlign: 'top', paddingTop: 14 }}>{item.description || '—'}</td>
                  <td style={{ color: 'var(--ink-3)', verticalAlign: 'top', paddingTop: 14 }}>{item.uom || ''}</td>

                  {item.standard ? (
                    <td colSpan={state.breaks.length} style={{ verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                        <span style={{ color: 'var(--accent-ink)', fontSize: 12.5, fontWeight: 600 }}>Standard — flat price at any volume</span>
                        <div className="mcx-num" style={{ width: 160 }}>
                          <span className="mcx-affix" style={{ paddingRight: 0 }}>$</span>
                          <input className="num" type="text" inputMode="decimal" key={item.id + '-flat-' + resetKey} defaultValue={flat ? flat.cost : ''} onBlur={e => handleFlatCostChange(item, e.target.value)} />
                        </div>
                      </div>
                    </td>
                  ) : (
                    state.breaks.map((_, j) => {
                      const aq = annualPurchQty(state, item, j);
                      if (aq <= 0) return <td key={j} className="ta-c" style={{ color: 'var(--ink-4)', verticalAlign: 'top', paddingTop: 14 }}>—</td>;

                      const found = findCost(state, item.id, aq);
                      const archived = !!(found && found.flagged);
                      const missing = !found;
                      const anomaly = anomalyBreaks.has(j);
                      const bg = missing ? 'var(--err-bg)' : (archived || anomaly) ? 'var(--warn-bg)' : 'transparent';
                      const bd = missing ? 'var(--err-border)' : (archived || anomaly) ? 'var(--warn-border)' : 'transparent';
                      const srcKey = `${item.id}|${j}`;
                      const srcVal = state.materialSources?.[srcKey] ?? '';

                      return (
                        <td key={j} style={{ background: bg, boxShadow: bd !== 'transparent' ? 'inset 0 0 0 1px ' + bd : 'none', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
                            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Ann.Qty: <b style={{ color: 'var(--ink-2)' }}>{fmtN(aq)}</b></span>
                            <div className="mcx-num" style={{ width: '100%' }}>
                              <span className="mcx-affix" style={{ paddingRight: 0 }}>$</span>
                              <input className="num" type="text" inputMode="decimal" key={srcKey + '-cost-' + resetKey} defaultValue={found ? found.cost : ''} onBlur={e => setCostNum(item, aq, e.target.value)} />
                            </div>
                            {/* Fixed-height indicator lane — keeps the source box aligned
                                across cells whether or not a warning is present. */}
                            <div style={{ height: 15, display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                              {archived && <span title={`Archived price reused from ${fmtN(found!.actualQty)} units/yr`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warn)', fontSize: 10.5 }}><Icon name="alert" size={10} sw={2} />Archived @ {fmtN(found!.actualQty)}</span>}
                              {anomaly && <span title="This unit cost is higher than at a lower-volume break" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warn)', fontSize: 10.5 }}><Icon name="alert" size={10} sw={2} />Price &gt; lower vol</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <input className="mcx-input" style={{ height: 26, fontSize: 11.5 }} placeholder="source" title="Source of this price" key={srcKey + '-src-' + resetKey} defaultValue={srcVal} onBlur={e => handleSourceChange(item, j, e.target.value)} />
                              <button className="mcx-btn is-sm is-icon" style={{ color: 'var(--ok-2)', flex: '0 0 auto' }} onClick={() => pushSource(item, j)} title="Copy source to all breaks"><Icon name="chevR" size={12} sw={2.2} /></button>
                            </div>
                          </div>
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
