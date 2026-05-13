'use client';

import { useDragSort } from '@/hooks/useDragSort';
import InfoIcon from '@/components/InfoIcon';
import type { AppState, Break, FinishedGood } from '@/lib/calculations';
import { uid } from '@/lib/state';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
}

function totalAnnualUnits(fgs: FinishedGood[], bki: number) {
  return fgs.reduce((s, fg) => s + (Number((fg.breaks[bki] || {}).eau) || 0), 0);
}

function applyMix(state: AppState, srcBki: number, dstBki: number): AppState {
  const srcTotal = totalAnnualUnits(state.finishedGoods, srcBki);
  if (!srcTotal) return state;
  const dstTotal = Number(state.breaks[dstBki]?.totalEAU) || 0;
  if (!dstTotal) return state;
  const fgs = state.finishedGoods.map(fg => {
    const pct = (Number((fg.breaks[srcBki] || {}).eau) || 0) / srcTotal;
    const breaks = [...fg.breaks];
    while (breaks.length <= dstBki) breaks.push({});
    breaks[dstBki] = { eau: Math.round(pct * dstTotal) };
    return { ...fg, breaks };
  });
  return { ...state, finishedGoods: fgs };
}

export default function FinishedGoodsTab({ state, onUpdate }: Props) {
  const brkSort  = useDragSort(state.breaks, brks => onUpdate({ ...state, breaks: brks }));
  const fgSort   = useDragSort(state.finishedGoods, fgs => onUpdate({ ...state, finishedGoods: fgs }));

  function setBreak(i: number, field: keyof Break, value: string | number) {
    const breaks = state.breaks.map((b, idx) => idx === i ? { ...b, [field]: value } : b);
    let next: AppState = { ...state, breaks };
    // Auto-fill mix if a target EAU was just set on a non-first break
    if (field === 'totalEAU' && i > 0 && Number(value) > 0) {
      const srcTotal = totalAnnualUnits(state.finishedGoods, 0);
      const dstEmpty = !state.finishedGoods.some(fg => Number((fg.breaks[i] || {}).eau) > 0);
      if (srcTotal > 0 && dstEmpty) next = applyMix(next, 0, i);
    }
    onUpdate(next);
  }

  function setFGField(i: number, field: 'name' | 'description', value: string) {
    const fgs = state.finishedGoods.map((fg, idx) =>
      idx === i ? { ...fg, [field]: value } : fg
    );
    onUpdate({ ...state, finishedGoods: fgs });
  }

  function setEAU(fgi: number, bki: number, value: string) {
    const fgs = state.finishedGoods.map((fg, i) => {
      if (i !== fgi) return fg;
      const breaks = [...(fg.breaks || [])];
      while (breaks.length <= bki) breaks.push({});
      const v = Number(value);
      breaks[bki] = v > 0 ? { eau: v } : {};
      return { ...fg, breaks };
    });
    onUpdate({ ...state, finishedGoods: fgs });
  }

  function addBreak() {
    onUpdate({ ...state, breaks: [...state.breaks, { id: uid(), label: `Break ${state.breaks.length + 1}`, buildsPerYear: 1, totalEAU: 0 }] });
  }
  function deleteBreak(i: number) {
    if (state.breaks.length <= 1) return;
    const breaks = state.breaks.filter((_, idx) => idx !== i);
    const fgs = state.finishedGoods.map(fg => ({ ...fg, breaks: fg.breaks.filter((_, idx) => idx !== i) }));
    onUpdate({ ...state, breaks, finishedGoods: fgs });
  }
  function addFG() {
    const fg: FinishedGood = { id: uid(), name: `FG-${String(state.finishedGoods.length + 1).padStart(3, '0')}`, description: '', breaks: state.breaks.map(() => ({})) };
    onUpdate({ ...state, finishedGoods: [...state.finishedGoods, fg] });
  }
  function deleteFG(i: number) {
    const fgId = state.finishedGoods[i].id;
    const fgs = state.finishedGoods.filter((_, idx) => idx !== i);
    const bom = state.bom.map(item => { const q = { ...item.fgQtys }; delete q[fgId]; return { ...item, fgQtys: q }; });
    onUpdate({ ...state, finishedGoods: fgs, bom });
  }

  // Sum row display
  function sumCell(j: number) {
    const sum = totalAnnualUnits(state.finishedGoods, j);
    const tgt = Number(state.breaks[j]?.totalEAU) || 0;
    if (!tgt) return <span>{sum.toLocaleString()}</span>;
    const diff = Math.abs(sum - tgt), pct = diff / tgt;
    if (diff < 0.01) return <span className="sum-ok">{sum.toLocaleString()} ✓</span>;
    const cls = pct > 0.05 ? 'sum-err' : 'sum-warn';
    return <span className={cls}>{sum.toLocaleString()} / {tgt.toLocaleString()}</span>;
  }

  return (
    <>
      {/* ── Volume Breaks ── */}
      <div className="card">
        <div className="card-hdr">
          Volume Breaks
          <button className="btn btn-add btn-sm" onClick={addBreak}>+ Add Break</button>
        </div>
        <div className="card-body">
          <table style={{ maxWidth: 620 }}>
            <thead><tr>
              <th></th>
              <th>Label <InfoIcon k="brkLabel" /></th>
              <th>Builds / Year <InfoIcon k="brkBpy" /></th>
              <th>Target Total EAU (opt.) <InfoIcon k="brkEau" /></th>
              <th></th>
            </tr></thead>
            <tbody>
              {state.breaks.map((b, i) => (
                <tr key={b.id} {...brkSort.dragProps(i)} className={brkSort.rowClass(i)}>
                  <td className="drag-h">&#9776;</td>
                  <td><input type="text" value={b.label} onChange={e => setBreak(i, 'label', e.target.value)} /></td>
                  <td><input type="number" min={1} value={b.buildsPerYear} onChange={e => setBreak(i, 'buildsPerYear', Number(e.target.value) || 1)} /></td>
                  <td><input type="number" min={0} value={b.totalEAU || ''} placeholder="optional" onChange={e => setBreak(i, 'totalEAU', Number(e.target.value) || 0)} /></td>
                  <td>
                    {state.breaks.length > 1 && (
                      <button className="btn btn-del btn-sm" onClick={() => deleteBreak(i)}>✕</button>
                    )}
                    {state.breaks.length <= 1 && <span style={{ fontSize: 11, color: '#aaa' }}>min 1</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Finished Goods ── */}
      <div className="card">
        <div className="card-hdr">
          Finished Goods — EAU per Break <InfoIcon k="fgEau" />
          <button className="btn btn-add btn-sm" onClick={addFG}>+ Add FG</button>
        </div>
        <div className="card-body">
          {state.finishedGoods.length === 0 && <p className="empty-msg">No finished goods yet.</p>}
          {state.finishedGoods.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th></th>
                  <th>FG Name <InfoIcon k="fgName" /></th>
                  <th>Description</th>
                  {state.breaks.map((b, j) => {
                    const hasData = state.finishedGoods.some(fg => Number((fg.breaks[j] || {}).eau) > 0);
                    const tgt = Number(b.totalEAU) || 0;
                    return (
                      <th key={b.id} style={{ textAlign: 'center', minWidth: 90 }}>
                        {b.label}<br />
                        <span style={{ fontWeight: 400, fontSize: 11 }}>{b.buildsPerYear}×/yr{tgt > 0 ? ` | tgt: ${tgt.toLocaleString()}` : ''}</span>
                        {hasData && state.breaks.length > 1 && (
                          <><br />
                          <button className="btn-mix" onClick={() => {
                            let next = state;
                            state.breaks.forEach((_, k) => { if (k !== j && Number(state.breaks[k].totalEAU) > 0) next = applyMix(next, j, k); });
                            onUpdate(next);
                          }}>→ Push mix</button></>
                        )}
                      </th>
                    );
                  })}
                  <th></th>
                </tr></thead>
                <tbody>
                  {state.finishedGoods.map((fg, i) => (
                    <tr key={fg.id} {...fgSort.dragProps(i)} className={fgSort.rowClass(i)}>
                      <td className="drag-h">&#9776;</td>
                      <td><input type="text" value={fg.name} onChange={e => setFGField(i, 'name', e.target.value)} /></td>
                      <td><input type="text" value={fg.description ?? ''} onChange={e => setFGField(i, 'description', e.target.value)} /></td>
                      {state.breaks.map((_, j) => (
                        <td key={j} style={{ textAlign: 'center' }}>
                          <input type="number" min={0}
                            value={Number((fg.breaks[j] || {}).eau) || ''}
                            onChange={e => setEAU(i, j, e.target.value)} />
                        </td>
                      ))}
                      <td><button className="btn btn-del btn-sm" onClick={() => deleteFG(i)}>✕</button></td>
                    </tr>
                  ))}
                  {/* Sum row */}
                  <tr className="sum-row">
                    <td></td>
                    <td colSpan={2} style={{ textAlign: 'right', color: '#555' }}>EAU Sum →</td>
                    {state.breaks.map((_, j) => (
                      <td key={j} style={{ textAlign: 'center' }}>{sumCell(j)}</td>
                    ))}
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
