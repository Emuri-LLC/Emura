# Emura — Implementation Gotchas & Cost Formulas

Hard-won knowledge. Read before editing the relevant area — most of these caused real bugs.
See [CLAUDE.md](../CLAUDE.md) for conventions and [architecture.md](architecture.md) for the file map.

## Framework / build

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

### useSearchParams() requires Suspense in Next.js 16
Any page component that calls `useSearchParams()` must be wrapped in `<Suspense>` or the
production build fails with "missing-suspense-with-csr-bailout". Pattern:
```tsx
function PageContent() { const p = useSearchParams(); … }
export default function Page() { return <Suspense><PageContent /></Suspense>; }
```

## React patterns

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

### Redo stack
`future: AppState[]` in `page.tsx` — mirrors `history` but holds undone states.
`handleUpdate` clears future. `handleUndo` pushes current to future. `handleRedo` pops from future, pushes current to history.
Navigation between tabs does NOT affect undo/redo — same behavior as undo.

## Cost formulas (implement exactly)

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
Indirect ops: same but falls back to `settings.indirectRate`.
`settings.shopRate` and `settings.indirectRate` are hidden internal fallbacks — NOT shown in the UI. The Labor Rates list on Quote Info tab is the only UI surface. Migration creates rate entries from old shopRate/indirectRate so existing quotes keep their values.

### Sell price
`totalCost / (1 - margin/100)` — gross margin basis.

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

### Revision Compare (computeRevisionDiff)
Pure function diffing two `AppState` snapshots. Entities matched by `id` (rename → "changed Name"
field; true add/remove → listed by name only, no param spam). Plus per-FG/break cost deltas via
`calcCosts`. Snapshots come from the existing `quote_revisions` table (`loadQuoteRevision`); the
working draft is the in-memory `appState`. Launched from the header "Compare" button on an open quote.

## Behavior details

### Revision Note behavior
`state.quote.revision` is the "Revision Note" — a brief description of the working draft.
When `saveRevision` succeeds, `pendingRevClear` is set to `true` in `page.tsx`.
On the **next** call to `handleUpdate`, the revision field is cleared and `pendingRevClear` reset.
This preserves the note for reading after saving but clears it once you start the next draft.

### Quote-list status cache invalidation
`statusCache` (in `page.tsx`) backs both the status dot and the **Est. $/unit** column, lazy-loaded
per visible quote via `handleVisibleIdsChange` (gated by `QUOTE_STATUS_ENABLED`). It went stale after
an edit because cached ids were never recomputed. Fix: `cloudSave` deletes the edited quote's id from
`statusCache` on save success, so it reloads when the list is next viewed. No fetch during editing.

### Advanced (content) search — REQUIRES a DB migration
`searchQuotes(supabase, term)` calls the `search_quotes(p_term)` RPC. The RPC + `quote_search_text()`
helper + `quotes_search_idx` GIN index are in `schema.sql` and **must be run in the Supabase SQL
Editor** before search works in production. The RPC is SECURITY INVOKER so the `quotes` RLS policy
scopes results. Matching is `to_tsvector('simple', …) @@ plainto_tsquery('simple', term)` — exact
token, not substring. The original name/customer quick filter is a separate client-side filter and
was retained. In `QuotesList`, content results render two-tier: name/customer matches first, then
content-only matches (badged "in contents").

## State migrations

### Overview
`migrateState()` in `state.ts` handles schema evolution. Current store key: `mce_v4`.
Migrations handle: old `type` field → `fgSpecific` boolean; old per-op `capex` → equipment entry.

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

**If you add a new field to `AppState`, add its guard to this list.**

## Supabase / Phase 4

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
