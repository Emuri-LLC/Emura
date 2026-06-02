# Emura — Project Context

## What this is
Emura manufacturing cost estimator for contract manufacturers.
Allows estimators to quote BOM costs, direct labor, indirect
labor, and subcontracts across multiple finished goods and
volume breaks. Outputs cost per unit and sell price per FG
per volume break.

## Business
- Company: Emuri, LLC
- Product: Emura
- Owner: Ethan Meyers (ebmeyers on GitHub)
- Stage: Phase 4 complete — cloud save + org schema live at emura.io

## URLs
- Production: https://emura.io
- Vercel preview: https://emura-olive.vercel.app
- GitHub: https://github.com/Emuri-LLC/Emura

## Local development
- Project folder: /Users/eohano/Emuri/Emura
- App folder: /Users/eohano/Emuri/Emura/emura-app
- Run dev server: `cd emura-app && npm run dev`
- Local URL: http://localhost:3000

## Tech stack
- Frontend: Next.js 16 (React, App Router, TypeScript)
- Hosting: Vercel (auto-deploys on git push to main)
- Auth: Supabase (`@supabase/supabase-js` + `@supabase/ssr`) — live
- Database / Cloud save: Supabase Postgres — live (quotes stored as JSONB per user/department)
- Email: Resend (transactional auth emails via custom SMTP on emura.io domain)
- Payments: Stripe (Phase 6 — not yet implemented)
- Domain registrar: Namecheap (emura.io connected to Vercel)

## Vercel configuration (required settings)
- **Root Directory**: `emura-app` (not `./` — the Next.js app is in the subdirectory)
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - These are baked into the JS bundle at build time — changing them on Vercel requires a redeploy
  - Never commit `.env.local` — it's covered by `.env*` in `.gitignore`

## Project phases
- ✅ Phase 0: Environment setup (Node, Git, GitHub, Vercel)
- ✅ Phase 1: Get something live on Vercel
- ✅ Phase 2: Full React migration — all 8 tabs, calculations, drag-and-drop
- ✅ Phase 3: Supabase authentication — login/signup live, app gated behind auth
- ✅ Phase 4: Cloud save + org schema — quotes in Supabase JSONB, org/site/dept hierarchy, admin drawer, invite flow
- 🔜 Phase 5: Organizations and sharing — cross-user quote visibility, org switcher, share links
- Phase 6: Launch prep (Stripe subscriptions, error tracking)

## Current state (Phase 4 complete)
- `index.html`: original prototype, kept for reference only, NOT deployed
- `manufacturing-cost-estimator-spec.html`: product specification document
- `emura-app/`: the live Next.js application deployed to emura.io
- `emura-app/public/emura.js`: intentional stub (3-line comment), all logic is in React
- All 8 tabs fully functional in React: Quote Info, Finished Goods, BOM, Material Costs, Equipment, Operations, Summary, Mfg Summary
- Auth required: unauthenticated users redirected to `/login`; logout clears localStorage
- Quotes stored in Supabase (`quotes` table, JSONB `state` column) per department
- localStorage is a write-through cache — used as offline fallback only
- 1-second debounced cloud save on every state change; `saveStatus` shown in header
- App entry point is a Quotes list — open a quote to enter the tab editor
- `← Quotes` button in header returns to the list without losing the current quote
- Org hierarchy: organizations → sites → departments; users are org_members with a role
- Roles: `admin` (full access + settings), `estimator` (create/edit quotes), `viewer` (read-only)
- Auto-creates org + Main Site + General dept on signup via `handle_new_user` trigger on auth.users
- Admin gear icon (⚙) opens slide-out drawer: manage org name, sites, departments, users, invite links
- Token-based invite flow: admin generates link → `/join?token=...` → recipient signs up/in → auto-joined; invite page defaults to sign-up mode and hides the company name field
- Undo/redo via history stack in page.tsx (39-state depth); Export/Import as JSON still available
- All calculations run client-side synchronously
- Parts & equipment library: auto-synced on every cloud save; locked entries (shared across multiple quotes) can only be updated via manual "→ Update Library" push
- Quote Review panel (bottom of Quote Info tab): compares active quote against library; red = library ≥ quote (possible underestimate), green = library < quote (cost reduction available)
- `getMyOrgContext` uses `order('created_at', desc).limit(1).maybeSingle()` to handle users with duplicate org_members rows (trigger self-org + invite-accepted org)
- **Primary FG + Break**: each quote can select a "primary" finished good + volume break (picker on the Finished Goods tab; `primaryFgId`/`primaryBreakId`). Drives the quote-list **Est. $/unit** column, the Operations **pc/hr** helpers, and the default scope of the Cost Drivers panel.
- **Cost Drivers** panel (bottom of Quote Info tab, below Quote Review): annual-$ cost breakdown aggregated across all FGs at the primary break — category table + individual drill-down (top 7 with a "Show all" toggle), copy-paste-friendly tables, CSS-div bars (no chart dependency)
- **Standard materials**: a BOM item flagged `standard` has one flat price that applies at any volume (Std checkbox on BOM tab; single flat-price input on Material Costs tab)
- **Advanced search**: the quotes list has a separate "Search within quotes" box that runs a server-side `search_quotes` RPC over quote content (part numbers, equipment names, labor rate names, notes); name/customer matches rank above content-only matches (badged "in contents"). The original name/customer filter box is retained.
- **Revision Compare**: a "Compare" button in the header (open quote) launches a modal diffing any two saved revisions or the working draft — field-by-field changes plus per-FG/break cost deltas
- Mfg Summary tab: the indirect-labor section no longer shows a "Setup %" row (removed; DL section keeps its own)

