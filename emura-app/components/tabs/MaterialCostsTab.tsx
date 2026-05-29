'use client';

import type { AppState, BOMItem } from '@/lib/calculations';
import { annualPurchQty, findCost, setCost } from '@/lib/calculations';
import InfoIcon from '@/components/InfoIcon';
import { fmtN } from '@/lib/format';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  resetKey?: number;
}

export default function MaterialCostsTab({ state, onUpdate, resetKey = 0 }: Props) {
  const costable = state.bom.filter(item => !item.customerSupplied);

  if (!costable.length) {
    return <div className="card"><div className="card-body"><p className="empty-msg">Add non-customer-supplied BOM items first.</p></div></div>;
  }

  const hasMissing = costable.some(item =>
    state.breaks.some((_, j) => {
      const aq = annualPurchQty(state, item, j);
      return aq > 0 && !findCost(state, item.id, aq);
    })
  );

  function handleCostChange(item: BOMItem, j: number, aq: number, value: string) {
    const cost = parseFloat(value);
    if (isNaN(cost)) return;
    const newMC = { ...state.materialCosts };
    const updated = { ...state, materialCosts: newMC };
    setCost(updated, item.id, aq, cost);
    onUpdate(updated);
  }

  // Standard materials use a single flat price stored as an annualQty=0 entry.
  function handleFlatCostChange(item: BOMItem, value: string) {
    const cost = parseFloat(value);
    if (isNaN(cost)) return;
    const updated = { ...state, materialCosts: { ...state.materialCosts } };
    setCost(updated, item.id, 0, cost);
    onUpdate(updated);
  }

  function handleSourceChange(item: BOMItem, j: number, value: string) {
    const key = `${item.id}|${j}`;
    onUpdate({ ...state, materialSources: { ...state.materialSources, [key]: value } });
  }

  function pushSource(item: BOMItem, srcBrki: number) {
    const val = state.materialSources?.[`${item.id}|${srcBrki}`] ?? '';
    const sources = { ...(state.materialSources || {}) };
    state.breaks.forEach((_, j) => { sources[`${item.id}|${j}`] = val; });
    onUpdate({ ...state, materialSources: sources });
  }

  const brkHdr = state.breaks.map((b, j) => (
    <th key={j} style={{ textAlign: 'center', minWidth: 115 }}>
      {b.label}<br />
      <span style={{ fontWeight: 400, fontSize: 11 }}>{b.buildsPerYear}×/yr</span>
    </th>
  ));

  return (
    <div className="card">
      <div className="card-hdr">Material Costs — $/unit at Annual Purchasing Volume</div>
      <div className="card-body">
        {hasMissing && (
          <div className="inline-warn">
            Pink = missing cost. Yellow = archived cost at different volume — review before finalizing.
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr>
              <th>Part Number</th>
              <th>Description</th>
              <th>UOM</th>
              {brkHdr}
            </tr></thead>
            <tbody>
              {costable.map(item => {
                if (item.standard) {
                  const flat = (state.materialCosts[item.id] ?? []).find(e => e.annualQty === 0);
                  return (
                    <tr key={item.id}>
                      <td>{item.partNumber || '—'}</td>
                      <td>{item.description || '—'}</td>
                      <td>{item.uom || ''}</td>
                      <td colSpan={state.breaks.length} className="mcell">
                        <div className="mcell-qty" style={{ color: '#0369a1' }}>Standard — flat price at any volume</div>
                        <input
                          type="number" min={0} step="any"
                          style={{ maxWidth: 120 }}
                          key={item.id + '-flat-' + resetKey}
                          defaultValue={flat ? flat.cost : ''}
                          onBlur={e => handleFlatCostChange(item, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                }
                return (
                <tr key={item.id}>
                  <td>{item.partNumber || '—'}</td>
                  <td>{item.description || '—'}</td>
                  <td>{item.uom || ''}</td>
                  {state.breaks.map((_, j) => {
                    const aq = annualPurchQty(state, item, j);
                    if (aq <= 0) return <td key={j} style={{ textAlign: 'center', color: '#aaa' }}>—</td>;

                    const found = findCost(state, item.id, aq);
                    let cls = 'mcell';
                    let archNote: React.ReactNode = null;
                    if (found && found.flagged) {
                      cls += ' mc-arch';
                      archNote = <span className="arch-note">⚠ Archived @ {fmtN(found.actualQty)}</span>;
                    } else if (!found) {
                      cls += ' mc-miss';
                    }
                    const srcKey = `${item.id}|${j}`;
                    const srcVal = state.materialSources?.[srcKey] ?? '';

                    return (
                      <td key={j} className={cls}>
                        <div className="mcell-qty">Ann.Qty: <b>{fmtN(aq)}</b></div>
                        <input
                          type="number" min={0} step="any"
                          defaultValue={found ? found.cost : ''}
                          onBlur={e => handleCostChange(item, j, aq, e.target.value)}
                        />
                        {archNote}
                        <div style={{ display: 'flex', gap: 3, marginTop: 3, alignItems: 'center' }}>
                          <input
                            type="text" className="src-inp"
                            placeholder="source"
                            title="Source of this price"
                            key={srcKey + '-' + resetKey}
                            defaultValue={srcVal}
                            onBlur={e => handleSourceChange(item, j, e.target.value)}
                          />
                          <button className="btn-push"
                            onClick={() => pushSource(item, j)}
                            title="Copy source to all breaks">→</button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
