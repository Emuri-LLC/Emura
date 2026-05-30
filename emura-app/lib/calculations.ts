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
  standard?: boolean; // "standard" material — one flat price applies at any volume (stored as a cost entry with annualQty=0)
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

export interface LaborRate {
  id: string;
  name: string;
  rate: number; // $/hr
}

export interface LibraryLaborRate {
  id: string;
  name: string;
  rate: number;
  locked: boolean;
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
  rateId?: string; // references state.laborRates[].id; falls back to settings.shopRate if unset
}

export interface IndirectOp {
  id: string;
  name: string;
  annualHours: number;
  orderSetupHrs: number;
  lineSetupHrs: number;
  notes: string;
  rateId?: string; // references state.laborRates[].id; falls back to settings.indirectRate if unset
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
    revision: string; // "Revision Note" — brief description cleared after rev save
    notes: string;
  };
  settings: {
    shopRate: number;    // internal default for direct ops with no rateId
    indirectRate: number; // internal default for indirect ops with no rateId
    capexYears: number;
    workingHoursPerYear: number;
  };
  laborRates: LaborRate[];
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
  primaryFgId?: string;    // selected "primary" finished good (id) for summary stats
  primaryBreakId?: string; // selected "primary" volume break (id) for summary stats
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
  locked: boolean;             // true if used in multiple quotes — auto-sync disabled
}

export interface LibraryEquipment {
  id: string;
  name: string;
  capex: number;
  hourlyRunCost: number;
  annualMaintenance: number;
  locked: boolean;             // true if used in multiple quotes — auto-sync disabled
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
  locked: boolean;             // true if library entry is locked (used in multiple quotes)
}

// Returns the best applicable library price for a given annual qty:
// the highest min_qty tier that does not exceed annualQty.
export function applicablePrice(prices: LibraryPartPrice[], annualQty: number): LibraryPartPrice | null {
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
        locked: libPart.locked,
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
        locked: libEq.locked,
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

// ── Quote warnings ────────────────────────────────────────────

export type QuoteWarningKind =
  | 'missing-cost'        // BOM item has no cost entry at a break where it has qty
  | 'price-monotonicity'  // material cost increases at a higher-volume break
  | 'takt-exceeded'       // a direct op's cycle time exceeds takt
  | 'util-over-100';      // equipment utilization exceeds 100%

export interface QuoteWarning {
  kind: QuoteWarningKind;
  message: string;
  detail?: string;
}

export function computeQuoteWarnings(state: AppState): QuoteWarning[] {
  const warnings: QuoteWarning[] = [];
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 4 });

  // ── Missing material costs ──────────────────────────────────
  for (const item of state.bom) {
    if (item.customerSupplied || !item.partNumber.trim()) continue;
    for (let bki = 0; bki < state.breaks.length; bki++) {
      const aq = annualPurchQty(state, item, bki);
      if (aq > 0 && !findCost(state, item.id, aq)) {
        warnings.push({
          kind: 'missing-cost',
          message: `${item.partNumber} — no cost at ${state.breaks[bki].label}`,
          detail: `${aq.toLocaleString()} units/yr purchasing qty`,
        });
      }
    }
  }

  // ── Price monotonicity ──────────────────────────────────────
  // Prices should be non-increasing as annual purchasing qty rises.
  // Warn once per part if any higher-qty break has a higher cost than a lower-qty break.
  for (const item of state.bom) {
    if (item.customerSupplied || !item.partNumber.trim()) continue;
    const pairs: { aq: number; cost: number; label: string }[] = [];
    for (let bki = 0; bki < state.breaks.length; bki++) {
      const aq = annualPurchQty(state, item, bki);
      if (!aq) continue;
      const found = findCost(state, item.id, aq);
      if (!found) continue;
      pairs.push({ aq, cost: found.cost, label: state.breaks[bki].label });
    }
    pairs.sort((a, b) => a.aq - b.aq);
    let flagged = false;
    for (let i = 0; i < pairs.length - 1 && !flagged; i++) {
      for (let j = i + 1; j < pairs.length && !flagged; j++) {
        if (pairs[j].cost > pairs[i].cost) {
          warnings.push({
            kind: 'price-monotonicity',
            message: `${item.partNumber} — price increases at higher volume`,
            detail: `${pairs[i].label} $${fmt(pairs[i].cost)} → ${pairs[j].label} $${fmt(pairs[j].cost)}`,
          });
          flagged = true;
        }
      }
    }
  }

  // ── Takt exceeded ───────────────────────────────────────────
  for (let bki = 0; bki < state.breaks.length; bki++) {
    const info = getTaktBreakInfo(state, bki);
    if (!info) continue;
    for (const op of state.directOps) {
      const ct = n(op.cycleTimeSec);
      if (ct > 0 && ct > info.taktSec) {
        warnings.push({
          kind: 'takt-exceeded',
          message: `"${op.name || '(unnamed)'}" cycle exceeds takt at ${state.breaks[bki].label}`,
          detail: `${ct.toFixed(2)}s cycle > ${info.taktSec.toFixed(2)}s takt`,
        });
      }
    }
  }

  // ── Equipment utilization > 100% ───────────────────────────
  for (let bki = 0; bki < state.breaks.length; bki++) {
    for (const u of calcEquipUtilization(state, bki)) {
      if (u.utilPct > 100) {
        warnings.push({
          kind: 'util-over-100',
          message: `"${u.equipment.name}" utilization ${u.utilPct.toFixed(1)}% at ${state.breaks[bki].label}`,
          detail: `${u.occupiedHrs.toFixed(1)} hrs occupied of ${n(state.settings.workingHoursPerYear)} working hrs/yr`,
        });
      }
    }
  }

  return warnings;
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
  // "Standard" material: an entry with annualQty === 0 is a flat price that
  // applies at any volume. It wins over any tiered entries.
  const flat = arch.find(e => e.annualQty === 0);
  if (flat) return { cost: flat.cost, flagged: false, actualQty: 0 };
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

