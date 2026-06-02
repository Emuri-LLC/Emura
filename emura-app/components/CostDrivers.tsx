'use client';

import { useMemo, useState } from 'react';
import type { AppState } from '@/lib/calculations';
import { computeCostDrivers, resolvePrimaryIndices, totalAnnualUnits } from '@/lib/calculations';
import { fmtC, fmtP } from '@/lib/format';
import SectionCard from '@/components/mcx/SectionCard';
import { BarX, Note, CAT_COLOR } from '@/components/mcx/primitives';

interface Props {
  state: AppState;
}

// Read-only panel: aggregated annual-dollar cost drivers across all FGs at the
// primary volume break (falls back to the highest-volume break when unset).
const DRIVER_CAP = 7;

export default function CostDrivers({ state }: Props) {
  const [showAll, setShowAll] = useState(false);
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
      <SectionCard icon="sum" title="Top Cost Drivers">
        <Note kind="accent">Add finished goods with EAU and entered costs to see cost drivers.</Note>
      </SectionCard>
    );
  }

  const maxCat    = Math.max(...result.categories.map(c => c.annualDollars), 1);
  const shown     = showAll ? result.drivers : result.drivers.slice(0, DRIVER_CAP);
  const maxDriver = result.drivers[0]?.annualDollars ?? 1;
  const col = (cat: string) => CAT_COLOR[cat] ?? 'var(--ink-3)';

  return (
    <SectionCard icon="sum" title="Top Cost Drivers" sub={`annual $, all FGs @ ${result.breakLabel}`} bodyPad={false}>
      <div style={{ padding: '12px 16px' }}>
        {/* Category-level */}
        <table className="mcx-table" style={{ marginBottom: 18 }}>
          <thead><tr>
            <th>Category</th><th className="ta-r">Annual $</th><th className="ta-r" style={{ width: 56 }}>Share</th><th style={{ width: '42%' }} />
          </tr></thead>
          <tbody>
            {result.categories.map(c => (
              <tr key={c.category}>
                <td style={{ fontWeight: 500 }}>
                  <span className="mcx-swatch" style={{ background: col(c.category), display: 'inline-block', marginRight: 8 }} />
                  {c.category}
                </td>
                <td className="ta-r mcx-amt">{fmtC(c.annualDollars, 0)}</td>
                <td className="ta-r mcx-pct">{fmtP(c.pct)}</td>
                <td><BarX pct={(c.annualDollars / maxCat) * 100} color={col(c.category)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="mcx-tfoot">
            <td>Total / year</td>
            <td className="ta-r mcx-amt" style={{ fontWeight: 700, fontSize: 15 }}>{fmtC(result.totalAnnual, 0)}</td>
            <td /><td />
          </tr></tfoot>
        </table>

        {/* Individual-level drill-down */}
        <div className="mcx-eyebrow" style={{ margin: '4px 0 8px' }}>Individual cost drivers</div>
        <table className="mcx-table">
          <thead><tr>
            <th>Item</th><th>Category</th><th className="ta-r">Annual $</th><th className="ta-r" style={{ width: 56 }}>Share</th><th style={{ width: '30%' }} />
          </tr></thead>
          <tbody>
            {shown.map((d, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontWeight: 500 }}>{d.label}</td>
                <td style={{ color: 'var(--ink-3)' }}>{d.category}</td>
                <td className="ta-r mcx-amt">{fmtC(d.annualDollars, 0)}</td>
                <td className="ta-r mcx-pct">{fmtP(result.totalAnnual > 0 ? (d.annualDollars / result.totalAnnual) * 100 : 0)}</td>
                <td><BarX pct={(d.annualDollars / maxDriver) * 100} color={col(d.category)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.drivers.length > DRIVER_CAP && (
          <button className="mcx-btn is-sm is-quiet" style={{ marginTop: 10, color: 'var(--accent-ink)' }} onClick={() => setShowAll(s => !s)}>
            {showAll ? `Show top ${DRIVER_CAP}` : `Show all (${result.drivers.length})`}
          </button>
        )}
      </div>
    </SectionCard>
  );
}