## Key file locations

### App entry
- `emura-app/app/page.tsx` — root component; owns AppState, history, resetKey; renders the `UtilBar` + `RibbonStepper` shell (editor) or `UtilBar` + `QuotesList` (list); app root is `<div id="app" className="mcx mcx-app">`
- `emura-app/app/layout.tsx` — sets metadata; loads `globals.css` **and** `mcx.css`; self-hosts Hanken Grotesk + IBM Plex Mono via `next/font/google`, exposed as `--font-hanken` / `--font-plex`
- `emura-app/app/login/page.tsx` — login/signup page (dark `.mcx`); handles both modes with toggle link

### Design system — "Stepline" dark theme (`.mcx`)
The whole app runs on a **dark-only** design system scoped under the `.mcx` class. (The previous
light theme was retired; a future light theme should be a `.mcx.theme-light` token override, not a
revival of the old chrome.)
- `emura-app/app/mcx.css` — all design tokens (cool-slate dark, ice-cyan accent `--accent:#2bc6e4`; green reserved for "complete" status) + every `.mcx-*` component rule (cards, tables, inputs, ribbon, util bar, notes, bars, chips). Also overrides the `.eq-*` selector dropdowns and drag rows for dark.
- `emura-app/app/globals.css` — now **minimal**: CSS reset, dark page background, and the few non-`.mcx` survivors (`.ii` InfoIcon tooltip, `.qdot*` status dots, `.drawer-*` shell). **Specificity note:** the old bare-tag `input[type=text]`/`select`/`table` rules were removed because they out-specified the `.mcx-*` classes (e.g. `input[type=text]` (0,1,1) beat `.mcx-input` (0,1,0)) — do not reintroduce bare-tag form/table rules.
- `emura-app/components/mcx/` — shared kit: `Icon.tsx` (inline SVG set), `NumX.tsx` (numeric input w/ steppers + affix, `defaultValue`+`onBlur`, key with `…+resetKey`), `SectionCard.tsx` (titled card + optional `+ Action` header button), `primitives.tsx` (`Chip`/`Note`/`Grip`/`Chk`/`BarX`/`HelpI`/`CAT_COLOR`), `UtilBar.tsx` (two-mode header), `RibbonStepper.tsx` (8-node tab nav + live per-tab health + Annual Cost), `AnnualCost.tsx`.
- `emura-app/lib/tabStatus.ts` — `computeTabStatuses(state)` → 8 `{status,count}` entries (`ok|err|warn|idle`) aligned to `TABS`, driving the ribbon. Reuses `computeQuoteWarnings`; memoized in `page.tsx`. **Adaptive Annual Cost** headline (`computeHeadline` in `page.tsx`): primary FG set → per-unit via `calcCosts`; else aggregate annual via `computeCostDrivers`.

### Auth & routing
- `emura-app/proxy.ts` — Next.js 16 auth gate; `/join` bypassed so unauthenticated users can accept invites
- `emura-app/lib/supabase.ts` — browser Supabase client factory (`createClient()`)
- `emura-app/app/join/page.tsx` — invite token acceptance; calls `accept_org_invite` RPC

### Cloud save & org
- `emura-app/lib/db.ts` — all Supabase query functions: `getMyOrgContext`, `listQuotes`, `loadQuote`, `createQuote`, `saveQuote`, `deleteQuote`, `saveRevision`, `loadQuoteRevision`, `searchQuotes` (content search RPC), library sync/list helpers, org/site/dept/member management, `createInvite`
- `emura-app/supabase/schema.sql` — full schema: tables, RLS policies, `handle_new_user` trigger, `accept_org_invite` RPC, `quote_search_text`/`search_quotes` content-search functions + `quotes_search_idx` GIN index
- `emura-app/lib/quoteStatus.ts` — `computeStatusEntry()` builds the quotes-list status dot AND the primary `primaryTotal` ($/unit); `QUOTE_STATUS_ENABLED` kill switch

### Components
- `emura-app/components/QuotesList.tsx` — quote picker; entry point before a quote is open
- `emura-app/components/AdminDrawer.tsx` — slide-out settings panel (admin only); sites/depts/users/invite
  - Users tab: current user's row is **read-only** (shows "(you)" badge, no role/dept selects, no Remove button). Other rows are immediately editable (onChange fires API call immediately).
  - Email resolution uses `get_org_member_emails(p_org_id)` security-definer RPC — NOT a direct `org_invites` query.
  - `currentUserId` prop must come from `userId` state in `page.tsx` (the actual `auth.users` UUID). **Bug in earlier code**: was incorrectly passing `orgCtx.orgId` (the org UUID) instead, so the current user's row was never detected as self and was not read-only. Correct: `currentUserId={userId}`.
- `emura-app/components/QuoteReview.tsx` — library vs quote comparison panel at bottom of Quote Info tab
- `emura-app/components/CostDrivers.tsx` — top-cost-drivers panel on Quote Info (pure `computeCostDrivers`); category + drill-down tables, top 7 + "Show all"
- `emura-app/components/RevisionCompare.tsx` — modal launched from the header (open quote); diffs two revisions/working draft via pure `computeRevisionDiff`

### Logic
- `emura-app/lib/calculations.ts` — all cost math as pure functions; defines all TypeScript interfaces
- `emura-app/lib/state.ts` — uid(), parseFraction(), defaultState(), migrateState(), loadState(), saveState()

### Components
- `emura-app/components/InfoIcon.tsx` — tooltip ⓘ icons with TIPS lookup object
- `emura-app/components/EquipmentSelector.tsx` — searchable checkbox dropdown with chip display; shows "From this quote" / "From library" sections
- `emura-app/components/LaborRateSelector.tsx` — single-select rate picker; same two-section structure as EquipmentSelector

