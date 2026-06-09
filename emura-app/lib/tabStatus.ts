import type { AppState } from './calculations';
import { computeQuoteWarnings } from './calculations';

// Status of a single tab in the Stepline ribbon.
//   ok   = complete / no blocking issues
//   err  = blocking issues present (count = how many)
//   warn = needs review (non-blocking)
//   idle = not started / not yet relevant
export type TabStatus = 'ok' | 'err' | 'warn' | 'idle';

export interface TabStatusEntry {
  status: TabStatus;
  count?: number;
}

/**
 * Live per-tab health, aligned to the TABS order in page.tsx:
 * [info, fgs, bom, matcost, equip, ops, summary, mfgsummary].
 *
 * Reuses computeQuoteWarnings — does not introduce new cost logic. Pure +
 * synchronous so it can run on every keystroke (memoize at the call site).
 */
export function computeTabStatuses(state: AppState): TabStatusEntry[] {
  const warnings = computeQuoteWarnings(state);
  const missing  = warnings.filter(w => w.kind === 'missing-cost').length;
  const review   = warnings.filter(w => w.kind === 'price-monotonicity' || w.kind === 'takt-exceeded' || w.kind === 'util-over-100').length;
  const lotsErr  = warnings.filter(w => w.kind === 'lots-under-orders').length;

  const num = (v: unknown) => Number(v) || 0;

  const hasName    = !!(state.quote.name?.trim() || state.quote.customer?.trim());
  const hasFGs     = state.finishedGoods.length > 0;
  const anyEAU     = state.finishedGoods.some(fg => (fg.breaks || []).some(b => num(b?.eau) > 0));
  const hasBom     = state.bom.some(b => b.partNumber.trim());
  const costableBom = state.bom.some(b => !b.customerSupplied && b.partNumber.trim());
  const hasEquip   = state.equipment.length > 0;
  const hasOps     = state.directOps.length > 0 || state.indirectOps.length > 0 || state.subcontracts.length > 0;

  const info: TabStatusEntry = hasName ? { status: 'ok' } : { status: 'idle' };

  const fgs: TabStatusEntry = !hasFGs
    ? { status: 'idle' }
    : !anyEAU ? { status: 'err', count: state.finishedGoods.length }
    : lotsErr > 0 ? { status: 'err', count: lotsErr }
    : { status: 'ok' };

  const bom: TabStatusEntry = !hasBom ? { status: 'idle' } : { status: 'ok' };

  const matcost: TabStatusEntry = !costableBom
    ? { status: 'idle' }
    : missing > 0
      ? { status: 'err', count: missing }
      : review > 0 ? { status: 'warn', count: review } : { status: 'ok' };

  const equip: TabStatusEntry = hasEquip ? { status: 'ok' } : { status: 'idle' };

  const ops: TabStatusEntry = hasOps ? { status: 'ok' } : { status: 'idle' };

  // Read-only roll-ups: green only when the upstream inputs are complete enough to trust.
  const ready = hasFGs && anyEAU && missing === 0;
  const summary: TabStatusEntry    = ready ? { status: 'ok' } : { status: 'idle' };
  const mfgsummary: TabStatusEntry = (ready && hasOps) ? { status: 'ok' } : { status: 'idle' };

  return [info, fgs, bom, matcost, equip, ops, summary, mfgsummary];
}
