// ── Type Definitions ─────────────────────────────────────────

export interface Break {
  id: string;
  label: string;
  buildsPerYear: number;
  totalEAU: number;
}

export interface FGBreak {
  eau?: number;
}

export interface FinishedGood {
  id: string;
  name: string;
  description: string;
  breaks: FGBreak[];
}

export interface BOMItem {
  id: string;
  partNumber: string;
  description: string;
  uom: string;
  fgSpecific: boolean;
  customerSupplied: boolean;
  qty: number;
  fgQtys: Record<string, number>;
}

export interface CostEntry {
  annualQty: number;
  cost: number;
  timestamp: number;
}

export interface Equipment {
  id: string;
  name: string;
  capex: number;
  hourlyRunCost: number;
  annualMaintenance: number;
  projectSpecific: boolean;
}

export interface DirectOp {
  id: string;
  name: string;
  operators: number;
  cycleTimeSec: number;
  orderSetupMin: number;
  lineSetupMin: number;
  equipmentIds: string[];
  notes: string;
}

export interface IndirectOp {
  id: string;
  name: string;
  annualHours: number;
  orderSetupHrs: number;
  lineSetupHrs: number;
  notes: string;
}

export interface Subcontract {
  id: string;
  name: string;
  priceEach: number;
  pricePerLine: number;
  pricePerOrder: number;
  pricePerYear: number;
  notes: string;
}

export interface AppState {
  quote: {
    name: string;
    customer: string;
    date: string;
    revision: string;
    notes: string;
  };
  settings: {
    shopRate: number;
    indirectRate: number;
    capexYears: number;
    workingHoursPerYear: number;
  };
  breaks: Break[];
  finishedGoods: FinishedGood[];
  bom: BOMItem[];
  materialCosts: Record<string, CostEntry[]>;
  materialSources: Record<string, string>;
  equipment: Equipment[];
  directOps: DirectOp[];
  indirectOps: IndirectOp[];
  subcontracts: Subcontract[];
  margins: Record<string, number>;
}

// ── Parts & Equipment Library ─────────────────────────────────

export interface LibraryPartPrice {
  minQty: number;   // applies when annualPurchQty >= this
  unitCost: number;
  source: string;
}

export interface LibraryPart {
  id: string;
  partNumber: string;
  description: string;
  uom: string;
  prices: LibraryPartPrice[];  // sorted ascending by minQty
}

export interface LibraryEquipment {
  id: string;
  name: string;
  capex: number;
  hourlyRunCost: number;
  annualMaintenance: number;
}

export interface ReviewItem {
  kind: 'part' | 'equipment';
  itemName: string;
  breakLabel?: string;     // parts: the volume break label
  annualQty?: number;      // parts: annual purchasing qty at that break
  field?: string;          // equipment: 'CapEx' | 'Run Rate' | 'Maintenance'
  quoteValue: number;
  libraryValue: number;
  direction: 'red' | 'green'; // red = library >= quote (possible underestimate); green = library < quote
}

// Returns the best applicable library price for a given annual qty:
// the highest min_qty tier that does not exceed annualQty.
function applicablePrice(prices: LibraryPartPrice[], annualQty: number): LibraryPartPrice | null {
  const candidates = prices.filter(p => p.minQty <= annualQty);
  if (!candidates.length) return null;
  return candidates.reduce((best, p) => p.minQty > best.minQty ? p : best);
}