### Tabs (emura-app/components/tabs/)
- `QuoteInfoTab.tsx` — quote name, customer, notes (supports images); Labor Rates card replaces shopRate/indirectRate inputs; "Revision Note" field (cleared after first edit post-rev-save); renders `QuoteReview` then `CostDrivers` below the cards
- `FinishedGoodsTab.tsx` — FG list with EAU, mix, description; **Primary FG + Break** picker (two selects writing `primaryFgId`/`primaryBreakId`)
- `BOMTab.tsx` — common + FG-specific BOM items with drag sort; part number field shows "from this quote" / "from library" autocomplete; **Std** checkbox flags a standard (flat-price) material
- `MaterialCostsTab.tsx` — cost entries per part/break with source field; standard items render a single flat-price input (writes an annualQty=0 entry) instead of per-break cells
- `EquipmentTab.tsx` — CapEx equipment entries; "From library" chips for copy-on-use
- `OperationsTab.tsx` — direct ops, indirect ops, subcontract on one tab; Rate column (LaborRateSelector) for each op; grey **pc/hr** helper per direct op + a line-rate banner when a primary FG+break is set
- `SummaryTab.tsx` — cost breakdown table + margin/sell price per FG per break
- `MfgSummaryTab.tsx` — manufacturing summary: takt/cycle, equipment utilization, DL hours per FG/break, IL hours factory-wide (indirect "Setup %" row removed)

### Hooks
- `emura-app/hooks/useDragSort.ts` — HTML5 DnD reorderable rows; returns dragProps() and rowClass()

## Core TypeScript interfaces (in calculations.ts)
```
AppState     { quote, settings, laborRates, breaks, finishedGoods, bom, materialCosts,
               materialSources, equipment, directOps, indirectOps, subcontracts, margins,
               primaryFgId?, primaryBreakId? }   // primary* = selected "primary" FG/break ids for summary stats
Break        { id, label, buildsPerYear, totalEAU }
FGBreak      { eau? }
FinishedGood { id, name, description, breaks: FGBreak[] }   // breaks index-aligned to state.breaks
BOMItem      { id, partNumber, description, uom, fgSpecific, customerSupplied, standard?, qty, fgQtys }
             // standard? = flat price at any volume (stored as a materialCosts entry with annualQty=0)
Equipment    { id, name, capex, hourlyRunCost, annualMaintenance, projectSpecific }
LaborRate    { id, name, rate }                              // named $/hr rate category
DirectOp     { id, name, operators, cycleTimeSec, orderSetupMin, lineSetupMin, equipmentIds[], notes, rateId? }
IndirectOp   { id, name, annualHours, orderSetupHrs, lineSetupHrs, notes, rateId? }
Subcontract  { id, name, priceEach, pricePerLine, pricePerOrder, pricePerYear, notes }
settings     { shopRate, indirectRate, capexYears, workingHoursPerYear }
             // shopRate/indirectRate are internal fallbacks when op.rateId is unset
```

## Design principles
- **Mission**: Fastest, easiest, most accurate cost estimating software for manufacturing. The cost estimator's favorite tool for speed and ease; the sales team's favorite for clear pricing data; engineering's favorite for building and updating BOMs/BOOs.
- **Speed is a feature.** All calculations run client-side. Never make a network call during user interaction.
- **No unnecessary dependencies.** Fight bundle size.
- **Save asynchronously**, never block the UI.
- **Keep localStorage as a backup** even after Supabase is added.
- **No pop-ups or warnings ever** (except deleting an entire quote). Instead allow undo.
- **+Add buttons add exactly one row per click.**

## Security measures

### Auth & session
- Logout clears `localStorage` (`STORE_KEY`) before redirecting — prevents quote data leaking on shared devices
- `proxy.ts` gates all routes except `_next/static`, `_next/image`, and `favicon.ico`

### Input sanitization
- `quote.notes` is the **only** place a stored string becomes live HTML (rendered into a contenteditable div via `innerHTML`). All sanitization funnels through one helper, `sanitizeNotes()` in `lib/sanitize.ts`, applied at **all four** entry points: render (`QuoteInfoTab.tsx:25`), paste (`:50`), blur/commit (`:132`), and import (`migrateState` in `state.ts:75`). Sanitizing on write — not just render — means unsanitized markup never transits storage.
- `sanitizeNotes()` allowlist: tags `p br b i u em strong img`, attr `src` only, no data-attrs. An `afterSanitizeAttributes` hook strips any `<img src>` not starting with `data:` — blocks external tracking-pixel / viewer-IP-leak URLs and keeps the sanitizer in agreement with the CSP `img-src 'self' data:` directive. The hook is added/removed around each call so it can't affect other DOMPurify usage.
- Imported JSON is piped through `migrateState()` before loading — normalizes missing/malformed fields instead of casting blind
- Only the Supabase anon key is used client-side; secret key never touches the frontend

