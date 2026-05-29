import type { AppState, LibraryPart, LibraryEquipment, QuoteWarning, ReviewItem } from './calculations';
import { computeQuoteWarnings, computeQuoteReview, calcCosts, resolvePrimaryIndices } from './calculations';

// Set to false to disable status indicators entirely (zero extra fetches, zero UI change).
export const QUOTE_STATUS_ENABLED = true;

export interface QuoteStatusEntry {
  warnCount: number;
  redCount: number;
  greenCount: number;
  warnings: QuoteWarning[];
  items: ReviewItem[];
  primaryTotal: number | null; // $/unit at the primary FG+break, or null if unset
}

export function computeStatusEntry(
  state: AppState,
  libraryParts: LibraryPart[],
  libraryEquipment: LibraryEquipment[],
): QuoteStatusEntry {
  const warnings = computeQuoteWarnings(state);
  const items    = computeQuoteReview(state, libraryParts, libraryEquipment);

  let primaryTotal: number | null = null;
  const { fgi, bki } = resolvePrimaryIndices(state);
  if (fgi >= 0 && bki >= 0) {
    const c = calcCosts(state, fgi, bki);
    if (c && c.eau > 0) primaryTotal = c.total;
  }

  return {
    warnCount:  warnings.length,
    redCount:   items.filter(i => i.direction === 'red').length,
    greenCount: items.filter(i => i.direction === 'green').length,
    warnings,
    items,
    primaryTotal,
  };
}