export function computeQuoteReview(
  state: AppState,
  libraryParts: LibraryPart[],
  libraryEquipment: LibraryEquipment[],
): ReviewItem[] {
  const items: ReviewItem[] = [];

  // ── Parts ──────────────────────────────────────────────────
  const partMap = new Map(libraryParts.map(p => [p.partNumber.trim().toLowerCase(), p]));

  for (const bomItem of state.bom) {
    if (bomItem.customerSupplied || !bomItem.partNumber.trim()) continue;
    const libPart = partMap.get(bomItem.partNumber.trim().toLowerCase());
    if (!libPart || !libPart.prices.length) continue;

    for (let bki = 0; bki < state.breaks.length; bki++) {
      const brk = state.breaks[bki];
      const aq = annualPurchQty(state, bomItem, bki);
      if (!aq) continue;

      const found = findCost(state, bomItem.id, aq);
      if (!found) continue;

      const libPrice = applicablePrice(libPart.prices, aq);
      if (!libPrice) continue;

      if (Math.abs(libPrice.unitCost - found.cost) < 0.001) continue;

      items.push({
        kind: 'part',
        itemName: bomItem.partNumber,
        breakLabel: brk.label,
        annualQty: aq,
        quoteValue: found.cost,
        libraryValue: libPrice.unitCost,
        direction: libPrice.unitCost >= found.cost ? 'red' : 'green',
      });
    }
  }

  // ── Equipment ──────────────────────────────────────────────
  const eqMap = new Map(libraryEquipment.map(e => [e.name.trim().toLowerCase(), e]));

  for (const eq of state.equipment) {
    const libEq = eqMap.get(eq.name.trim().toLowerCase());
    if (!libEq) continue;

    const checks: { field: string; quoteVal: number; libVal: number }[] = [
      { field: 'CapEx',        quoteVal: eq.capex,              libVal: libEq.capex },
      { field: 'Run Rate',     quoteVal: eq.hourlyRunCost,       libVal: libEq.hourlyRunCost },
      { field: 'Maintenance',  quoteVal: eq.annualMaintenance,   libVal: libEq.annualMaintenance },
    ];

    for (const c of checks) {
      if (Math.abs(c.libVal - c.quoteVal) < 0.01) continue;
      items.push({
        kind: 'equipment',
        itemName: eq.name,
        field: c.field,
        quoteValue: c.quoteVal,
        libraryValue: c.libVal,
        direction: c.libVal > c.quoteVal ? 'red' : 'green',
      });
    }
  }

  return items;
}

// Applies library values back to the quote for the given subset of ReviewItems.
// Pass computeQuoteReview()'s full result to update everything, or a single-item
// array to update one row. The returned state can be handed straight to onUpdate().
export function applyLibraryToQuote(state: AppState, items: ReviewItem[]): AppState {
  let next = state;

  for (const item of items) {
    if (item.kind === 'part' && item.annualQty != null) {
      const bomItem = next.bom.find(
        b => b.partNumber.trim().toLowerCase() === item.itemName.trim().toLowerCase(),
      );
      if (!bomItem) continue;
      const withCosts = { ...next, materialCosts: { ...next.materialCosts } };
      setCost(withCosts, bomItem.id, item.annualQty, item.libraryValue);
      next = withCosts;
    } else if (item.kind === 'equipment') {
      const idx = next.equipment.findIndex(
        e => e.name.trim().toLowerCase() === item.itemName.trim().toLowerCase(),
      );
      if (idx === -1) continue;
      const eq = { ...next.equipment[idx] };
      if (item.field === 'CapEx')       eq.capex              = item.libraryValue;
      if (item.field === 'Run Rate')    eq.hourlyRunCost      = item.libraryValue;
      if (item.field === 'Maintenance') eq.annualMaintenance  = item.libraryValue;
      next = { ...next, equipment: next.equipment.map((e, i) => i === idx ? eq : e) };
    }
  }

  return next;
}

export interface CostResult {
  mat: number;
  dl: number;
  dlRun: number;
  dlLine: number;
  dlOrder: number;
  dlEquip: number;
  il: number;
  ilRun: number;
  ilLine: number;
  ilOrder: number;
  sub: number;
  total: number;
  matIncomplete: boolean;
  eau: number;
}

export interface TaktInfo {
  taktSec: number;
  maxTau: number;
  maxLabel: string;
  exceeding: DirectOp[];
}

// ── Internal utility ──────────────────────────────────────────

function n(v: unknown): number {
  const num = parseFloat(String(v ?? ''));
  return isNaN(num) ? 0 : num;
}

// ── Volume calculations ───────────────────────────────────────