### HTTP security headers (next.config.ts)
- `Content-Security-Policy`:
  - `script-src 'self' 'unsafe-inline'` + `'unsafe-eval'` **only in development** (gated on `process.env.NODE_ENV`). Per Next.js docs `'unsafe-eval'` is never used in production — it's only needed for React's dev-time debug eval. `'unsafe-inline'` stays because Next injects inline bootstrap/hydration scripts; removing it would require per-request nonces (forces dynamic rendering — conflicts with "speed is a feature") or experimental SRI hashes. **Deliberately kept** — see the security-review log below.
  - `style-src 'self' 'unsafe-inline'` — `'unsafe-inline'` genuinely required for JSX inline styles
  - `img-src 'self' data:` — `data:` for pasted notes images (and `sanitizeNotes` enforces the same)
  - `connect-src 'self' https://*.supabase.com https://*.supabase.co` (Supabase uses the `.co` TLD for project endpoints)
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` — hardening directives
- `X-Frame-Options: DENY` — blocks clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables camera, microphone, geolocation

### What's intentionally deferred
- localStorage is now a cache (write-through), not primary storage — primary is Supabase
- No server-side CSRF tokens — Supabase SDK handles request signing
- No client-side login rate limiting — Supabase enforces server-side; add UI feedback in Phase 6

### Security review log (2026-05-31)
A flagged-findings pass; outcomes recorded here so they aren't re-flagged:
- **`get_org_member_emails` RPC (HIGH, resolved).** The flagged "unaudited security-definer email RPC" did **not exist** in the DB — the app's call was silently erroring, which is why the Admin → Users tab showed UUIDs instead of emails. Created it in `schema.sql` **with a membership guard** (`raise exception 'not a member of this org'` unless `auth.uid()` ∈ `p_org_id`), `security definer` + `row_security off`, granted to `authenticated` only. This both fixes email resolution and makes the hypothesized cross-tenant enumeration impossible by construction. Guard columns are table-qualified (`m.user_id`) — an unqualified `user_id` collides with the `RETURNS TABLE` OUT-variable and makes the guard always fail.
- **CSP `'unsafe-eval'` (MEDIUM, resolved).** Removed from production (dev-only now). `'unsafe-inline'` in `script-src` kept deliberately: the only HTML sink is `quote.notes`, guarded by `sanitizeNotes`; worst-case is a stored cross-user XSS within an org via a DOMPurify bypass. Full nonce/SRI hardening was evaluated and declined — nonces force dynamic rendering (kills static/CDN caching, conflicts with the speed mission); SRI is experimental.
- **External `<img src>` in notes (LOW, resolved).** `sanitizeNotes` now strips non-`data:` image src — see Input sanitization above.
- **Notes saved without re-sanitizing (LOW, resolved).** Write paths now sanitize too — see Input sanitization above.
- **Last-admin orphaning (LOW, resolved).** RLS let any admin demote/remove any member incl. the last admin (UI-only guard in `AdminDrawer`). Added `prevent_last_admin_change()` trigger (`before update or delete on org_members`) in `schema.sql` — blocks demoting/deleting the last admin at the DB level. `security definer` + `row_security off` so the admin count sees all rows.
- **Invite tokens in URL query (LOW, accepted).** Single-use + 7-day expiry + 192-bit random + `Referrer-Policy` containment. Acceptable residual; no change.

## Supabase / Phase 4 gotchas

### auth.users trigger: use security definer + search_path + row_security off
Triggers on `auth.users` run in the `auth` schema context. Without explicit settings the function
cannot find `public` tables and RLS may silently block inserts even with `security definer`:
```sql
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
set row_security = off
as $$ … $$;
```
Always use fully-qualified table names (`public.organizations`, not `organizations`) inside the function.

### Don't call an RPC after signUp() to create org data
`signUp()` returns an obfuscated response when email confirmation is enabled — `data.user` may be
null or unreliable. Use an `after insert on auth.users` trigger instead. Pass company name via
`options.data` in signUp and read it from `new.raw_user_meta_data->>'company_name'` in the trigger.

### Self-referential RLS policies return empty
A policy that queries the same table it protects causes PostgreSQL to short-circuit to empty.
```sql
-- BAD: queries org_members inside the org_members policy
using (exists (select 1 from org_members where org_id = org_members.org_id and user_id = auth.uid()))

-- GOOD: non-recursive
using (user_id = auth.uid())
```
For policies that need to traverse relationships, use a `security definer` helper function to
break the recursion.

### created_by FK on user-created records must allow cascade or nullability
`organizations.created_by`, `quotes.created_by`, and `org_invites.created_by` reference `auth.users`.
Without `on delete set null`, deleting a user in the Supabase dashboard fails with a FK violation.
Always use `references auth.users on delete set null` (and drop the `not null` constraint) for
audit columns where the record should outlive the user.

### Supabase project endpoints use the .co TLD
The project-specific API URL is `https://<ref>.supabase.co` (not `.supabase.com`).
The CSP `connect-src` must allow both `*.supabase.co` and `*.supabase.com` to cover all
Supabase services. Ensure `.env.local` and Vercel env vars use `.supabase.co`.

### emailRedirectTo and Supabase Site URL
- Set Supabase Site URL to `https://emura.io` with the `https://` prefix — omitting it causes
  Supabase to treat the value as a relative path and construct a broken redirect URL.
- Add both `https://emura.io/**` and `http://localhost:3000/**` to Supabase Redirect URLs.
- Pass `emailRedirectTo: window.location.origin` (no trailing slash) in `signUp()` so local
  dev confirmation links go to localhost and production links go to emura.io.

### useSearchParams() requires Suspense in Next.js 16
Any page component that calls `useSearchParams()` must be wrapped in `<Suspense>` or the
production build fails with "missing-suspense-with-csr-bailout". Pattern:
```tsx
function PageContent() { const p = useSearchParams(); … }
export default function Page() { return <Suspense><PageContent /></Suspense>; }
```

## Critical implementation gotchas

### Next.js 16: middleware.ts → proxy.ts
Next.js 16 renamed the file convention from `middleware.ts` to `proxy.ts` and the exported
function from `middleware` to `proxy`. Using `middleware.ts` still works but logs a deprecation
warning. Always use `proxy.ts` for new projects on Next.js 16+.