// Sum of each operation's utilization contribution per equipment ID across all direct ops.
function buildEquipUtilMap(state: AppState, bki: number): Map<string, number> {
  const wkHrs = n(state.settings.workingHoursPerYear) || 1;
  const tau   = totalAnnualUnits(state, bki);
  const bpy   = n((state.breaks[bki] || {}).buildsPerYear);
  const nFGs  = state.finishedGoods.length;
  const utilMap = new Map<string, number>();
  for (const op of state.directOps) {
    const ct = n(op.cycleTimeSec) / 3600;
    const os = n(op.orderSetupMin) / 60;
    const ls = n(op.lineSetupMin) / 60;
    const opUtil = (ct * tau + os * bpy + ls * bpy * nFGs) / wkHrs;
    for (const eqId of op.equipmentIds || []) {
      utilMap.set(eqId, (utilMap.get(eqId) ?? 0) + opUtil);
    }
  }
  return utilMap;
}

// Capex + maintenance for all equipment, charged once per equipment per break.
// Project-specific: capex/tau + maintenance/tau (dedicated; no capexYears amortization).
// Non-project-specific: amortized capex × util / tau + maintenance × util / tau.
export function calcEquipCapexCosts(state: AppState, bki: number): number {
  const cyrs = n(state.settings.capexYears) || 1;
  const tau  = totalAnnualUnits(state, bki);
  if (tau <= 0) return 0;
  let cost = 0;
  for (const [eqId, util] of buildEquipUtilMap(state, bki)) {
    const eq = state.equipment.find(e => e.id === eqId);
    if (!eq) continue;
    if (eq.projectSpecific) {
      cost += n(eq.capex) / tau;
      cost += n(eq.annualMaintenance) / tau;
    } else {
      cost += (n(eq.capex) / cyrs) * util / tau;
      cost += n(eq.annualMaintenance) * util / tau;
    }
  }
  return cost;
}