export function qtyPerBuild(state: AppState, fgi: number, bki: number): number {
  const fg = state.finishedGoods[fgi];
  const br = state.breaks[bki];
  if (!fg || !br || !br.buildsPerYear) return 0;
  return n((fg.breaks[bki] || {}).eau) / br.buildsPerYear;
}

export function totalOrderQty(state: AppState, bki: number): number {
  return state.finishedGoods.reduce((s, _, i) => s + qtyPerBuild(state, i, bki), 0);
}

export function totalAnnualUnits(state: AppState, bki: number): number {
  return state.finishedGoods.reduce((s, fg) => s + n((fg.breaks[bki] || {}).eau), 0);
}

// ── BOM helpers ───────────────────────────────────────────────

export function bomQtyForFG(item: BOMItem, fgId: string): number {
  if (!item.fgSpecific) return n(item.qty);
  return n((item.fgQtys || {})[fgId]);
}

export function annualPurchQty(state: AppState, item: BOMItem, bki: number): number {
  if (item.customerSupplied) return 0;
  return state.finishedGoods.reduce(
    (s, fg) => s + bomQtyForFG(item, fg.id) * n((fg.breaks[bki] || {}).eau),
    0
  );
}

// ── Material cost archive ─────────────────────────────────────

export function findCost(
  state: AppState,
  rmId: string,
  tq: number
): { cost: number; flagged: boolean; actualQty: number } | null {
  const arch = state.materialCosts[rmId] || [];
  if (!arch.length || !tq) return null;
  const ok = arch.filter(e => e.annualQty >= tq * 0.9 && e.annualQty <= tq * 10);
  if (!ok.length) return null;
  const best = ok.reduce((a, b) =>
    Math.abs(a.annualQty - tq) < Math.abs(b.annualQty - tq) ? a : b
  );
  return {
    cost: best.cost,
    flagged: Math.abs(best.annualQty - tq) / tq > 0.02,
    actualQty: best.annualQty,
  };
}

export function setCost(state: AppState, rmId: string, aq: number, cost: number): void {
  if (!state.materialCosts[rmId]) state.materialCosts[rmId] = [];
  const arch = state.materialCosts[rmId];
  const i = arch.findIndex(e => Math.abs(e.annualQty - aq) < 0.01);
  if (i >= 0) arch[i] = { annualQty: aq, cost, timestamp: Date.now() };
  else arch.push({ annualQty: aq, cost, timestamp: Date.now() });
}

// ── Equipment cost ────────────────────────────────────────────

export function calcEquipCost(state: AppState, op: DirectOp, bki: number): number {
  const { capexYears, workingHoursPerYear } = state.settings;
  const wkHrs = n(workingHoursPerYear) || 1;
  const cyrs = n(capexYears) || 1;
  const tau = totalAnnualUnits(state, bki);
  const bpy = n((state.breaks[bki] || {}).buildsPerYear);
  const nFGs = state.finishedGoods.length;
  const ct = n(op.cycleTimeSec) / 3600;
  const os = n(op.orderSetupMin) / 60;
  const ls = n(op.lineSetupMin) / 60;

  // Hours occupied per year: run + order setup + all line setups
  const occHrs = ct * tau + os * bpy + ls * bpy * nFGs;
  const util = occHrs / wkHrs;

  let cost = 0;
  for (const eqId of op.equipmentIds || []) {
    const eq = state.equipment.find(e => e.id === eqId);
    if (!eq) continue;
    if (eq.projectSpecific) {
      if (tau > 0) {
        cost += n(eq.capex) / tau;
        cost += n(eq.annualMaintenance) / tau;
      }
    } else {
      if (tau > 0) {
        cost += (n(eq.capex) / cyrs) * util / tau;
        cost += n(eq.annualMaintenance) * util / tau;
      }
    }
    cost += n(eq.hourlyRunCost) * ct;
  }
  return cost;
}

// ── Main cost rollup ──────────────────────────────────────────