### Production build runs strict TypeScript; local dev does not
`next dev` skips type checking. `next build` (Vercel) runs it strictly. Cross-type casts
that dev tolerates will fail in production. Always cast through `unknown` first:
`(value as unknown as TargetType)` — not `(value as TargetType)` when types don't overlap.

### NEXT_PUBLIC_* variables are baked in at build time
Changing a `NEXT_PUBLIC_*` env var on Vercel does NOT take effect until the next deployment.
These are embedded into the JavaScript bundle during `next build`, not read at runtime.
Always trigger a redeploy after changing them.

### Equipment dropdown: never use display:none in CSS for React-controlled visibility
The `.eq-menu` CSS originally had `display:none` from the vanilla JS prototype (JS toggled it).
React controls visibility via conditional rendering — if CSS also has `display:none`, the
element is permanently hidden even when React renders it. Let React own show/hide; CSS should
only style, not gate.

### Never define inner components inside a parent component
Inner component definitions (e.g., `function Row() { ... }` inside `BOMTab`) cause React
to treat them as new component types on every render → unmount/remount → focus loss and
drag events destroyed. Always inline JSX directly in `map()` callbacks.

### Qty inputs: use defaultValue + onBlur (not onChange)
Controlled `onChange` on qty fields prevents typing fractions (e.g., "1/4" → parseFraction
returns 0 after first "/", instantly overwrites). Use `defaultValue={item.qty}` + `onBlur`
to commit. Key the input with `key={item.id + '-qty-' + resetKey}` so it remounts on
undo/import/new to pick up fresh defaultValues.

### resetKey pattern
`page.tsx` holds `const [resetKey, setResetKey] = useState(0)`. Increment on undo, new,
and import. Pass as prop to all tabs. Use as suffix on keys for uncontrolled inputs.

### Indirect order setup formula
`ilOrder += orderSetupHrs × indirectRate / toq`  (NOT multiplied by buildsPerYear)
Reasoning: annual cost = orderSetupHrs × bpy × rate; per unit = /(toq × bpy) → bpy cancels.

### Equipment CapEx formula
- `occupiedHrs = cycleTime×tau + orderSetup×bpy + lineSetup×bpy×nFGs`
- `util = occupiedHrs / settings.workingHoursPerYear`
- Non-project-specific: `capexPerUnit = (capex / settings.capexYears) × util / tau`
- Non-project-specific maintenance: `maintPerUnit = annualMaintenance × util / tau`
- Project-specific: `capexPerUnit = capex / tau`; `maintPerUnit = annualMaintenance / tau`

### Labor rate resolution
Direct ops: `op.rateId → state.laborRates.find(r => r.id === rateId)?.rate ?? settings.shopRate`
Indirect ops: same but falls back to `settings.indirectRate`
`settings.shopRate` and `settings.indirectRate` are now hidden internal fallbacks — they are NOT shown in the UI. The Labor Rates list on Quote Info tab is the only UI surface. Migration creates rate entries from old shopRate/indirectRate so existing quotes keep their values.

### Revision Note behavior
`state.quote.revision` is the "Revision Note" — a brief description of the working draft.
When `saveRevision` succeeds, `pendingRevClear` is set to `true` in `page.tsx`.
On the **next** call to `handleUpdate`, the revision field is cleared and `pendingRevClear` reset.
This preserves the note for reading after saving but clears it once you start the next draft.

### Redo stack
`future: AppState[]` in `page.tsx` — mirrors `history` but holds undone states.
`handleUpdate` clears future. `handleUndo` pushes current to future. `handleRedo` pops from future, pushes current to history.
Navigation between tabs does NOT affect undo/redo — same behavior as undo.

### Sell price
`totalCost / (1 - margin/100)` — gross margin basis

### Standard (flat-price) materials
A BOM item with `standard === true` has one flat price applied at any volume. The price is stored
as a `materialCosts` entry with `annualQty === 0`. `findCost()` checks for a `0` entry first and
returns it as a wildcard for any `tq` (unflagged), short-circuiting the normal proximity/tier
window. The Std checkbox lives on the BOM tab; the Material Costs tab renders a single flat-price
input for standard items. Library sync filters were widened from `annualQty > 0` to `>= 0`
(`syncPartsToLibrary`, `pushPartToLibrary`, `handlePushToLibrary`) so the flat tier syncs as a
`part_prices` row with `min_qty = 0` (which `applicablePrice` already treats as "applies to all").

### Primary FG + break throughput (Operations pc/hr helpers)
`resolvePrimaryIndices(state)` → `{ fgi, bki }` (−1 when unset/missing). `computePrimaryThroughput`
expresses an effective **labor rate**: `pcPerHour = qty ÷ totalPersonHours`, where `qty` is the
primary FG's units/build and person-hours = run + setup for **all** operators (per owner spec:
total labor content, each op treated as its own batch, NOT bottleneck-limited; setup included).
`linePcPerHour = qty ÷ Σ person-hours`. Dividing an order qty by pc/hr yields total person-hours.

### Cost Drivers (computeCostDrivers)
Pure function in `calculations.ts`. Returns annual-$ drivers aggregated across all FGs at one break
(the primary break; falls back to the highest-volume break when unset). Categories are
Material / Direct Labor / Equipment (split out of DL) / Indirect Labor / Subcontract, derived by
summing their individual drivers so category totals always equal the sum of listed drivers; both
`categories` and `drivers` are sorted descending. The per-category/per-op/per-item math mirrors
`calcCosts` exactly so totals reconcile with the Summary tab.

