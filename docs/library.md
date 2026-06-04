# Emura — Parts & Equipment Library

The org-wide catalogue of parts, prices, and equipment, auto-synced from quotes.
See [architecture.md](architecture.md) for the file map.

## Tables (run schema.sql block in Supabase SQL Editor to create)
- `parts` — org-wide catalogue; unique on `(org_id, part_number)`; columns include `source_quote_id` (UUID FK) and `locked` (boolean)
- `part_prices` — tiered pricing keyed by `(part_id, min_qty)` where `min_qty` is annual purchasing qty
- `equipment_library` — org-wide equipment; unique on `(org_id, name)`; columns include `source_quote_id` and `locked`
- `labor_rate_library` — org-wide labor rates; unique on `(org_id, name)`; same lock/source pattern as equipment
  - Note: `pushLaborRateToLibrary` is exported from `lib/db.ts` but is not called anywhere in the codebase. Labor rate library push is unimplemented — there is no "→ Update Library" button for labor rates in the Quote Review panel or elsewhere.

## Auto-sync (no manual data entry needed)
Every debounced cloud save calls `syncPartsToLibrary` and `syncEquipmentToLibrary` (both in `lib/db.ts`).
- Parts: upserts non-customer-supplied BOM items with a part number, then upserts each `CostEntry` from `materialCosts` as a price tier. Material costs must be entered on the Material Costs tab before prices appear.
- Equipment: upserts all named equipment entries from the quote.
- Lock behavior: if a part/equipment already exists in the library and belongs to a *different* quote (`source_quote_id != quoteId`), the entry is marked `locked=true` and the auto-sync skips it. Locked entries require a manual push via `pushPartToLibrary` / `pushEquipmentToLibrary`.
After sync, `listLibraryParts` and `listLibraryEquipment` refresh the in-memory state so Quote Review updates immediately.

## Stale closure gotcha
`cloudSave` is a `useCallback` with `[]` deps. It captures `orgCtx = null` at mount time.
`orgCtxRef` (a `useRef`) is kept in sync by the bootstrap `useEffect` and read inside `cloudSave`
so the sync always has the live org ID. Do not replace with direct state access.

## Quote Review (components/QuoteReview.tsx)
Rendered at the bottom of the Quote Info tab. Calls `computeQuoteReview()` (pure function in
`calculations.ts`) on every render — no extra fetch needed.

Matching rules:
- Parts: case-insensitive `partNumber` match; price lookup finds the highest `min_qty` tier ≤ annual purchasing qty
- Equipment: case-insensitive `name` match; compares CapEx, Run Rate, Maintenance separately

Direction:
- **Red** — library value ≥ quote value (possible cost underestimate)
- **Green** — library value < quote value (cost reduction or conservative quote)

Update actions use `applyLibraryToQuote()` (pure function in `calculations.ts`) which returns
a new `AppState` with the library values applied. Passed to `onUpdate` → goes through the normal
undo history stack. Both per-row "← Use Library" and "← Update All from Library" are undoable.

Locked entries show a "locked" badge in the Quote Review row. The per-row button for locked items
is "→ Update Library" (calls `pushPartToLibrary` / `pushEquipmentToLibrary`) rather than "← Use Library",
allowing an explicit forced push from the quote back to the shared library.

## RLS notes
- `parts` and `part_prices`: readable by all org members; writable by admin + estimator
- `equipment_library`: readable by all org members; writable by admin + estimator
  (originally admin-only — was changed after RLS failure; make sure policy reflects `role in ('admin','estimator')`)
- `part_prices` requires `unique (part_id, min_qty)` — must be added manually if table was created before the constraint was in the schema
- `equipment_library` requires `unique (org_id, name)` — same
