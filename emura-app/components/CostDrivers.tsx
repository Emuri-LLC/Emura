'use client';

import { useMemo } from 'react';
import type { AppState } from '@/lib/calculations';
import { computeCostDrivers, resolvePrimaryIndices, totalAnnualUnits } from '@/lib/calculations';
import { fmtC, fmtP } from '@/lib/format';

interface Props {
  state: AppState;
}

const CAT_COLORS: Record<string, string> = {
  'Material':       '#2563eb',
  'Direct Labor':   '#16a34a',
  'Equipment':      '#a855f7',
  'Indirect Labor': '#f59e0b',
  'Subcontract':    '#ef4444',
};

// Read-only panel: aggregated annual-dollar cost drivers across all FGs at the
// primary volume break (falls back to the highest-volume break when unset).
// Category-level and individual-level breakdowns are shown separately. Both are
// real <table>s so the estimator can drag-select and paste into an email.
export default function CostDrivers({ state }: Props) {
  const result = useMemo(() => {
    let { bki } = resolvePrimaryIndices(state);
    if (bki < 0) {
      let best = -1, bestTau = -1;
      state.breaks.forEach((_, j) => {
        const t = totalAnnualUnits(state, j);
        if (t > bestTau) { bestTau = t; best = j; }
      });
      bki = best;
    }
    if (bki < 0) return null;
    return computeCostDrivers(state, bki);
  }, [state]);

  if (!result || result.totalAnnual <= 0) {
    return (
      <div className="card">
        <div className="card-hdr">Top Cost Drivers</div>
        <div className="card-body">
          <p className="empty-msg">Add finished goods with EAU and entered costs to see cost drivers.</p>
        </div>
      </div>
    );
  }

  const maxCat     = Math.max(...result.categories.map(c => c.annualDollars), 1);
  const topDrivers = result.drivers.slice(0, 12);
  const maxDriver  = Math.max(...topDrivers.map(d => d.annualDollars), 1);

  return (
    <div className="card">
      <div className="card-hdr">
        Top Cost Drivers
        <span style={{ fontWeight: 400, fontSize: 12, color: '#888', marginLeft: 8 }}>
          annual $, all FGs @ {result.breakLabel}
        </span>
      </div>
      <div className="card-body">

        {/* Category-level */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 18 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <th style={{ textAlign: 'left',  padding: '6px 8px' }}>Category</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Annual $</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', width: 60 }}>%</th>
              <th style={{ padding: '6px 8px', width: '40%' }}></th>
            </tr>
          </thead>
          <tbody>
            {result.categories.map(c => (
              <tr key={c.category} style={{ borderBottom: '1px solid #f0f2f5' }}>
                <td style={{ padding: '6px 8px', fontWeight: 500 }}>{c.category}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtC(c.annualDollars, 0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#555' }}>{fmtP(c.pct)}</td>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ background: '#f1f5f9', borderRadius: 3, height: 14 }}>
                    <div style={{ width: `${(c.annualDollars / maxCat) * 100}%`, background: CAT_COLORS[c.category] ?? '#64748b', height: 14, borderRadius: 3 }} />
                  </div>
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #dde' }}>
              <td style={{ padding: '6px 8px', fontWeight: 700 }}>Total / year</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtC(result.totalAnnual, 0)}</td>
              <td /><td />
            </tr>
          </tbody>
        </table>

        {/* Individual-level drill-down */}
        <div style={{ fontWeight: 600, fontSize: 12, color: '#1a2940', margin: '4px 0 6px' }}>Individual cost drivers</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <th style={{ textAlign: 'left',  padding: '6px 8px' }}>Item</th>
              <th style={{ textAlign: 'left',  padding: '6px 8px' }}>Category</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Annual $</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', width: 60 }}>%</th>
              <th style={{ padding: '6px 8px', width: '30%' }}></th>
            </tr>
          </thead>
          <tbody>
            {topDrivers.map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f2f5' }}>
                <td style={{ padding: '6px 8px', fontWeight: 500 }}>{d.label}</td>
                <td style={{ padding: '6px 8px', color: '#555' }}>{d.category}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtC(d.annualDollars, 0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#555' }}>{fmtP(result.totalAnnual > 0 ? (d.annualDollars / result.totalAnnual) * 100 : 0)}</td>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ background: '#f1f5f9', borderRadius: 3, height: 12 }}>
                    <div style={{ width: `${(d.annualDollars / maxDriver) * 100}%`, background: CAT_COLORS[d.category] ?? '#64748b', height: 12, borderRadius: 3 }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.drivers.length > topDrivers.length && (
          <div style={{ color: '#9ca3af', marginTop: 6, fontSize: 11 }}>…and {result.drivers.length - topDrivers.length} more</div>
        )}

      </div>
    </div>
  );
}