### Advanced (content) search — REQUIRES a DB migration
`searchQuotes(supabase, term)` calls the `search_quotes(p_term)` RPC. The RPC + `quote_search_text()`
helper + `quotes_search_idx` GIN index are in `schema.sql` and **must be run in the Supabase SQL
Editor** before search works in production. The RPC is SECURITY INVOKER so the `quotes` RLS policy
scopes results. Matching is `to_tsvector('simple', …) @@ plainto_tsquery('simple', term)` — exact
token, not substring. The original name/customer quick filter is a separate client-side filter and
was retained. In `QuotesList`, content results render two-tier: name/customer matches first, then
content-only matches (badged "in contents").

### Revision Compare (computeRevisionDiff)
Pure function diffing two `AppState` snapshots. Entities matched by `id` (rename → "changed Name"
field; true add/remove → listed by name only, no param spam). Plus per-FG/break cost deltas via
`calcCosts`. Snapshots come from the existing `quote_revisions` table (`loadQuoteRevision`); the
working draft is the in-memory `appState`. Launched from the header "Compare" button on an open quote.

### Quote-list status cache invalidation
`statusCache` (in `page.tsx`) backs both the status dot and the **Est. $/unit** column, lazy-loaded
per visible quote via `handleVisibleIdsChange` (gated by `QUOTE_STATUS_ENABLED`). It went stale after
an edit because cached ids were never recomputed. Fix: `cloudSave` deletes the edited quote's id from
`statusCache` on save success, so it reloads when the list is next viewed. No fetch during editing.

### State migrations
`migrateState()` in state.ts handles schema evolution. Current store key: `mce_v4`.
Migrations handle: old `type` field → `fgSpecific` boolean; old per-op `capex` → equipment entry.

## Conventions
- All cost calculation logic goes in `lib/calculations.ts` as pure functions
- All state helpers (uid, parse, default, migrate, load, save) go in `lib/state.ts`
- Tab components receive `{ state: AppState, onUpdate: (s: AppState) => void, resetKey: number }`
- Drag-sortable tables use `useDragSort` hook; it operates on the full parent array using global indices
- CSS classes: `btn btn-add btn-sm`, `btn btn-del btn-sm`, `btn btn-neu btn-sm`, `card`, `card-hdr`, `card-body`, `drag-h`, `cs-row`, `drag-before`, `drag-after`

---

## QA Testing

### Overview

The checklist lives at `QA_CHECKLIST.md` (repo root). Dated result files go next to it:
`QA_RESULTS_YYYY-MM-DD.md`. Run before every production deploy.

The automated portion is a Playwright headless-Chromium script. It lives at:
```
/tmp/emura-qa-runner/index.mjs   ← the test script (not committed; rebuild from scratch each time)
```
The script is not committed to the repo because it is a disposable automation artifact —
re-generate it from the checklist rather than maintaining it as source code.

### How to re-run automated QA

```bash
# 1. Start the dev server
cd /Users/eohano/Emuri/Emura/emura-app
npm run dev &   # wait for "Ready" in output

# 2. Create a temp runner directory
mkdir -p /tmp/emura-qa-runner
cat > /tmp/emura-qa-runner/package.json <<'EOF'
{ "type": "module" }
EOF

# 3. Symlink the npx-cached playwright node_modules (avoids re-download)
#    The cached path is ~/.npm/_npx/<hash>/node_modules/playwright.
#    Run: ls ~/.npm/_npx/  to find the right hash.
ln -sf $(ls -dt ~/.npm/_npx/*/node_modules | head -1) /tmp/emura-qa-runner/node_modules

# 4. Write index.mjs (see "Writing the test script" below)
#    Then run:
cd /tmp/emura-qa-runner && node index.mjs
```

Admin credentials for localhost testing: `eohano@gmail.com` / `claudetest`

Skip sections **1.5–1.6** (email confirmation) and **2.2–2.4** (Supabase Table Editor) — those
require live email or manual Supabase dashboard access.

### Writing the test script

> ⚠️ **2026-06 redesign — "Stepline" dark theme (`.mcx`).** The UI was rebuilt on a dark design
> system scoped under the `.mcx` class (`app/mcx.css`). The old light chrome (`header`, `nav`,
> `.tab-btn`, `.card`, `.btn*`, `.stbl`, bare `table/input/select` rules) was **retired** from
> `globals.css`. Tab navigation is now the **"Stepline" ribbon** (`RibbonStepper`), header controls
> live in the **utility bar** (`UtilBar` → `.mcx-util`), and most action buttons are icon+label
> (`.mcx-btn`) where the icon is an inline **SVG** — so several controls can no longer be matched by
> their old text/✕ glyph. The selector table below is updated to the new markup.

When generating `index.mjs`, use the **exact UI selectors** from the source. The ones that bit us:

