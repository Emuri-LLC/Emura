// Tooltip text for every user-facing input field.
// Rendered as a hoverable ⓘ icon next to labels.

export const TIPS: Record<string, string> = {
  // Quote Info
  qname:    'Identifier for this estimate. Used as the default export filename.',
  customer: 'Customer or prospect name.',
  date:     'Quote issue date.',
  rev:      'Revision identifier (e.g. A, 1.2). Increment when significant changes are made.',
  notes:    'Free-text notes. Paste an image (Ctrl+V) to embed it.',
  shopRate: 'Fully-loaded direct labor cost per operator-hour. Include wages, benefits, and direct overhead burden.',
  indRate:  'Cost per hour for indirect/overhead labor (engineering, quality, purchasing, etc.).',
  wkHrs:   'Available production hours per year per machine or cell. Used for takt time and CapEx utilization. Typical: 2,000 (1 shift) to 6,000 (3 shifts).',
  capexYrs: 'Years over which capital equipment is depreciated for time-based CapEx allocation.',
  // Finished Goods
  brkLabel: 'Descriptive name for this volume scenario (e.g. "High Vol", "1000/yr").',
  brkBpy:   'Order events per year. All FGs are built simultaneously each event.',
  brkEau:   'Optional target: total EAU across all FGs at this break. Enables mix validation and auto-fill.',
  fgName:   'Name or part number for this finished good.',
  fgDesc:   'Description or other identifier for this finished good.',
  fgEau:    'Estimated Annual Usage (units/year) for this FG at this volume break.',
  // BOM
  bomPn:      'Supplier or internal part number.',
  bomDesc:    'Material or component description.',
  bomUom:     'Unit of measure (e.g. EA, LB, FT, M, KG).',
  bomQty:     'Quantity consumed per finished good. Fractions accepted (e.g. 1/4 = 0.25).',
  bomFgSpec:  'Check to move to FG-Specific section — each FG can then have a different quantity.',
  bomCustSup: 'Check if customer-supplied. No cost attributed; excluded from Material Costs.',
  // Material costs
  matCost: 'Cost per unit at the shown annual purchasing volume. Enter supplier quote or estimated price.',
  matSrc:  'Optional. Source of this cost (supplier name, quote #, date). Use → to copy to all breaks.',
  // Equipment
  eqName:  'Descriptive name for this equipment (e.g. "Reflow Oven", "Test Fixture").',
  eqCapex: 'Total capital cost. Allocated by utilization % × (capex ÷ depreciation years).',
  eqRun:   'Variable operating cost per run hour (cycle time only). Covers utilities, consumables, wear.',
  eqMaint: 'Fixed annual maintenance cost. Allocated same as CapEx but over 1 year.',
  eqProj:  'If checked: CapEx and maintenance are spread over EAU instead of utilization %. Use for job-dedicated tooling.',
  // Direct labor
  dlName:  'Name of this work cell or operation (e.g. "SMT Assembly", "Wave Solder").',
  dlOps:   'Number of operators staffing this cell during production.',
  dlCt:    'Seconds to produce one unit (cell throughput rate). Must be ≤ takt time to meet demand.',
  dlOs:    'Minutes to set up this operation once per order event (shared across all FGs).',
  dlLs:    'Minutes to set up this operation per FG line per order event.',
  dlEq:    'Equipment used by this operation. Type to search or add new.',
  dlNotes: 'Free-text notes for this operation.',
  // Subcontracts
  subName:  'Name of this subcontracted operation or service.',
  subEa:    'Variable cost per unit produced.',
  subLine:  'Fixed cost per FG line per order event. Amortized over units on that line.',
  subOrder: 'Fixed cost per full order event. Amortized over all units in the order.',
  subYr:    'Fixed annual cost. Amortized over all annual units.',
  // Indirect labor
  ilName: 'Name of this overhead category (e.g. "Engineering", "Quality", "Purchasing").',
  ilAh:   'Total sustaining support hours/year for this category, spread over all annual units.',
  ilOs:   'Setup hours per order event for this category.',
  ilLs:   'Setup hours per FG line per order event for this category.',
};

interface Props {
  k: string;
}

export default function InfoIcon({ k }: Props) {
  return (
    <span className="ii" data-tip={TIPS[k] ?? ''}>
      &#x24D8;
    </span>
  );
}
