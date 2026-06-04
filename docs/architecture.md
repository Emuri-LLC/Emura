# Emura — Architecture & File Map

Reference for where things live. See [CLAUDE.md](../CLAUDE.md) for the high-level overview.

## Repo layout
- `index.html` — original prototype, kept for reference only, NOT deployed
- `manufacturing-cost-estimator-spec.html` — product specification document
- `emura-app/` — the live Next.js application deployed to emura.io
- `emura-app/public/emura.js` — intentional stub (3-line comment); all logic is in React

## App entry
- `emura-app/app/page.tsx` — root component; owns AppState, history, resetKey; renders the `UtilBar` + `RibbonStepper` shell (editor) or `UtilBar` + `QuotesList` (list); app root is `<div id="app" className="mcx mcx-app">`
- `emura-app/app/layout.tsx` — sets metadata; loads `globals.css` **and** `mcx.css`; self-hosts Hanken Grotesk + IBM Plex Mono via `next/font/google`, exposed as `--font-hanken` / `--font-plex`
- `emura-app/app/login/page.tsx` — login/signup page (dark `.mcx`); handles both modes with toggle link

## Design system — "Stepline" dark theme (`.mcx`)
The whole app runs on a **dark-only** design system scoped under the `.mcx` class. (The previous
light theme was retired; a future light theme should be a `.mcx.theme-light` token override, not a
revival of the old chrome.)
- `emura-app/app/mcx.css` — all design tokens (cool-slate dark, ice-cyan accent `--accent:#2bc6e4`; green reserved for "complete" status) + every `.mcx-*` component rule (cards, tables, inputs, ribbon, util bar, notes, bars, chips). Also overrides the `.eq-*` selector dropdowns and drag rows for dark.
- `emura-app/app/globals.css` — now **minimal**: CSS reset, dark page background, and the few non-`.mcx` survivors (`.ii` InfoIcon tooltip, `.qdot*` status dots, `.drawer-*` shell). **Specificity note:** the old bare-tag `input[type=text]`/`select`/`table` rules were removed because they out-specified the `.mcx-*` classes (e.g. `input[type=text]` (0,1,1) beat `.mcx-input` (0,1,0)) — do not reintroduce bare-tag form/table rules.
- `emura-app/components/mcx/` — shared kit: `Icon.tsx` (inline SVG set), `NumX.tsx` (numeric input w/ steppers + affix, `defaultValue`+`onBlur`, key with `…+resetKey`), `SectionCard.tsx` (titled card + optional `+ Action` header button), `primitives.tsx` (`Chip`/`Note`/`Grip`/`Chk`/`BarX`/`HelpI`/`CAT_COLOR`), `UtilBar.tsx` (two-mode header), `RibbonStepper.tsx` (8-node tab nav + live per-tab health + Annual Cost), `AnnualCost.tsx`.
- `emura-app/lib/tabStatus.ts` — `computeTabStatuses(state)` → 8 `{status,count}` entries (`ok|err|warn|idle`) aligned to `TABS`, driving the ribbon. Reuses `computeQuoteWarnings`; memoized in `page.tsx`. **Adaptive Annual Cost** headline (`computeHeadline` in `page.tsx`): primary FG set → per-unit via `calcCosts`; else aggregate annual via `computeCostDrivers`.

## Auth & routing
- `emura-app/proxy.ts` — Next.js 16 auth gate; `/join` bypassed so unauthenticated users can accept invites
- `emura-app/lib/supabase.ts` — browser Supabase client factory (`createClient()`)
- `emura-app/app/join/page.tsx` — invite token acceptance; calls `accept_org_invite` RPC

## Cloud save & org
- `emura-app/lib/db.ts` — all Supabase query functions: `getMyOrgContext`, `listQuotes`, `loadQuote`, `createQuote`, `saveQuote`, `deleteQuote`, `saveRevision`, `loadQuoteRevision`, `searchQuotes` (content search RPC), library sync/list helpers, org/site/dept/member management, `createInvite`
- `emura-app/supabase/schema.sql` — full schema: tables, RLS policies, `handle_new_user` trigger, `accept_org_invite` RPC, `quote_search_text`/`search_quotes` content-search functions + `quotes_search_idx` GIN index
- `emura-app/lib/quoteStatus.ts` — `computeStatusEntry()` builds the quotes-list status dot AND the primary `primaryTotal` ($/unit); `QUOTE_STATUS_ENABLED` kill switch

## Logic
- `emura-app/lib/calculations.ts` — all cost math as pure functions; defines all TypeScript interfaces
- `emura-app/lib/state.ts` — uid(), parseFraction(), defaultState(), migrateState(), loadState(), saveState()
- `emura-app/lib/sanitize.ts` — `sanitizeNotes()`; see [security.md](security.md)