| Element | Correct selector |
|---------|-----------------|
| Tab buttons (ribbon) | `button.mcx-step-item` — navigate by clicking; `title` = exact label `'Quote Info'`, `'Finished Goods'`, `'Bill of Materials'`, `'Material Costs'`, `'Equipment'`, `'Operations'`, `'Summary'`, `'Mfg Summary'`. The visible `.mcx-step-label` carries the same text. (No more `button.tab-btn`.) |
| Back to list | `button.mcx-back` (`title="Back to quotes list"`, text contains `'Quotes'`) |
| Settings/admin | `button[title="Settings"]` (renders a gear SVG; admin only) |
| Undo / Redo | `button[title^="Undo"]` / `button[title^="Redo"]` (was `button.btn-undo`; now `.mcx-btn.is-icon`) |
| Export | `button.mcx-btn` with text `'Export'` |
| Import | `label.mcx-btn` with text `'Import'` — still a `<label>`, NOT a `<button>`; set files via `label input[type="file"]` |
| Save Revision | `button.mcx-btn.is-primary` with text `'Save Revision'` (editor utility bar; `⌘S` also triggers it) |
| Delete (any row) | `button.mcx-btn.is-icon` whose only child is an **X SVG** (no `✕` text) — match by row position, not text; it is the last cell's button |
| Add buttons (header actions) | `button.mcx-btn.is-primary` rendered by `SectionCard` — text is the label **without** a `+` prefix (the `+` is an SVG icon): `'Add Break'`, `'Add FG'`, `'Add Common'`, `'Add FG-Specific'`, `'Add Operation'`, `'Add Category'`, `'Add Subcontract'`, `'Add Equipment'` |
| Admin drawer panel | `.drawer-panel` (now also carries `.mcx`) |
| Admin drawer tabs | `button` with text `'Organization'`, `'Sites & Depts'`, `'Users'` |
| Close drawer | `button` with text `'×'` inside `.drawer-panel` |
| Org name input | `.drawer-panel input` (first input; now `.mcx`-styled, still no `type` attribute) |
| Quote Review card | `.mcx-card-head` containing text `'Quote Review'` (title text is in `.mcx-card-title`) |
| Update All button | `button.mcx-btn` with text containing `'Update All from Library'` (Quote Review header) |
| Per-row Update button | `button` with text containing `'Use Library'` (or `'Update Library'` for locked rows) |
| Cost Drivers card | `.mcx-card-head` containing text `'Top Cost Drivers'`; "Show all" toggle is `button` with text starting `'Show all'` |
| Primary FG / Break | two `select.mcx-input` on the Finished Goods tab (Volume Breaks / Finished Goods cards) |
| Std checkbox (BOM) | now a `button.mcx-chk` (NOT a native checkbox) with `title` starting `'Standard material'` |
| Compare revisions | `button.mcx-btn` with text `'Compare'` (editor utility bar) — modal is a fixed `.mcx` overlay with two `select.mcx-input` (From/To) |
| Content search | `input[placeholder="Search within quotes…"]` + `button.mcx-btn` with text `'Search'`; `'Clear'` button appears when active |
| Est. $/unit column | header `th` text `'Est. $/unit'` in QuotesList; value is monospace `$x.xx` or `—` |
| Annual Cost readout | `.mcx-annual` (right edge of the ribbon) — adaptive: per-unit when a primary FG is set, else aggregate annual |
| Save status | `#save-status` — still present as a **hidden** (`display:none`) mirror span for QA/back-compat; the visible state lives in `UtilBar` |
| Quote Info inputs | `.mcx-input` text inputs in the left rail (Quote Information card) — no placeholder/id; first is Name, second Customer (Revision is in the same card). (`div.fgrp` retired.) |
| Notes area | `div.mcx-notes` (contenteditable div, not a textarea) |
| Qty inputs (BOM) | `input.mcx-input.is-num` — `defaultValue + onBlur`; read value only after navigating away and back to force remount |
| App container | `#app.mcx` (the `mcx` class enables the dark design system) |

Key structural facts:
- **Volume Breaks live on the Finished Goods tab**, not Quote Info (despite checklist section 4 listing them).
- The app renders `null` during bootstrap (`!loaded`). Always `waitForSelector('#app')` after login, not just a fixed delay.
- After logout, `proxy.ts` immediately redirects any authenticated `/login` visit to `/`. Check `page.url()` after `goto('/login')` and logout first if not on the login page.
- The **New Quote** button appears in **both** the utility bar (`UtilBar`, text `'New Quote'`, no `+` glyph — the `+` is an SVG icon) and inside `QuotesList` (also `'New Quote'`). Use `.first()` or target by parent to avoid strict-mode violations.

### What we learned from the first QA run (2026-05-21)

**Bugs found and fixed:**

1. **Undo enabled on fresh quote** (`handleNew()` in `page.tsx`): When creating from the list
   view, `appState` is `null`. The call `setHistory(prev => [...prev, appState!])` pushed `null`
   into history, making `history.length === 1` and leaving undo enabled. Fixed: guard with
   `if (appState !== null)` and `else setHistory([])`.

2. **Mobile horizontal overflow** (`globals.css` header): The header `flex-shrink:0` with no
   `flex-wrap` caused the button row to spill past the 375 px viewport (`body.scrollWidth = 414`).
   Fixed: added `flex-wrap:wrap; gap:6px` to the `header` rule.

3. **Tab crashes on partial-JSON imports** (`migrateState()` in `lib/state.ts`): Missing top-level
   arrays (`breaks`, `bom`, `finishedGoods`, `directOps`, `indirectOps`, `subcontracts`) were
   iterated with `(state.x || []).forEach(...)` but never assigned back. The fields stayed
   `undefined`, and any tab calling `.map()` on them threw a fatal React error. Fixed: explicit
   `if (!state.x) state.x = ...` guards for every array and object field before the loops.
   Because `loadQuote` always calls `migrateState`, any already-broken quotes in Supabase
   self-heal on next open — no manual DB cleanup needed.

**Observations about QA test design:**

- The automated script leaves test quotes in Supabase. Clean these up manually after each run,
  or filter them by name prefix (the script names them "QA Test Quote …", "QA Quote Extra …",
  "XSS Test …", etc.).
