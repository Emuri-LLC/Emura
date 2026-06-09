'use client';

import { useMemo } from 'react';
import SectionCard from '@/components/mcx/SectionCard';
import { Note } from '@/components/mcx/primitives';
import type { AppState } from '@/lib/calculations';
import { calcCosts, totalOrderQty, totalAnnualUnits } from '@/lib/calculations';
import { fmt4, fmtC, fmtN } from '@/lib/format';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  resetKey?: number;
}

// Price display: always two decimals (it's a currency value). The back-solved
// margin is kept at full precision, so a 2-decimal price still round-trips to
// exactly itself on blur.
function fmtPrice(n: number): string {
  return n.toFixed(2);
}

const CATS: [string, string, boolean][] = [
  ['Material',       'mat',      false],
  ['Direct Labor',   'dl',       false],
  ['  Run',          'dlRun',    true],
  ['  Line Setup',   'dlLine',   true],
  ['  Order Setup',  'dlOrder',  true],
  ['  Equipment',    'dlEquip',  true],
  ['Indirect Labor', 'il',       false],
  ['  Annual Run',   'ilRun',    true],
  ['  Line Setup',   'ilLine',   true],
  ['  Order Setup',  'ilOrder',  true],
  ['Subcontract',    'sub',      false],
];

export default function SummaryTab({ state, onUpdate, resetKey = 0 }: Props) {
  const fgs  = state.finishedGoods;
  const brks = state.breaks;

  const costsMatrix = useMemo(() =>
    state.finishedGoods.map((_, fi) =>
      state.breaks.map((_, j) => calcCosts(state, fi, j))
    ),
  [state]);

  if (!fgs.length || !brks.length) {
    return (
      <SectionCard icon="sum" title="Cost Summary">
        <Note kind="accent">Add finished goods and volume breaks first.</Note>
      </SectionCard>
    );
  }

  // Typed margin is a 2-decimal field, so round it on entry.
  function setMargin(fgId: string, bki: number, value: string) {
    const key = `${fgId}|${bki}`;
    const next = { ...state.margins };
    if (value.trim() === '') {
      delete next[key];
    } else {
      const m = parseFloat(value);
      if (!isFinite(m)) return;
      next[key] = Math.min(99.9, Math.max(-999, Math.round(m * 100) / 100));
    }
    onUpdate({ ...state, margins: next });
  }

  // Typed sell price → back-solve the gross margin (margin = 1 − cost/price).
  // The margin is stored at FULL precision (not rounded) so the sell price the
  // user typed round-trips back to exactly itself. A price below cost yields a
  // negative (loss) margin, kept and shown in red; an empty price clears the cell.
  function setPrice(fgId: string, bki: number, total: number, value: string) {
    const key = `${fgId}|${bki}`;
    const next = { ...state.margins };
    const price = parseFloat(value);
    if (!isFinite(price) || price <= 0) {
      delete next[key];
    } else {
      const margin = (1 - total / price) * 100;
      next[key] = Math.min(99.9, Math.max(-999, margin));
    }
    onUpdate({ ...state, margins: next });
  }

  const brkHdr = brks.map(b => (
    <th key={b.id} className="ta-r" style={{ minWidth: 115 }}>
      {b.label}<br />
      <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--ink-4)' }}>{b.buildsPerYear}×/yr</span>
    </th>
  ));

  const rows: React.ReactNode[] = [];

  fgs.forEach((fg, fi) => {
    // FG header
    rows.push(
      <tr key={`hdr-${fg.id}`} style={{ background: 'var(--accent-tint)' }}>
        <td colSpan={brks.length + 1} style={{ padding: '8px 9px 5px', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
          {fg.name}
          {fg.description && <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 12 }}> — {fg.description}</span>}
        </td>
      </tr>
    );

    // Cost breakdown rows
    CATS.forEach(([lbl, key, isSub]) => {
      rows.push(
        <tr key={`${fg.id}-${key}`}>
          <td style={{ paddingLeft: isSub ? 20 : 9, color: isSub ? 'var(--ink-3)' : undefined, fontSize: isSub ? 11.5 : undefined }}>{lbl}</td>
          {brks.map((_, j) => {
            const c = costsMatrix[fi][j];
            if (!c || c.eau === 0) return <td key={j} className="ta-r" style={{ color: 'var(--ink-4)' }}>N/A</td>;
            const v = (c as unknown as Record<string, number>)[key];
            if (c.matIncomplete && key === 'mat') {
              return <td key={j} className="ta-r mono" style={{ color: 'var(--warn)' }}>{fmt4(v)} ⚠</td>;
            }
            return <td key={j} className="ta-r mono" style={{ color: isSub ? 'var(--ink-3)' : undefined }}>{fmt4(v)}</td>;
          })}
        </tr>
      );
    });

    // Total row
    rows.push(
      <tr key={`${fg.id}-tot`} style={{ fontWeight: 700 }}>
        <td>TOTAL / UNIT</td>
        {brks.map((_, j) => {
          const c = costsMatrix[fi][j];
          if (!c || c.eau === 0) return <td key={j} className="ta-r">N/A</td>;
          return <td key={j} className="ta-r mono" style={{ color: c.matIncomplete ? 'var(--warn)' : 'var(--ink)' }}>{fmtC(c.total, 4)}</td>;
        })}
      </tr>
    );

    // Annual cost
    rows.push(
      <tr key={`${fg.id}-ann`} style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
        <td>Annual cost (×EAU)</td>
        {brks.map((_, j) => {
          const c = costsMatrix[fi][j];
          if (!c || !c.eau) return <td key={j} className="ta-r" style={{ color: 'var(--ink-4)' }}>—</td>;
          return <td key={j} className="ta-r mono">{fmtC(c.total * c.eau, 0)}</td>;
        })}
      </tr>
    );

    // Margin %
    rows.push(
      <tr key={`${fg.id}-mg`} style={{ background: 'var(--warn-bg)' }}>
        <td style={{ color: 'var(--warn)', fontWeight: 600 }}>Margin %</td>
        {brks.map((_, j) => {
          const key = `${fg.id}|${j}`;
          const raw = state.margins?.[key];
          const hasM = raw !== undefined && raw !== null && String(raw) !== '';
          const m = Number(raw);
          const disp = hasM ? m.toFixed(2) : '';
          return (
            <td key={j} className="ta-r">
              <input className="mcx-input is-num" type="text" inputMode="decimal"
                key={`${fg.id}-${j}-mg-${hasM ? m : ''}-${resetKey}`}
                defaultValue={disp}
                onBlur={e => { if (e.target.value.trim() !== disp) setMargin(fg.id, j, e.target.value); }}
                style={{ width: 78, color: hasM && m < 0 ? 'var(--err)' : undefined }}
              /> %
            </td>
          );
        })}
      </tr>
    );

    // Sell price (editable — typing here back-solves the margin above)
    rows.push(
      <tr key={`${fg.id}-sp`} style={{ background: 'var(--accent-tint)', fontWeight: 600 }}>
        <td>Sell Price / Unit</td>
        {brks.map((_, j) => {
          const c = costsMatrix[fi][j];
          if (!c || c.eau === 0) return <td key={j} className="ta-r">N/A</td>;
          const raw = state.margins?.[`${fg.id}|${j}`];
          const hasM = raw !== undefined && raw !== null && String(raw) !== '' && Number(raw) < 100;
          const m = Number(raw);
          const sp = hasM ? c.total / (1 - m / 100) : null;
          const disp = sp != null ? fmtPrice(sp) : '';
          return (
            <td key={j} className="ta-r">
              <input className="mcx-input is-num" type="text" inputMode="decimal"
                key={`${fg.id}-${j}-sp-${hasM ? m : ''}-${c.total.toFixed(6)}-${resetKey}`}
                defaultValue={disp}
                onBlur={e => { if (e.target.value.trim() !== disp) setPrice(fg.id, j, c.total, e.target.value); }}
                placeholder="—"
                title="Type a sell price to set the margin above"
                style={{ width: 84, color: hasM && m < 0 ? 'var(--err)' : 'var(--accent-ink)', display: 'inline-block' }}
              />
            </td>
          );
        })}
      </tr>
    );

    // Annual sell
    rows.push(
      <tr key={`${fg.id}-as`} style={{ fontSize: 11.5, background: 'var(--ok-bg)', color: 'var(--ok-2)' }}>
        <td>Annual sell (×EAU)</td>
        {brks.map((_, j) => {
          const c = costsMatrix[fi][j];
          if (!c || !c.eau) return <td key={j} className="ta-r" style={{ color: 'var(--ink-4)' }}>—</td>;
          const raw = state.margins?.[`${fg.id}|${j}`];
          const hasM = raw !== undefined && raw !== null && String(raw) !== '' && Number(raw) < 100;
          const m = Number(raw);
          const as_ = hasM ? fmtC(c.total / (1 - m / 100) * c.eau, 0) : '—';
          return <td key={j} className="ta-r mono" style={{ color: m < 0 ? 'var(--err)' : undefined }}>{as_}</td>;
        })}
      </tr>
    );

    // Spacer
    rows.push(<tr key={`${fg.id}-sp2`}><td colSpan={brks.length + 1} style={{ padding: 3, background: 'transparent' }} /></tr>);
  });

  return (
    <SectionCard icon="sum" title="Cost Summary" sub="— $/unit" bodyPad={false}>
      <div style={{ overflowX: 'auto' }}>
        <table className="mcx-table">
          <thead><tr><th>Cost Element</th>{brkHdr}</tr></thead>
          <tbody>
            {rows}
            <tr style={{ borderTop: '2px solid var(--border-strong)', color: 'var(--ink-3)', fontSize: 11.5 }}>
              <td>Units per lot (Σ all FGs)</td>
              {brks.map((_, j) => <td key={j} className="ta-r mono">{fmtN(totalOrderQty(state, j))}</td>)}
            </tr>
            <tr style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>
              <td>Total annual units</td>
              {brks.map((_, j) => <td key={j} className="ta-r mono">{fmtN(totalAnnualUnits(state, j))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
