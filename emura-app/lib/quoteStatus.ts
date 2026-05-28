import type { AppState, LibraryPart, LibraryEquipment, QuoteWarning, ReviewItem } from './calculations';
import { computeQuoteWarnings, computeQuoteReview } from './calculations';

// Set to false to disable status indicators entirely (zero extra fetches, zero UI change).
export const QUOTE_STATUS_ENABLED = true;

export interface QuoteStatusEntry {
  warnCount: number;
  redCount: number;
  greenCount: number;
  warnings: QuoteWarning[];
  items: ReviewItem[];
}

export function computeStatusEntry(
  state: AppState,
  libraryParts: LibraryPart[],
  libraryEquipment: LibraryEquipment[],
): QuoteStatusEntry {
  const warnings = computeQuoteWarnings(state);
  const items    = computeQuoteReview(state, libraryParts, libraryEquipment);
  return {
    warnCount:  warnings.length,
    redCount:   items.filter(i => i.direction === 'red').length,
    greenCount: items.filter(i => i.direction === 'green').length,
    warnings,
    items,
  };
}