- XSS sanitization was confirmed clean — `<script>` and `onerror` both stripped by DOMPurify.
- Fraction parsing (`1/4` → `0.25`) works correctly but requires tab-navigation to remount
  `defaultValue` inputs before the post-blur value is readable by automation.
- Role gating (11.3–11.8) and most of the invite flow (14.2–14.9) require pre-created estimator
  and viewer accounts. Set these up once and note their credentials here for future runs.

### Keeping the test script current

When you add a new feature, update the test script to cover it:

1. **New tab or tab rename** — Update the `TABS` check and add a section function mirroring the
   pattern of existing sections. The tab is now a **ribbon node** — select it with
   `button.mcx-step-item` and match the exact `title`/label string from `page.tsx`'s `TABS` array
   (e.g. `page.click('button.mcx-step-item[title="Operations"]')`).

2. **New field in `AppState`** — Add it to `migrateState()` with an explicit null guard:
   ```js
   if (!state.newField) state.newField = def.newField ?? defaultValue;
   ```
   Then add a test to 13.7 (partial-JSON import) that verifies the missing field doesn't crash.

3. **New button in the UI** — Read the actual `className` and text from the component source
   before writing the selector. Never guess — the tab/button naming in the checklist prose
   often differs from the actual rendered text (e.g., "Direct Op" vs `+ Add Operation`).

4. **New role or permission** — Add a test account for that role to section 11 and document
   its credentials below.

5. **QA_CHECKLIST.md updates** — Fix known prose mismatches when you find them (e.g., breaks
   are under Finished Goods tab, not Quote Info; direct-op button is "+ Add Operation", not
   "+ Add Direct Op"). The checklist is the source of truth for manual testers.

### Test account credentials (localhost)

| Role | Email | Password |
|------|-------|----------|
| Admin | eohano@gmail.com | claudetest |
| Estimator | *(not yet created — set up via invite flow and record here)* | |
| Viewer | *(not yet created — set up via invite flow and record here)* | |

### migrateState contract (critical)

Every field of `AppState` **must** have a null guard in `migrateState()` before any code
accesses it. The function is called on every `loadQuote` (from Supabase) and on every JSON
import. Violating this causes fatal tab crashes that look like unrelated rendering errors.

Current fields and their guards:
- `settings.*` — individual `== null` checks per sub-field
- `breaks` — `if (!state.breaks) state.breaks = def.breaks`
- `finishedGoods`, `bom`, `directOps`, `indirectOps`, `subcontracts` — `if (!state.x) state.x = []`
- `equipment`, `margins`, `materialSources`, `materialCosts` — `if (!state.x) state.x = {}`/`[]`
- `quote` — `if (!state.quote) state.quote = def.quote`
- `laborRates` — `if (!state.laborRates)` create from old shopRate/indirectRate (migration preserves rates)
- `directOps[*].rateId` — `if (op.rateId === undefined) op.rateId = ''`
- `indirectOps[*].rateId` — same
- `quote.revision` — `if (!state.quote.revision) state.quote.revision = ''`
- `bom[*].standard` — `if (item.standard === undefined) item.standard = false`
- `primaryFgId` / `primaryBreakId` — `if (state.primaryFgId === undefined) state.primaryFgId = ''` (same for break)

If you add a new field to `AppState`, add its guard to this list.

---

## Parts & Equipment Library

### Tables (run schema.sql block in Supabase SQL Editor to create)
- `parts` — org-wide catalogue; unique on `(org_id, part_number)`; columns include `source_quote_id` (UUID FK) and `locked` (boolean)
- `part_prices` — tiered pricing keyed by `(part_id, min_qty)` where `min_qty` is annual purchasing qty
- `equipment_library` — org-wide equipment; unique on `(org_id, name)`; columns include `source_quote_id` and `locked`
- `labor_rate_library` — org-wide labor rates; unique on `(org_id, name)`; same lock/source pattern as equipment
  - Note: `pushLaborRateToLibrary` is exported from `lib/db.ts` but is not called anywhere in the codebase. Labor rate library push is unimplemented — there is no "→ Update Library" button for labor rates in the Quote Review panel or elsewhere.

### Auto-sync (no manual data entry needed)
Every debounced cloud save calls `syncPartsToLibrary` and `syncEquipmentToLibrary` (both in `lib/db.ts`).
- Parts: upserts non-customer-supplied BOM items with a part number, then upserts each `CostEntry` from `materialCosts` as a price tier. Material costs must be entered on the Material Costs tab before prices appear.
- Equipment: upserts all named equipment entries from the quote.
- Lock behavior: if a part/equipment already exists in the library and belongs to a *different* quote (`source_quote_id != quoteId`), the entry is marked `locked=true` and the auto-sync skips it. Locked entries require a manual push via `pushPartToLibrary` / `pushEquipmentToLibrary`.
After sync, `listLibraryParts` and `listLibraryEquipment` refresh the in-memory state so Quote Review updates immediately.

### Stale closure gotcha
`cloudSave` is a `useCallback` with `[]` deps. It captures `orgCtx = null` at mount time.
`orgCtxRef` (a `useRef`) is kept in sync by the bootstrap `useEffect` and read inside `cloudSave`
so the sync always has the live org ID. Do not replace with direct state access.

### Quote Review (components/QuoteReview.tsx)
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

### RLS notes
- `parts` and `part_prices`: readable by all org members; writable by admin + estimator
- `equipment_library`: readable by all org members; writable by admin + estimator
  (originally admin-only — was changed after RLS failure; make sure policy reflects `role in ('admin','estimator')`)
- `part_prices` requires `unique (part_id, min_qty)` — must be added manually if table was created before the constraint was in the schema
- `equipment_library` requires `unique (org_id, name)` — same
