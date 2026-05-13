'use client';

import type { AppState } from '@/lib/calculations';
import { calcCosts, totalOrderQty, totalAnnualUnits } from '@/lib/calculations';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
}

function fmt4(n: number) { return isNaN(n) ? '—' : n.toFixed(4); }
function fmtC(n: number, d = 2) {
  return isNaN(n) ? '—' : '$' + n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtN(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

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

export default function SummaryTab({ state, onUpdate }: Props) {
  const fgs  = state.finishedGoods;
  const brks = state.breaks;

  if (!fgs.length || !brks.length) {
    return <div className="card"><div className="card-body"><p className="empty-msg">Add finished goods and volume breaks first.</p></div></div>;
  }

  function setMargin(fgId: string, bki: number, value: string) {
    const key = `${fgId}|${bki}`;
    onUpdate({ ...state, margins: { ...state.margins, [key]: parseFloat(value) || 0 } });
  }

  const brkHdr = brks.map(b => (
    <th key={b.id} style={{ textAlign: 'right', minWidth: 115 }}>
      {b.label}<br />
      <span style={{ fontWeight: 400, fontSize: 11 }}>{b.buildsPerYear}×/yr</span>
    </th>
  ));

  const rows: React.ReactNode[] = [];

  fgs.forEach((fg, fi) => {
    // FG header
    rows.push(
      <tr key={`hdr-${fg.id}`} style={{ background: '#e8f0fe' }}>
        <td colSpan={brks.length + 1} style={{ padding: '8px 9px 5px', fontWeight: 700, fontSize: 13, color: '#1a2940' }}>
          {fg.name}
          {fg.description && <span style={{ fontWeight: 400, color: '#666', fontSize: 12 }}> — {fg.description}</span>}
        </td>
      </tr>
    );

    // Cost breakdown rows
    CATS.forEach(([lbl, key, isSub]) => {
      rows.push(
        <tr key={`${fg.id}-${key}`} className={isSub ? 'sub' : ''}>
          <td style={{ paddingLeft: isSub ? 20 : 9, color: isSub ? '#555' : undefined, fontSize: isSub ? 11.5 : undefined }}>{lbl}</td>
          {brks.map((_, j) => {
            const c = calcCosts(state, fi, j);
            if (!c || c.eau === 0) return <td key={j} style={{ textAlign: 'right', color: '#aaa' }}>N/A</td>;
            const v = (c as Record<string, number>)[key];
            if (c.matIncomplete && key === 'mat') {
              return <td key={j} style={{ textAlign: 'right', fontFamily: 'monospace' }} className="inc">{fmt4(v)} ⚠</td>;
            }
            return <td key={j} style={{ textAlign: 'right', fontFamily: 'monospace', color: isSub ? '#555' : undefined }}>{fmt4(v)}</td>;
          })}
        </tr>
      );
    });

    // Total row
    rows.push(
      <tr key={`${fg.id}-tot`} className="tot">
        <td>TOTAL / UNIT</td>
        {brks.map((_, j) => {
          const c = calcCosts(state, fi, j);
          if (!c || c.eau === 0) return <td key={j} style={{ textAlign: 'right' }}>N/A</td>;
          return <td key={j} style={{ textAlign: 'right', fontFamily: 'monospace' }} className={c.matIncomplete ? 'inc' : ''}>{fmtC(c.total, 4)}</td>;
        })}
      </tr>
    );

    // Annual cost
    rows.push(
      <tr key={`${fg.id}-ann`} style={{ fontSize: 11.5, color: '#666', background: '#fafbfd' }}>
        <td>Annual cost (×EAU)</td>
        {brks.map((_, j) => {
          const c = calcCosts(state, fi, j);
          if (!c || !c.eau) return <td key={j} style={{ textAlign: 'right', color: '#aaa' }}>—</td>;
          return <td key={j} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtC(c.total * c.eau, 0)}</td>;
        })}
      </tr>
    );

    // Margin %
    rows.push(
      <tr key={`${fg.id}-mg`} style={{ background: '#fef9f0' }}>
        <td style={{ color: '#92400e', fontWeight: 600 }}>Margin %</td>
        {brks.map((_, j) => {
          const key = `${fg.id}|${j}`;
          const val = state.margins?.[key] ?? '';
          return (
            <td key={j} style={{ textAlign: 'right' }}>
              <input type="number" min={0} max={99.9} step={0.1}
                value={val}
                onChange={e => setMargin(fg.id, j, e.target.value)}
                style={{ width: 55, textAlign: 'right', fontFamily: 'inherit', padding: '2px 4px', fontSize: 12 }}
              /> %
            </td>
          );
        })}
      </tr>
    );

    // Sell price
    rows.push(
      <tr key={`${fg.id}-sp`} className="sell-row">
        <td>Sell Price / Unit</td>
        {brks.map((_, j) => {
          const c = calcCosts(state, fi, j);
          if (!c || c.eau === 0) return <td key={j} style={{ textAlign: 'right' }}>N/A</td>;
          const m = Number(state.margins?.[`${fg.id}|${j}`]) || 0;
          const sp = m > 0 && m < 100 ? fmtC(c.total / (1 - m / 100), 4) : '—';
          return <td key={j} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{sp}</td>;
        })}
      </tr>
    );

    // Annual sell
    rows.push(
      <tr key={`${fg.id}-as`} style={{ fontSize: 11.5, background: '#f0fdf4', color: '#166534' }}>
        <td>Annual sell (×EAU)</td>
        {brks.map((_, j) => {
          const c = calcCosts(state, fi, j);
          if (!c || !c.eau) return <td key={j} style={{ textAlign: 'right', color: '#aaa' }}>—</td>;
          const m = Number(state.margins?.[`${fg.id}|${j}`]) || 0;
          const as_ = m > 0 && m < 100 ? fmtC(c.total / (1 - m / 100) * c.eau, 0) : '—';
          return <td key={j} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{as_}</td>;
        })}
      </tr>
    );

    // Spacer
    rows.push(<tr key={`${fg.id}-sp2`}><td colSpan={brks.length + 1} style={{ padding: 3 }} /></tr>);
  });

  return (
    <div className="card">
      <div className="card-hdr">Cost Summary — $/unit</div>
      <div className="card-body">
        <div className="sw">
          <table className="stbl">
            <thead><tr><th>Cost Element</th>{brkHdr}</tr></thead>
            <tbody>
              {rows}
              <tr style={{ borderTop: '2px solid #dde', color: '#555', fontSize: 11.5 }}>
                <td>Units/build (total order)</td>
                {brks.map((_, j) => <td key={j} className="num" style={{ textAlign: 'right' }}>{fmtN(totalOrderQty(state, j))}</td>)}
              </tr>
              <tr style={{ color: '#555', fontSize: 11.5 }}>
                <td>Total annual units</td>
                {brks.map((_, j) => <td key={j} className="num" style={{ textAlign: 'right' }}>{fmtN(totalAnnualUnits(state, j))}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
