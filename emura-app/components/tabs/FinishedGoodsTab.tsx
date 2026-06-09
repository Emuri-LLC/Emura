'use client';

import { useDragSort } from '@/hooks/useDragSort';
import { TIPS } from '@/components/InfoIcon';
import SectionCard from '@/components/mcx/SectionCard';
import NumX from '@/components/mcx/NumX';
import { Grip, Chip, Note, HelpI } from '@/components/mcx/primitives';
import Icon from '@/components/mcx/Icon';
import type { AppState, Break, FinishedGood } from '@/lib/calculations';
import { uid } from '@/lib/state';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  resetKey?: number;
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
    breaks[dstBki] = { ...(breaks[dstBki] || {}), eau: Math.round(pct * dstTotal) };
    return { ...fg, breaks };
  });
  return { ...state, finishedGoods: fgs };
}

export default function FinishedGoodsTab({ state, onUpdate, resetKey = 0 }: Props) {
  const brkSort = useDragSort(state.breaks, brks => onUpdate({ ...state, breaks: brks }));
  const fgSort  = useDragSort(state.finishedGoods, fgs => onUpdate({ ...state, finishedGoods: fgs }));

  function setBreak(i: number, field: keyof Break, value: string | number) {
    const breaks = state.breaks.map((b, idx) => idx === i ? { ...b, [field]: value } : b);
    let next: AppState = { ...state, breaks };
    if (field === 'totalEAU' && i > 0 && Number(value) > 0) {
      const srcTotal = totalAnnualUnits(state.finishedGoods, 0);
      const dstEmpty = !state.finishedGoods.some(fg => Number((fg.breaks[i] || {}).eau) > 0);
      if (srcTotal > 0 && dstEmpty) next = applyMix(next, 0, i);
    }
    onUpdate(next);
  }

  function setFGField(i: number, field: 'name' | 'description', value: string) {
    const fgs = state.finishedGoods.map((fg, idx) => idx === i ? { ...fg, [field]: value } : fg);
    onUpdate({ ...state, finishedGoods: fgs });
  }

  function setEAU(fgi: number, bki: number, value: number) {
    const fgs = state.finishedGoods.map((fg, i) => {
      if (i !== fgi) return fg;
      const breaks = [...(fg.breaks || [])];
      while (breaks.length <= bki) breaks.push({});
      const cur = { ...breaks[bki] };           // merge — never wipe a per-FG runs/yr override
      if (value > 0) cur.eau = value; else delete cur.eau;
      breaks[bki] = cur;
      return { ...fg, breaks };
    });
    onUpdate({ ...state, finishedGoods: fgs });
  }

  // Per-FG line runs (lots) per year at a break. Empty/0 → inherit the break's Orders/Year.
  function setFGRuns(fgi: number, bki: number, value: number) {
    const fgs = state.finishedGoods.map((fg, i) => {
      if (i !== fgi) return fg;
      const breaks = [...(fg.breaks || [])];
      while (breaks.length <= bki) breaks.push({});
      const cur = { ...breaks[bki] };
      if (value > 0) cur.runsPerYear = value; else delete cur.runsPerYear;
      breaks[bki] = cur;
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

  function setPrimary(field: 'primaryFgId' | 'primaryBreakId', value: string) {
    onUpdate({ ...state, [field]: value });
  }

  function sumCell(j: number) {
    const sum = totalAnnualUnits(state.finishedGoods, j);
    const tgt = Number(state.breaks[j]?.totalEAU) || 0;
    if (!tgt) return <span className="mono">{sum.toLocaleString()}</span>;
    const diff = Math.abs(sum - tgt), pct = diff / tgt;
    if (diff < 0.01) return <span className="mono" style={{ color: 'var(--ok-2)' }}>{sum.toLocaleString()} ✓</span>;
    const col = pct > 0.05 ? 'var(--err)' : 'var(--warn)';
    return <span className="mono" style={{ color: col }}>{sum.toLocaleString()} / {tgt.toLocaleString()}</span>;
  }

  return (
    <>
      {/* ── Volume Breaks ── */}
      <SectionCard icon="layers" title="Volume Breaks" sub="— order events / year that drive every downstream calc" action="Add Break" onAction={addBreak} bodyPad={false}>
        <div className="mcx-table-wrap" style={{ margin: 16, maxWidth: 640 }}>
          <table className="mcx-table">
            <thead><tr>
              <th style={{ width: 26 }} />
              <th>Label <HelpI tip={TIPS.brkLabel} /></th>
              <th className="ta-r">Orders / Year <HelpI tip={TIPS.brkBpy} /></th>
              <th className="ta-r">Target Total EAU <HelpI tip={TIPS.brkEau} /></th>
              <th style={{ width: 40 }} />
            </tr></thead>
            <tbody>
              {state.breaks.map((b, i) => (
                <tr key={b.id} {...brkSort.dragProps(i)} className={brkSort.rowClass(i)}>
                  <td className="drag-h"><Grip /></td>
                  <td><input className="mcx-input" key={b.id + '-label-' + resetKey} defaultValue={b.label} onBlur={e => setBreak(i, 'label', e.target.value)} /></td>
                  <td className="ta-r"><NumX value={b.buildsPerYear} min={1} key={b.id + '-bpy-' + resetKey} width={96} onCommit={v => setBreak(i, 'buildsPerYear', v || 1)} /></td>
                  <td className="ta-r"><NumX value={b.totalEAU || 0} min={0} blankZero placeholder="optional" key={b.id + '-eau-' + resetKey} width={110} onCommit={v => setBreak(i, 'totalEAU', v || 0)} /></td>
                  <td className="ta-c">
                    {state.breaks.length > 1
                      ? <button className="mcx-btn is-sm is-quiet is-icon" style={{ color: 'var(--err)' }} onClick={() => deleteBreak(i)}><Icon name="x" size={13} /></button>
                      : <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>min 1</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Finished Goods ── */}
      <SectionCard
        icon="layers" title="Finished Goods" sub="— end items this quote produces; EAU per break"
        action="Add FG" onAction={addFG} bodyPad={false}
        right={
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--ink-3)', marginRight: 6 }}>
            Primary break
            <select className="mcx-input" style={{ height: 26, width: 130, fontSize: 12 }}
              value={state.primaryBreakId ?? ''} onChange={e => setPrimary('primaryBreakId', e.target.value)}>
              <option value="">—</option>
              {state.breaks.map(b => <option key={b.id} value={b.id}>{b.label || '(unnamed)'}</option>)}
            </select>
          </label>
        }
      >
        {state.finishedGoods.length === 0 && (
          <div style={{ padding: 16 }}><Note kind="accent">No finished goods yet — add one to start. The <b>Primary</b> FG + break sets takt and the line rate for shared operations.</Note></div>
        )}
        {state.finishedGoods.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="mcx-table is-top">
              <thead><tr>
                <th style={{ width: 26 }} />
                <th>FG Name <HelpI tip={TIPS.fgName} /></th>
                <th>Description</th>
                {state.breaks.map((b, j) => {
                  const hasData = state.finishedGoods.some(fg => Number((fg.breaks[j] || {}).eau) > 0);
                  const tgt = Number(b.totalEAU) || 0;
                  return (
                    <th key={b.id} className="ta-r" style={{ minWidth: 110 }}>
                      {b.label}
                      <div style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)' }}>
                        {b.buildsPerYear}×/yr{tgt > 0 ? ` · tgt ${tgt.toLocaleString()}` : ''}
                      </div>
                      {hasData && state.breaks.length > 1 && (
                        <button className="mcx-btn is-sm is-quiet" style={{ color: 'var(--accent-ink)', height: 20, marginTop: 2 }}
                          onClick={() => {
                            let next = state;
                            state.breaks.forEach((_, k) => { if (k !== j && Number(state.breaks[k].totalEAU) > 0) next = applyMix(next, j, k); });
                            onUpdate(next);
                          }}>→ Push mix</button>
                      )}
                    </th>
                  );
                })}
                <th className="ta-c">Primary</th>
                <th style={{ width: 40 }} />
              </tr></thead>
              <tbody>
                {state.finishedGoods.map((fg, i) => (
                  <tr key={fg.id} {...fgSort.dragProps(i)} className={fgSort.rowClass(i)}>
                    <td className="drag-h"><Grip /></td>
                    <td><input className="mcx-input is-mono" style={{ width: 120 }} key={fg.id + '-name-' + resetKey} defaultValue={fg.name} onBlur={e => setFGField(i, 'name', e.target.value)} /></td>
                    <td><input className="mcx-input" style={{ minWidth: 220 }} key={fg.id + '-desc-' + resetKey} defaultValue={fg.description ?? ''} onBlur={e => setFGField(i, 'description', e.target.value)} /></td>
                    {state.breaks.map((bk, j) => {
                      const eau   = Number((fg.breaks[j] || {}).eau) || 0;
                      const runs  = Number((fg.breaks[j] || {}).runsPerYear) || 0;
                      const ordrs = Number(bk.buildsPerYear) || 1;
                      const qpl   = eau > 0 ? Math.round(eau / (runs || ordrs)) : 0;
                      return (
                        <td key={j} className="ta-r">
                          <NumX value={eau} min={0} blankZero width={96}
                            key={fg.id + '-' + j + '-eau-' + resetKey} onCommit={v => setEAU(i, j, v)} />
                          <div style={{ marginTop: 4, display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>runs/yr</span>
                            <NumX value={runs} min={0} blankZero width={56} placeholder={String(ordrs)}
                              key={fg.id + '-' + j + '-runs-' + resetKey} onCommit={v => setFGRuns(i, j, v)} />
                          </div>
                          {qpl > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }} className="mono">
                              {qpl.toLocaleString()}/lot
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="ta-c">
                      {state.primaryFgId === fg.id
                        ? <Chip kind="ok"><Icon name="check" size={11} sw={2.4} />Primary</Chip>
                        : <button className="mcx-btn is-sm is-quiet" style={{ color: 'var(--ink-3)' }} onClick={() => setPrimary('primaryFgId', fg.id)}>Set</button>}
                    </td>
                    <td className="ta-c"><button className="mcx-btn is-sm is-quiet is-icon" style={{ color: 'var(--err)' }} onClick={() => deleteFG(i)}><Icon name="x" size={13} /></button></td>
                  </tr>
                ))}
                <tr>
                  <td /><td colSpan={2} className="ta-r" style={{ color: 'var(--ink-3)', fontWeight: 600 }}>EAU Sum →</td>
                  {state.breaks.map((_, j) => <td key={j} className="ta-r">{sumCell(j)}</td>)}
                  <td /><td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