// Run cost (hourlyRunCost × cycleTime) per operation for all equipment.
// hourlyRunCost reflects active machine time only — varies correctly by assigned operations.
export function calcEquipCost(state: AppState, op: DirectOp, _bki: number): number {
  const ct = n(op.cycleTimeSec) / 3600;
  let cost = 0;
  for (const eqId of op.equipmentIds || []) {
    const eq = state.equipment.find(e => e.id === eqId);
    if (!eq) continue;
    cost += n(eq.hourlyRunCost) * ct;
  }
  return cost;
}

// ── Rate resolution ───────────────────────────────────────────

export function resolveDirectRate(state: AppState, op: DirectOp): number {
  if (op.rateId) {
    const r = (state.laborRates ?? []).find(lr => lr.id === op.rateId);
    if (r) return r.rate;
  }
  return n(state.settings.shopRate);
}

export function resolveIndirectRate(state: AppState, op: IndirectOp): number {
  if (op.rateId) {
    const r = (state.laborRates ?? []).find(lr => lr.id === op.rateId);
    if (r) return r.rate;
  }
  return n(state.settings.indirectRate);
}

// ── Main cost rollup ──────────────────────────────────────────

export function calcCosts(
  state: AppState,
  fgi: number,
  bki: number
): CostResult | null {
  const fg = state.finishedGoods[fgi];
  if (!fg) return null;

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

  // Direct labor (per-op rates)
  let dlRun = 0, dlLine = 0, dlOrder = 0, dlEquip = 0;
  for (const op of state.directOps) {
    const ops = n(op.operators) || 1;
    const ct = n(op.cycleTimeSec) / 3600;
    const ls = n(op.lineSetupMin) / 60;
    const os = n(op.orderSetupMin) / 60;
    const rate = resolveDirectRate(state, op);
    dlRun += ct * rate * ops;
    if (qpb > 0) dlLine += ls * rate * ops / qpb;
    if (toq > 0) dlOrder += os * rate * ops / toq;
    dlEquip += calcEquipCost(state, op, bki);
  }
  dlEquip += calcEquipCapexCosts(state, bki);

  // Indirect labor (per-op rates)
  let ilRun = 0, ilLine = 0, ilOrder = 0;
  for (const op of state.indirectOps) {
    const rate = resolveIndirectRate(state, op);
    if (tau > 0) ilRun += n(op.annualHours) * rate / tau;
    if (eau > 0) ilLine += n(op.lineSetupHrs) * bpy * rate / eau;
    // Correct: divide by toq (units/order); bpy cancels with totalAnnualUnits = toq * bpy
    if (toq > 0) ilOrder += n(op.orderSetupHrs) * rate / toq;
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

// ── Manufacturing summary ─────────────────────────────────────

export interface DLHoursResult {
  runHrsPerBuild: number;     // cycle time × operators × qty/build
  lineSetupHrsPerBuild: number; // line setup hrs per build (once per FG)
  orderSetupHrsPerBuild: number; // order setup hrs allocated to this FG
  totalHrsPerBuild: number;
  runHrsPerYear: number;
  totalHrsPerYear: number;
  setupPct: number;           // (line+order setup) / total hrs, 0–100
}

export function calcDLHours(state: AppState, fgi: number, bki: number): DLHoursResult | null {
  const fg = state.finishedGoods[fgi];
  if (!fg) return null;
  const brk = state.breaks[bki];
  if (!brk) return null;

  const bpy = n(brk.buildsPerYear);
  const eau = n((fg.breaks[bki] || {}).eau);
  if (!bpy) return null;
  const qpb = eau / bpy;
  const toq = totalOrderQty(state, bki);

  let runHrs = 0, lineHrs = 0, orderHrs = 0;
  for (const op of state.directOps) {
    const ops = n(op.operators) || 1;
    const ct  = n(op.cycleTimeSec) / 3600;
    const ls  = n(op.lineSetupMin) / 60;
    const os  = n(op.orderSetupMin) / 60;
    runHrs   += ct * ops * qpb;
    lineHrs  += ls * ops;
    if (toq > 0) orderHrs += os * ops * qpb / toq;
  }

  const totalHrsPerBuild = runHrs + lineHrs + orderHrs;
  const totalHrsPerYear  = totalHrsPerBuild * bpy;
  const setupHrs         = lineHrs + orderHrs;
  const setupPct         = totalHrsPerBuild > 0 ? (setupHrs / totalHrsPerBuild) * 100 : 0;

  return {
    runHrsPerBuild: runHrs,
    lineSetupHrsPerBuild: lineHrs,
    orderSetupHrsPerBuild: orderHrs,
    totalHrsPerBuild,
    runHrsPerYear: runHrs * bpy,
    totalHrsPerYear,
    setupPct,
  };
}

export interface ILHoursResult {
  runHrsPerYear: number;
  lineSetupHrsPerYear: number;
  orderSetupHrsPerYear: number;
  totalHrsPerYear: number;
  setupPct: number;
}

export function calcILHours(state: AppState, bki: number): ILHoursResult {
  const brk = state.breaks[bki];
  const bpy = brk ? n(brk.buildsPerYear) : 0;
  const nFGs = state.finishedGoods.length || 1;

  let runHrs = 0, lineHrs = 0, orderHrs = 0;
  for (const op of state.indirectOps) {
    runHrs   += n(op.annualHours);
    lineHrs  += n(op.lineSetupHrs) * bpy;
    orderHrs += n(op.orderSetupHrs) * bpy;
  }
  // lineSetupHrs applies per FG per build — multiply by nFGs
  lineHrs *= nFGs;

  const total    = runHrs + lineHrs + orderHrs;
  const setupPct = total > 0 ? ((lineHrs + orderHrs) / total) * 100 : 0;

  return { runHrsPerYear: runHrs, lineSetupHrsPerYear: lineHrs, orderSetupHrsPerYear: orderHrs, totalHrsPerYear: total, setupPct };
}

export interface EquipUtilResult {
  equipment: Equipment;
  occupiedHrs: number;
  utilPct: number;
}

export function calcEquipUtilization(state: AppState, bki: number): EquipUtilResult[] {
  const wkHrs = n(state.settings.workingHoursPerYear) || 1;
  const utilMap = buildEquipUtilMap(state, bki);
  return Array.from(utilMap.entries())
    .map(([eqId, util]) => {
      const eq = state.equipment.find(e => e.id === eqId);
      if (!eq) return null;
      return { equipment: eq, occupiedHrs: util * wkHrs, utilPct: util * 100 };
    })
    .filter((x): x is EquipUtilResult => x !== null);
}

export interface TaktBreakInfo {
  taktSec: number;
  tau: number;
  slowestOp: DirectOp | null;
  slowestCycleSec: number;
  taktExceeded: boolean;
}

export function getTaktBreakInfo(state: AppState, bki: number): TaktBreakInfo | null {
  const tau = totalAnnualUnits(state, bki);
  const wkHrs = n(state.settings.workingHoursPerYear);
  if (!tau || !wkHrs) return null;
  const taktSec = (wkHrs * 3600) / tau;

  let slowestOp: DirectOp | null = null;
  let slowestCycleSec = 0;
  for (const op of state.directOps) {
    const ct = n(op.cycleTimeSec);
    if (ct > slowestCycleSec) { slowestCycleSec = ct; slowestOp = op; }
  }

  return {
    taktSec,
    tau,
    slowestOp,
    slowestCycleSec,
    taktExceeded: slowestCycleSec > taktSec && slowestCycleSec > 0,
  };
}

// ── Primary FG + Break ─────────────────────────────────────────
// Resolves the selected "primary" finished good / volume break IDs to array
// indices. Returns -1 for either when unset or no longer present.

export function resolvePrimaryIndices(state: AppState): { fgi: number; bki: number } {
  const fgi = state.primaryFgId ? state.finishedGoods.findIndex(f => f.id === state.primaryFgId) : -1;
  const bki = state.primaryBreakId ? state.breaks.findIndex(b => b.id === state.primaryBreakId) : -1;
  return { fgi, bki };
}

export interface OpThroughput {
  opId: string;
  pcPerHour: number;    // build qty ÷ total labor person-hours (run + setup, all operators)
  personHours: number;  // total labor person-hours for one build of the primary FG
}

export interface ThroughputResult {
  qty: number;             // units of the primary FG in one build at the primary break
  ops: OpThroughput[];
  linePcPerHour: number;   // qty ÷ Σ person-hours across all ops (each op treated as its own batch)
  linePersonHours: number;
}

// Manufacturing throughput for the primary FG + break, expressed as an effective
// labor rate. pc/hr is defined so that (build qty ÷ pc/hr) = total person-hours,
// including setup, with every operator counted (per owner spec: total labor
// content, batch per operation, not bottleneck-limited).
export function computePrimaryThroughput(state: AppState, fgi: number, bki: number): ThroughputResult | null {
  const fg = state.finishedGoods[fgi];
  const brk = state.breaks[bki];
  if (!fg || !brk) return null;
  const qty = qtyPerBuild(state, fgi, bki);
  if (qty <= 0) return null;

  const ops: OpThroughput[] = [];
  let lineHrs = 0;
  for (const op of state.directOps) {
    const operators = n(op.operators) || 1;
    const ct = n(op.cycleTimeSec) / 3600;
    const ls = n(op.lineSetupMin) / 60;
    const os = n(op.orderSetupMin) / 60;
    const runHrs   = ct * operators * qty;
    const setupHrs = (ls + os) * operators;
    const ph = runHrs + setupHrs;
    ops.push({ opId: op.id, personHours: ph, pcPerHour: ph > 0 ? qty / ph : 0 });
    lineHrs += ph;
  }
  return { qty, ops, linePersonHours: lineHrs, linePcPerHour: lineHrs > 0 ? qty / lineHrs : 0 };
}

// ── Cost drivers ───────────────────────────────────────────────
// Annual-dollar contribution of each cost element, aggregated across all FGs at
// a single volume break. Categories are derived by summing their drivers, so the
// category totals always equal the sum of the listed individual drivers.

export interface CostDriver { category: string; label: string; annualDollars: number; }
export interface CostDriverCategory { category: string; annualDollars: number; pct: number; }
export interface CostDriverResult {
  bki: number;
  breakLabel: string;
  totalAnnual: number;
  categories: CostDriverCategory[];
  drivers: CostDriver[]; // all individual drivers, sorted desc by annual $
}

const DRIVER_CATEGORIES = ['Material', 'Direct Labor', 'Equipment', 'Indirect Labor', 'Subcontract'] as const;

export function computeCostDrivers(state: AppState, bki: number): CostDriverResult | null {
  const brk = state.breaks[bki];
  if (!brk) return null;

  const drivers: CostDriver[] = [];
  const tau  = totalAnnualUnits(state, bki);
  const toq  = totalOrderQty(state, bki);
  const bpy  = n(brk.buildsPerYear);
  const cyrs = n(state.settings.capexYears) || 1;

  // Material — per BOM line
  for (const item of state.bom) {
    if (item.customerSupplied) continue;
    const aq = annualPurchQty(state, item, bki);
    const found = findCost(state, item.id, aq);
    if (!found) continue;
    let annual = 0;
    for (const fg of state.finishedGoods) {
      const eau = n((fg.breaks[bki] || {}).eau);
      const bq  = bomQtyForFG(item, fg.id);
      if (eau && bq) annual += bq * found.cost * eau;
    }
    if (annual > 0) drivers.push({ category: 'Material', label: item.partNumber || item.description || '(unnamed part)', annualDollars: annual });
  }

  // Direct labor — per op (run + line + order setup, excl. equipment)
  for (const op of state.directOps) {
    const operators = n(op.operators) || 1;
    const ct = n(op.cycleTimeSec) / 3600;
    const ls = n(op.lineSetupMin) / 60;
    const os = n(op.orderSetupMin) / 60;
    const rate = resolveDirectRate(state, op);
    let annual = 0;
    for (let fgi = 0; fgi < state.finishedGoods.length; fgi++) {
      const eau = n((state.finishedGoods[fgi].breaks[bki] || {}).eau);
      if (!eau) continue;
      const qpb = qtyPerBuild(state, fgi, bki);
      let perUnit = ct * rate * operators;
      if (qpb > 0) perUnit += ls * rate * operators / qpb;
      if (toq > 0) perUnit += os * rate * operators / toq;
      annual += perUnit * eau;
    }
    if (annual > 0) drivers.push({ category: 'Direct Labor', label: op.name || '(unnamed op)', annualDollars: annual });
  }

  // Equipment — per equipment used by ops (run + amortized capex + maintenance)
  const utilMap = buildEquipUtilMap(state, bki);
  const runPerUnit = new Map<string, number>();
  for (const op of state.directOps) {
    const ct = n(op.cycleTimeSec) / 3600;
    for (const eqId of op.equipmentIds || []) {
      const eq = state.equipment.find(e => e.id === eqId);
      if (!eq) continue;
      runPerUnit.set(eqId, (runPerUnit.get(eqId) ?? 0) + n(eq.hourlyRunCost) * ct);
    }
  }
  for (const [eqId, util] of utilMap) {
    const eq = state.equipment.find(e => e.id === eqId);
    if (!eq) continue;
    let annual = (runPerUnit.get(eqId) ?? 0) * tau;
    if (eq.projectSpecific) annual += n(eq.capex) + n(eq.annualMaintenance);
    else annual += (n(eq.capex) / cyrs) * util + n(eq.annualMaintenance) * util;
    if (annual > 0) drivers.push({ category: 'Equipment', label: eq.name || '(unnamed equip)', annualDollars: annual });
  }

  // Indirect labor — per op
  for (const op of state.indirectOps) {
    const rate = resolveIndirectRate(state, op);
    let annual = 0;
    for (const fg of state.finishedGoods) {
      const eau = n((fg.breaks[bki] || {}).eau);
      if (!eau) continue;
      let perUnit = 0;
      if (tau > 0) perUnit += n(op.annualHours) * rate / tau;
      perUnit += n(op.lineSetupHrs) * bpy * rate / eau;
      if (toq > 0) perUnit += n(op.orderSetupHrs) * rate / toq;
      annual += perUnit * eau;
    }
    if (annual > 0) drivers.push({ category: 'Indirect Labor', label: op.name || '(unnamed)', annualDollars: annual });
  }

  // Subcontract — per entry
  for (const s of state.subcontracts) {
    let annual = 0;
    for (let fgi = 0; fgi < state.finishedGoods.length; fgi++) {
      const eau = n((state.finishedGoods[fgi].breaks[bki] || {}).eau);
      if (!eau) continue;
      const qpb = qtyPerBuild(state, fgi, bki);
      let perUnit = n(s.priceEach);
      if (qpb > 0) perUnit += n(s.pricePerLine) / qpb;
      if (toq > 0) perUnit += n(s.pricePerOrder) / toq;
      if (tau > 0) perUnit += n(s.pricePerYear) / tau;
      annual += perUnit * eau;
    }
    if (annual > 0) drivers.push({ category: 'Subcontract', label: s.name || '(unnamed)', annualDollars: annual });
  }

  drivers.sort((a, b) => b.annualDollars - a.annualDollars);

  const totalAnnual = drivers.reduce((sum, d) => sum + d.annualDollars, 0);
  const categories: CostDriverCategory[] = DRIVER_CATEGORIES
    .map(cat => {
      const annualDollars = drivers.filter(d => d.category === cat).reduce((sum, d) => sum + d.annualDollars, 0);
      return { category: cat, annualDollars, pct: totalAnnual > 0 ? (annualDollars / totalAnnual) * 100 : 0 };
    })
    .filter(c => c.annualDollars > 0)
    .sort((a, b) => b.annualDollars - a.annualDollars);

  return { bki, breakLabel: brk.label, totalAnnual, categories, drivers };
}

// ── Revision compare ───────────────────────────────────────────
// Field-by-field diff between two AppState snapshots, plus cost deltas per FG
// per break. Entities are matched by id; a renamed entity shows as a changed
// "Name" field, while a truly added/removed entity is listed by name only.

export interface FieldChange { label: string; from: string; to: string; }
export interface DiffSection {
  title: string;
  added: string[];
  removed: string[];
  changed: { name: string; fields: FieldChange[] }[];
}
export interface RevCostDelta {
  fgName: string;
  breakLabel: string;
  fromTotal: number;
  toTotal: number;
  fromAnnual: number;
  toAnnual: number;
}
export interface RevisionDiff {
  sections: DiffSection[];
  costDeltas: RevCostDelta[];
  fromAnnualTotal: number;
  toAnnualTotal: number;
}

function diffEntities<T extends { id: string }>(
  title: string,
  from: T[],
  to: T[],
  nameOf: (t: T) => string,
  fieldsOf: (t: T) => Record<string, string>,
): DiffSection {
  const section: DiffSection = { title, added: [], removed: [], changed: [] };
  const fromMap = new Map(from.map(t => [t.id, t]));
  const toMap   = new Map(to.map(t => [t.id, t]));
  for (const t of from) if (!toMap.has(t.id))   section.removed.push(nameOf(t));
  for (const t of to)   if (!fromMap.has(t.id)) section.added.push(nameOf(t));
  for (const t of to) {
    const prev = fromMap.get(t.id);
    if (!prev) continue;
    const pf = fieldsOf(prev), nf = fieldsOf(t);
    const fields: FieldChange[] = [];
    for (const key of new Set([...Object.keys(pf), ...Object.keys(nf)])) {
      const a = pf[key] ?? '', b = nf[key] ?? '';
      if (a !== b) fields.push({ label: key, from: a, to: b });
    }
    if (fields.length) section.changed.push({ name: nameOf(t), fields });
  }
  return section;
}

export function computeRevisionDiff(a: AppState, b: AppState): RevisionDiff {
  const num = (v: unknown) => { const x = n(v); return Number.isInteger(x) ? String(x) : x.toFixed(2); };
  const sections: DiffSection[] = [];

  // Quote info & settings (single entity)
  const quoteFields: FieldChange[] = [];
  const qf = (label: string, av: string, bv: string) => { if ((av ?? '') !== (bv ?? '')) quoteFields.push({ label, from: av ?? '', to: bv ?? '' }); };
  qf('Quote name', a.quote.name, b.quote.name);
  qf('Customer', a.quote.customer, b.quote.customer);
  qf('Date', a.quote.date, b.quote.date);
  qf('Working hrs/yr', num(a.settings.workingHoursPerYear), num(b.settings.workingHoursPerYear));
  qf('CapEx years', num(a.settings.capexYears), num(b.settings.capexYears));
  if (quoteFields.length) sections.push({ title: 'Quote Info & Settings', added: [], removed: [], changed: [{ name: '', fields: quoteFields }] });

  sections.push(diffEntities('Labor Rates', a.laborRates ?? [], b.laborRates ?? [],
    r => r.name || '(unnamed)',
    r => ({ Name: r.name, '$/hr': num(r.rate) })));

  sections.push(diffEntities('Volume Breaks', a.breaks, b.breaks,
    br => br.label || '(unnamed)',
    br => ({ Label: br.label, 'Builds/yr': num(br.buildsPerYear), 'Target EAU': num(br.totalEAU) })));

  const breakLabel = (st: AppState, i: number) => st.breaks[i]?.label || `Break ${i + 1}`;
  sections.push(diffEntities('Finished Goods', a.finishedGoods, b.finishedGoods,
    fg => fg.name || '(unnamed)',
    fg => {
      const o: Record<string, string> = { Name: fg.name, Description: fg.description };
      fg.breaks.forEach((br, i) => { if (br && br.eau != null) o[`EAU ${breakLabel(b, i)}`] = num(br.eau); });
      return o;
    }));

  sections.push(diffEntities('Bill of Materials', a.bom, b.bom,
    it => it.partNumber || it.description || '(unnamed)',
    it => ({
      'Part #': it.partNumber, Description: it.description, UOM: it.uom,
      Qty: num(it.qty), 'FG-specific': it.fgSpecific ? 'yes' : 'no',
      'Cust. supplied': it.customerSupplied ? 'yes' : 'no',
      Standard: it.standard ? 'yes' : 'no',
      'FG qtys': JSON.stringify(it.fgQtys || {}),
    })));

  sections.push(diffEntities('Equipment', a.equipment, b.equipment,
    e => e.name || '(unnamed)',
    e => ({ Name: e.name, CapEx: num(e.capex), 'Run $/hr': num(e.hourlyRunCost), Maintenance: num(e.annualMaintenance), 'Project-specific': e.projectSpecific ? 'yes' : 'no' })));

  const rateNameMap = new Map<string, string>();
  for (const r of a.laborRates ?? []) rateNameMap.set(r.id, r.name);
  for (const r of b.laborRates ?? []) rateNameMap.set(r.id, r.name);
  const rateName = (id?: string) => id ? (rateNameMap.get(id) ?? '(default)') : '(default)';

  sections.push(diffEntities('Direct Operations', a.directOps, b.directOps,
    op => op.name || '(unnamed)',
    op => ({ Name: op.name, Rate: rateName(op.rateId), Operators: num(op.operators), 'Cycle (s)': num(op.cycleTimeSec), 'Order setup (min)': num(op.orderSetupMin), 'Line setup (min)': num(op.lineSetupMin), Equipment: String((op.equipmentIds || []).length) })));

  sections.push(diffEntities('Indirect Operations', a.indirectOps, b.indirectOps,
    op => op.name || '(unnamed)',
    op => ({ Name: op.name, Rate: rateName(op.rateId), 'Annual hrs': num(op.annualHours), 'Order setup (hrs)': num(op.orderSetupHrs), 'Line setup (hrs)': num(op.lineSetupHrs) })));

  sections.push(diffEntities('Subcontracts', a.subcontracts, b.subcontracts,
    s => s.name || '(unnamed)',
    s => ({ Name: s.name, '$/each': num(s.priceEach), '$/line': num(s.pricePerLine), '$/order': num(s.pricePerOrder), '$/year': num(s.pricePerYear) })));

  // Cost deltas — per FG (matched by id) per break (matched by id)
  const costDeltas: RevCostDelta[] = [];
  let fromAnnualTotal = 0, toAnnualTotal = 0;
  const aFgIdx = new Map(a.finishedGoods.map((fg, i) => [fg.id, i]));
  b.finishedGoods.forEach((fg, bFgi) => {
    const aFgi = aFgIdx.get(fg.id);
    b.breaks.forEach((brk, bki) => {
      const cb = calcCosts(b, bFgi, bki);
      if (!cb || cb.eau <= 0) return;
      let fromTotal = 0, fromAnnual = 0;
      if (aFgi != null) {
        const aBki = a.breaks.findIndex(x => x.id === brk.id);
        if (aBki >= 0) {
          const ca = calcCosts(a, aFgi, aBki);
          if (ca && ca.eau > 0) { fromTotal = ca.total; fromAnnual = ca.total * ca.eau; }
        }
      }
      const toAnnual = cb.total * cb.eau;
      fromAnnualTotal += fromAnnual;
      toAnnualTotal   += toAnnual;
      costDeltas.push({ fgName: fg.name || '(unnamed)', breakLabel: brk.label, fromTotal, toTotal: cb.total, fromAnnual, toAnnual });
    });
  });

  return { sections: sections.filter(s => s.added.length || s.removed.length || s.changed.length), costDeltas, fromAnnualTotal, toAnnualTotal };
}

