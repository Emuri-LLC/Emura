'use client';

/**
 * The headline cost read-out pinned to the right of the ribbon.
 * Adaptive (computed by the caller):
 *   - primary FG selected → per-unit cost  (eyebrow "$/UNIT · …", suffix "/unit")
 *   - no primary FG       → aggregate annual cost (eyebrow "ANNUAL COST · …")
 * Presentational only. (Delta-vs-revision chip deferred.)
 */
interface AnnualCostProps {
  eyebrow: string;
  figure: string;       // formatted number without the leading "$", e.g. "5,340" or "53.40"
  unitSuffix?: string;  // e.g. "/unit"
}

export default function AnnualCost({ eyebrow, figure, unitSuffix }: AnnualCostProps) {
  return (
    <div className="mcx-annual">
      <div className="mcx-annual-block">
        <span className="mcx-annual-label">{eyebrow}</span>
        <span className="mcx-annual-fig">
          <span className="cur">$</span>{figure}{unitSuffix && <span className="unit">{unitSuffix}</span>}
        </span>
      </div>
    </div>
  );
}