export function calcCosts(
  state: AppState,
  fgi: number,
  bki: number
): CostResult | null {
  const fg = state.finishedGoods[fgi];
  if (!fg) return null;

  const { shopRate, indirectRate } = state.settings;
  const eau = n((fg.breaks[bki] || {}).eau);
  const qpb = qtyPerBuild(state, fgi, bki);
  const toq = totalOrderQty(state, bki);
  const tau = totalAnnualUnits(state, bki);
  const bpy = n((state.breaks[bki] || {}).buildsPerYear);

  // Material
  let mat = 0, matIncomplete = false;
  for (const item of state.bom) {
    if (item.customerSupplied) continue;
    const bq = bomQtyForFG(item, fg.id);
    if (!bq) continue;
    const aq = annualPurchQty(state, item, bki);
    const found = findCost(state, item.id, aq);
    if (!found) matIncomplete = true;
    else mat += bq * (found.cost || 0);
  }

  // Direct labor
  let dlRun = 0, dlLine = 0, dlOrder = 0, dlEquip = 0;
  for (const op of state.directOps) {
    const ops = n(op.operators) || 1;
    const ct = n(op.cycleTimeSec) / 3600;
    const ls = n(op.lineSetupMin) / 60;
    const os = n(op.orderSetupMin) / 60;
    dlRun += ct * shopRate * ops;
    if (qpb > 0) dlLine += ls * shopRate * ops / qpb;
    if (toq > 0) dlOrder += os * shopRate * ops / toq;
    dlEquip += calcEquipCost(state, op, bki);
  }

  // Indirect labor
  let ilRun = 0, ilLine = 0, ilOrder = 0;
  for (const op of state.indirectOps) {
    if (tau > 0) ilRun += n(op.annualHours) * indirectRate / tau;
    if (eau > 0) ilLine += n(op.lineSetupHrs) * bpy * indirectRate / eau;
    // Correct: divide by toq (units/order); bpy cancels with totalAnnualUnits = toq * bpy
    if (toq > 0) ilOrder += n(op.orderSetupHrs) * indirectRate / toq;
  }

  // Subcontracts
  let sub = 0;
  for (const s of state.subcontracts) {
    sub += n(s.priceEach);
    if (qpb > 0) sub += n(s.pricePerLine) / qpb;
    if (toq > 0) sub += n(s.pricePerOrder) / toq;
    if (tau > 0) sub += n(s.pricePerYear) / tau;
  }

  const dl = dlRun + dlLine + dlOrder + dlEquip;
  const il = ilRun + ilLine + ilOrder;

  return {
    mat, dl, dlRun, dlLine, dlOrder, dlEquip,
    il, ilRun, ilLine, ilOrder, sub,
    total: mat + dl + il + sub,
    matIncomplete,
    eau,
  };
}

// ── Takt time ─────────────────────────────────────────────────

export function getTaktInfo(state: AppState): TaktInfo | null {
  let maxTau = 0, maxLabel = '';
  state.breaks.forEach((b, j) => {
    const t = totalAnnualUnits(state, j);
    if (t > maxTau) { maxTau = t; maxLabel = b.label; }
  });
  const wkHrs = n(state.settings.workingHoursPerYear);
  if (!maxTau || !wkHrs) return null;
  const taktSec = wkHrs * 3600 / maxTau;
  const exceeding = state.directOps.filter(
    op => n(op.cycleTimeSec) > taktSec && n(op.cycleTimeSec) > 0
  );
  return { taktSec, maxTau, maxLabel, exceeding };
}

// ── Mix autofill ──────────────────────────────────────────────

export function applyMixToBreak(
  state: AppState,
  srcBki: number,
  dstBki: number
): void {
  const srcTotal = totalAnnualUnits(state, srcBki);
  if (!srcTotal) return;
  const dstTotal = n(state.breaks[dstBki].totalEAU);
  if (!dstTotal) return;
  state.finishedGoods.forEach(fg => {
    const pct = n((fg.breaks[srcBki] || {}).eau) / srcTotal;
    while (fg.breaks.length <= dstBki) fg.breaks.push({});
    fg.breaks[dstBki] = { eau: Math.round(pct * dstTotal) };
  });
}