## Components
- `emura-app/components/QuotesList.tsx` — quote picker; entry point before a quote is open
- `emura-app/components/AdminDrawer.tsx` — slide-out settings panel (admin only); sites/depts/users/invite
  - Users tab: current user's row is **read-only** (shows "(you)" badge, no role/dept selects, no Remove button). Other rows are immediately editable (onChange fires API call immediately).
  - Email resolution uses `get_org_member_emails(p_org_id)` security-definer RPC — NOT a direct `org_invites` query.
  - `currentUserId` prop must come from `userId` state in `page.tsx` (the actual `auth.users` UUID). **Bug in earlier code**: was incorrectly passing `orgCtx.orgId` (the org UUID) instead, so the current user's row was never detected as self and was not read-only. Correct: `currentUserId={userId}`.
- `emura-app/components/QuoteReview.tsx` — library vs quote comparison panel at bottom of Quote Info tab; see [library.md](library.md)
- `emura-app/components/CostDrivers.tsx` — top-cost-drivers panel on Quote Info (pure `computeCostDrivers`); category + drill-down tables, top 7 + "Show all"
- `emura-app/components/RevisionCompare.tsx` — modal launched from the header (open quote); diffs two revisions/working draft via pure `computeRevisionDiff`
- `emura-app/components/InfoIcon.tsx` — tooltip ⓘ icons with TIPS lookup object
- `emura-app/components/EquipmentSelector.tsx` — searchable checkbox dropdown with chip display; shows "From this quote" / "From library" sections
- `emura-app/components/LaborRateSelector.tsx` — single-select rate picker; same two-section structure as EquipmentSelector

## Tabs (`emura-app/components/tabs/`)
- `QuoteInfoTab.tsx` — quote name, customer, notes (supports images); Labor Rates card replaces shopRate/indirectRate inputs; "Revision Note" field (cleared after first edit post-rev-save); renders `QuoteReview` then `CostDrivers` below the cards
- `FinishedGoodsTab.tsx` — FG list with EAU, mix, description; **Primary FG + Break** picker (two selects writing `primaryFgId`/`primaryBreakId`). **Volume Breaks live here**, not on Quote Info.
- `BOMTab.tsx` — common + FG-specific BOM items with drag sort; part number field shows "from this quote" / "from library" autocomplete; **Std** checkbox flags a standard (flat-price) material
- `MaterialCostsTab.tsx` — cost entries per part/break with source field; standard items render a single flat-price input (writes an annualQty=0 entry) instead of per-break cells
- `EquipmentTab.tsx` — CapEx equipment entries; "From library" chips for copy-on-use
- `OperationsTab.tsx` — direct ops, indirect ops, subcontract on one tab; Rate column (LaborRateSelector) for each op; grey **pc/hr** helper per direct op + a line-rate banner when a primary FG+break is set
- `SummaryTab.tsx` — cost breakdown table + margin/sell price per FG per break
- `MfgSummaryTab.tsx` — manufacturing summary: takt/cycle, equipment utilization, DL hours per FG/break, IL hours factory-wide (indirect "Setup %" row removed)

## Hooks
- `emura-app/hooks/useDragSort.ts` — HTML5 DnD reorderable rows; returns dragProps() and rowClass()

## Feature notes
- **Primary FG + Break**: each quote can select a "primary" finished good + volume break (picker on the Finished Goods tab; `primaryFgId`/`primaryBreakId`). Drives the quote-list **Est. $/unit** column, the Operations **pc/hr** helpers, and the default scope of the Cost Drivers panel.
- **Cost Drivers** panel (bottom of Quote Info tab, below Quote Review): annual-$ cost breakdown aggregated across all FGs at the primary break — category table + individual drill-down (top 7 with a "Show all" toggle), copy-paste-friendly tables, CSS-div bars (no chart dependency).
- **Standard materials**: a BOM item flagged `standard` has one flat price that applies at any volume (Std checkbox on BOM tab; single flat-price input on Material Costs tab).
- **Advanced search**: the quotes list has a separate "Search within quotes" box that runs a server-side `search_quotes` RPC over quote content (part numbers, equipment names, labor rate names, notes); name/customer matches rank above content-only matches (badged "in contents"). The original name/customer filter box is retained.
- **Revision Compare**: a "Compare" button in the header (open quote) launches a modal diffing any two saved revisions or the working draft — field-by-field changes plus per-FG/break cost deltas.
- **Org hierarchy**: organizations → sites → departments; users are org_members with a role. Roles: `admin` (full access + settings), `estimator` (create/edit quotes), `viewer` (read-only). Auto-creates org + Main Site + General dept on signup via `handle_new_user` trigger. Token-based invite flow: admin generates link → `/join?token=...` → recipient signs up/in → auto-joined. `getMyOrgContext` uses `order('created_at', desc).limit(1).maybeSingle()` to handle users with duplicate org_members rows (trigger self-org + invite-accepted org).
- **Undo/redo**: history stack in `page.tsx` (39-state depth); Export/Import as JSON also available.
