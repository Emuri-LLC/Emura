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
- ✅ Phase 2: Full React migration — all 7 tabs, calculations, drag-and-drop
- ✅ Phase 3: Supabase authentication — login/signup live, app gated behind auth
- ✅ Phase 4: Cloud save + org schema — quotes in Supabase JSONB, org/site/dept hierarchy, admin drawer, invite flow
- 🔜 Phase 5: Organizations and sharing — cross-user quote visibility, org switcher, share links
- Phase 6: Launch prep (Stripe subscriptions, error tracking)

## Current state (Phase 4 complete)
- `index.html`: original prototype, kept for reference only, NOT deployed
- `manufacturing-cost-estimator-spec.html`: product specification document
- `emura-app/`: the live Next.js application deployed to emura.io
- `emura-app/public/emura.js`: intentional stub (3-line comment), all logic is in React
- All 7 tabs fully functional in React: Quote Info, Finished Goods, BOM, Material Costs, Equipment, Operations, Summary
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
- Token-based invite flow: admin generates link → `/join?token=...` → recipient signs up/in → auto-joined
- Undo/redo via history stack in page.tsx (40-state depth); Export/Import as JSON still available
- All calculations run client-side synchronously

## Key file locations

### App entry
- `emura-app/app/page.tsx` — root component; owns AppState, history, resetKey; has Logout button
- `emura-app/app/layout.tsx` — sets metadata and loads globals.css (no scripts)
- `emura-app/app/globals.css` — all CSS (migrated from index.html)
- `emura-app/app/login/page.tsx` — login/signup page; handles both modes with toggle link

### Auth & routing
- `emura-app/proxy.ts` — Next.js 16 auth gate; `/join` bypassed so unauthenticated users can accept invites
- `emura-app/lib/supabase.ts` — browser Supabase client factory (`createClient()`)
- `emura-app/app/join/page.tsx` — invite token acceptance; calls `accept_org_invite` RPC

### Cloud save & org
- `emura-app/lib/db.ts` — all Supabase query functions: `getMyOrgContext`, `listQuotes`, `loadQuote`, `createQuote`, `saveQuote`, `deleteQuote`, org/site/dept/member management, `createInvite`
- `emura-app/supabase/schema.sql` — full schema: tables, RLS policies, `handle_new_user` trigger, `accept_org_invite` RPC

### Components
- `emura-app/components/QuotesList.tsx` — quote picker; entry point before a quote is open
- `emura-app/components/AdminDrawer.tsx` — slide-out settings panel (admin only); sites/depts/users/invite

### Logic
- `emura-app/lib/calculations.ts` — all cost math as pure functions; defines all TypeScript interfaces
- `emura-app/lib/state.ts` — uid(), parseFraction(), defaultState(), migrateState(), loadState(), saveState()

### Components
- `emura-app/components/InfoIcon.tsx` — tooltip ⓘ icons with TIPS lookup object
- `emura-app/components/EquipmentSelector.tsx` — searchable checkbox dropdown with chip display

### Tabs (emura-app/components/tabs/)
- `QuoteInfoTab.tsx` — quote name, customer, notes (supports images), volume breaks
- `FinishedGoodsTab.tsx` — FG list with EAU, mix, description
- `BOMTab.tsx` — common + FG-specific BOM items with drag sort
- `MaterialCostsTab.tsx` — cost entries per part/break with source field
- `EquipmentTab.tsx` — CapEx equipment entries
- `OperationsTab.tsx` — direct ops, indirect ops, subcontract on one tab
- `SummaryTab.tsx` — cost breakdown table + margin/sell price per FG per break

### Hooks
- `emura-app/hooks/useDragSort.ts` — HTML5 DnD reorderable rows; returns dragProps() and rowClass()

## Core TypeScript interfaces (in calculations.ts)
```
AppState     { quote, settings, breaks, finishedGoods, bom, materialCosts,
               materialSources, equipment, directOps, indirectOps, subcontracts, margins }
Break        { id, label, buildsPerYear, totalEAU }
FGBreak      { eau? }
FinishedGood { id, name, description, breaks: FGBreak[] }   // breaks index-aligned to state.breaks
BOMItem      { id, partNumber, description, uom, fgSpecific, customerSupplied, qty, fgQtys }
Equipment    { id, name, capex, hourlyRunCost, annualMaintenance, projectSpecific }
DirectOp     { id, name, operators, cycleTimeSec, orderSetupMin, lineSetupMin, equipmentIds[], notes }
IndirectOp   { id, name, annualHours, orderSetupHrs, lineSetupHrs, notes }
Subcontract  { id, name, priceEach, pricePerLine, pricePerOrder, pricePerYear, notes }
settings     { shopRate, indirectRate, capexYears, workingHoursPerYear }
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
- `DOMPurify.sanitize()` applied to `state.quote.notes` on mount in `QuoteInfoTab.tsx` — guards against XSS in imported quotes
- Imported JSON is piped through `migrateState()` before loading — normalizes missing/malformed fields instead of casting blind
- Only the Supabase anon key is used client-side; secret key never touches the frontend

### HTTP security headers (next.config.ts)
- `Content-Security-Policy`: restricts scripts/styles to self + inline (required for Next.js/JSX inline styles); images allow `data:` for pasted notes; connect allows `*.supabase.com` and `*.supabase.co` (Supabase uses the `.co` TLD for project endpoints)
- `X-Frame-Options: DENY` — blocks clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables camera, microphone, geolocation

### What's intentionally deferred
- localStorage is now a cache (write-through), not primary storage — primary is Supabase
- No server-side CSRF tokens — Supabase SDK handles request signing
- No client-side login rate limiting — Supabase enforces server-side; add UI feedback in Phase 6

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

### Sell price
`totalCost / (1 - margin/100)` — gross margin basis

### State migrations
`migrateState()` in state.ts handles schema evolution. Current store key: `mce_v4`.
Migrations handle: old `type` field → `fgSpecific` boolean; old per-op `capex` → equipment entry.

## Conventions
- All cost calculation logic goes in `lib/calculations.ts` as pure functions
- All state helpers (uid, parse, default, migrate, load, save) go in `lib/state.ts`
- Tab components receive `{ state: AppState, onUpdate: (s: AppState) => void, resetKey: number }`
- Drag-sortable tables use `useDragSort` hook; it operates on the full parent array using global indices
- CSS classes: `btn btn-add btn-sm`, `btn btn-del btn-sm`, `btn btn-neu btn-sm`, `card`, `card-hdr`, `card-body`, `drag-h`, `cs-row`, `drag-before`, `drag-after`
