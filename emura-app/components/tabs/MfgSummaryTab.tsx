'use client';

import type { AppState } from '@/lib/calculations';
import { calcDLHours, calcILHours, calcEquipUtilization, getTaktBreakInfo, totalAnnualUnits } from '@/lib/calculations';
import { fmtH, fmtP, fmtN, fmtS } from '@/lib/format';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
}

export default function MfgSummaryTab({ state }: Props) {
  const fgs  = state.finishedGoods;
  const brks = state.breaks;

  if (!fgs.length || !brks.length) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="empty-msg">Add finished goods and volume breaks first.</p>
        </div>
      </div>
    );
  }

  const brkHdr = brks.map(b => (
    <th key={b.id} style={{ textAlign: 'right', minWidth: 115 }}>
      {b.label}<br />
      <span style={{ fontWeight: 400, fontSize: 11 }}>{b.buildsPerYear}×/yr</span>
    </th>
  ));

  // ── Takt & Slowest Cycle ──────────────────────────────────────
  const taktRows: React.ReactNode[] = [];
  taktRows.push(
    <tr key="takt-hdr" style={{ background: '#e8f0fe' }}>
      <td colSpan={brks.length + 1} style={{ padding: '7px 9px 4px', fontWeight: 700, fontSize: 13, color: '#1a2940' }}>
        Takt &amp; Cycle Time
      </td>
    </tr>
  );
  taktRows.push(
    <tr key="takt">
      <td style={{ paddingLeft: 9 }}>Takt Time (sec/unit)</td>
      {brks.map((_, bki) => {
        const info = getTaktBreakInfo(state, bki);
        return (
          <td key={bki} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
            {info ? fmtS(info.taktSec) : '—'}
          </td>
        );
      })}
    </tr>
  );
  taktRows.push(
    <tr key="slowest">
      <td style={{ paddingLeft: 9, color: '#555', fontSize: 11.5 }}>
        Slowest Op Cycle (sec)
      </td>
      {brks.map((_, bki) => {
        const info = getTaktBreakInfo(state, bki);
        if (!info || !info.slowestOp) return <td key={bki} style={{ textAlign: 'right', color: '#aaa' }}>—</td>;
        return (
          <td key={bki} style={{ textAlign: 'right', fontFamily: 'monospace', color: info.taktExceeded ? '#dc2626' : '#166534' }}>
            {fmtS(info.slowestCycleSec)}
            <span style={{ fontSize: 10, marginLeft: 4 }}>{info.taktExceeded ? '⚠' : '✓'}</span>
          </td>
        );
      })}
    </tr>
  );
  if (state.directOps.length === 0) {
    taktRows.push(
      <tr key="takt-none">
        <td colSpan={brks.length + 1} style={{ paddingLeft: 9, color: '#aaa', fontSize: 12 }}>No direct operations defined.</td>
      </tr>
    );
  }

  // ── Equipment Utilization ─────────────────────────────────────
  const equip = state.equipment.filter(e => e.name.trim());
  const equipRows: React.ReactNode[] = [];
  equipRows.push(
    <tr key="eq-hdr" style={{ background: '#e8f0fe' }}>
      <td colSpan={brks.length + 1} style={{ padding: '7px 9px 4px', fontWeight: 700, fontSize: 13, color: '#1a2940' }}>
        Equipment Utilization
      </td>
    </tr>
  );
  if (equip.length === 0) {
    equipRows.push(
      <tr key="eq-none">
        <td colSpan={brks.length + 1} style={{ paddingLeft: 9, color: '#aaa', fontSize: 12 }}>No equipment defined.</td>
      </tr>
    );
  } else {
    equip.forEach(eq => {
      equipRows.push(
        <tr key={`eq-${eq.id}-util`}>
          <td style={{ paddingLeft: 9, fontWeight: 500 }}>{eq.name}</td>
          {brks.map((_, bki) => {
            const utils = calcEquipUtilization(state, bki);
            const u = utils.find(u => u.equipment.id === eq.id);
            if (!u) return <td key={bki} style={{ textAlign: 'right', color: '#aaa' }}>—</td>;
            const warn = u.utilPct > 100;
            return (
              <td key={bki} style={{ textAlign: 'right', fontFamily: 'monospace', color: warn ? '#dc2626' : undefined }}>
                {fmtP(u.utilPct)} / {fmtH(u.occupiedHrs)}h
                {warn && <span style={{ fontSize: 10, marginLeft: 3 }}>⚠</span>}
              </td>
            );
          })}
        </tr>
      );
    });
  }

  // ── Direct Labor per FG ───────────────────────────────────────
  const dlRows: React.ReactNode[] = [];
  dlRows.push(
    <tr key="dl-hdr" style={{ background: '#e8f0fe' }}>
      <td colSpan={brks.length + 1} style={{ padding: '7px 9px 4px', fontWeight: 700, fontSize: 13, color: '#1a2940' }}>
        Direct Labor Hours
      </td>
    </tr>
  );

  fgs.forEach((fg, fgi) => {
    dlRows.push(
      <tr key={`dl-fghdr-${fg.id}`} style={{ background: '#f0f4ff' }}>
        <td colSpan={brks.length + 1} style={{ paddingLeft: 14, fontWeight: 600, fontSize: 12, color: '#1a2940' }}>
          {fg.name}
        </td>
      </tr>
    );
    const dlMetrics: [string, (r: ReturnType<typeof calcDLHours>) => string][] = [
      ['  hrs / build (run)',    r => fmtH(r!.runHrsPerBuild)],
      ['  hrs / build (setups)', r => fmtH(r!.lineSetupHrsPerBuild + r!.orderSetupHrsPerBuild)],
      ['  hrs / build (total)',  r => fmtH(r!.totalHrsPerBuild)],
      ['  hrs / year',           r => fmtH(r!.totalHrsPerYear)],
      ['  setup %',              r => fmtP(r!.setupPct)],
    ];
    dlMetrics.forEach(([lbl, fmt]) => {
      dlRows.push(
        <tr key={`dl-${fg.id}-${lbl}`} className="sub">
          <td style={{ paddingLeft: 22, color: '#555', fontSize: 11.5 }}>{lbl}</td>
          {brks.map((_, bki) => {
            const r = calcDLHours(state, fgi, bki);
            const tau = totalAnnualUnits(state, bki);
            if (!r || !tau) return <td key={bki} style={{ textAlign: 'right', color: '#aaa' }}>—</td>;
            return <td key={bki} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r)}</td>;
          })}
        </tr>
      );
    });
  });

  // ── Indirect Labor (factory-wide) ─────────────────────────────
  const ilRows: React.ReactNode[] = [];
  ilRows.push(
    <tr key="il-hdr" style={{ background: '#e8f0fe' }}>
      <td colSpan={brks.length + 1} style={{ padding: '7px 9px 4px', fontWeight: 700, fontSize: 13, color: '#1a2940' }}>
        Indirect Labor Hours (factory-wide)
      </td>
    </tr>
  );
  const ilMetrics: [string, (r: ReturnType<typeof calcILHours>) => string][] = [
    ['Run hrs / year',        r => fmtH(r.runHrsPerYear)],
    ['Line setup hrs / year', r => fmtH(r.lineSetupHrsPerYear)],
    ['Order setup hrs / year',r => fmtH(r.orderSetupHrsPerYear)],
    ['Total hrs / year',      r => fmtH(r.totalHrsPerYear)],
    ['Setup %',               r => fmtP(r.setupPct)],
  ];
  if (state.indirectOps.length === 0) {
    ilRows.push(
      <tr key="il-none">
        <td colSpan={brks.length + 1} style={{ paddingLeft: 9, color: '#aaa', fontSize: 12 }}>No indirect operations defined.</td>
      </tr>
    );
  } else {
    ilMetrics.forEach(([lbl, fmt]) => {
      ilRows.push(
        <tr key={`il-${lbl}`} className="sub">
          <td style={{ paddingLeft: 9, color: '#555', fontSize: 11.5 }}>{lbl}</td>
          {brks.map((_, bki) => {
            const r = calcILHours(state, bki);
            return <td key={bki} style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r)}</td>;
          })}
        </tr>
      );
    });
  }

  return (
    <div className="card">
      <div className="card-hdr">Manufacturing Summary</div>
      <div className="card-body">
        <div className="sw">
          <table className="stbl">
            <thead>
              <tr><th>Metric</th>{brkHdr}</tr>
            </thead>
            <tbody>
              {taktRows}
              <tr><td colSpan={brks.length + 1} style={{ padding: 3 }} /></tr>
              {equipRows}
              <tr><td colSpan={brks.length + 1} style={{ padding: 3 }} /></tr>
              {dlRows}
              <tr><td colSpan={brks.length + 1} style={{ padding: 3 }} /></tr>
              {ilRows}
              <tr style={{ borderTop: '2px solid #dde', color: '#555', fontSize: 11.5 }}>
                <td style={{ paddingLeft: 9 }}>Total annual units</td>
                {brks.map((_, bki) => (
                  <td key={bki} style={{ textAlign: 'right' }}>{fmtN(totalAnnualUnits(state, bki))}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
