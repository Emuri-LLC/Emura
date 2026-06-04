# Emura — Project Context

## What this is
Emura is a manufacturing cost estimator for contract manufacturers. Estimators quote BOM costs,
direct labor, indirect labor, and subcontracts across multiple finished goods and volume breaks.
Outputs cost per unit and sell price per FG per volume break.

- Company: Emuri, LLC · Product: Emura · Owner: Ethan Meyers (ebmeyers on GitHub)
- Stage: **Phase 4 complete** — cloud save + org schema live at emura.io
- Production: https://emura.io · Vercel preview: https://emura-olive.vercel.app · GitHub: https://github.com/Emuri-LLC/Emura

## Detailed references (read on demand)
The bulk of project knowledge lives in `docs/` — load the relevant file when working in that area:

| Doc | When to read |
|-----|--------------|
| [docs/architecture.md](docs/architecture.md) | File map: where every component/tab/lib/hook lives; feature notes |
| [docs/gotchas.md](docs/gotchas.md) | **Read before editing** — framework/React pitfalls, cost formulas, migrateState contract, Supabase RLS/trigger gotchas |
| [docs/security.md](docs/security.md) | Sanitization, CSP headers, auth, security-review log |
| [docs/library.md](docs/library.md) | Parts & Equipment Library: auto-sync, Quote Review, RLS |
| [docs/qa.md](docs/qa.md) | Automated QA runner + Playwright selectors; `QA_CHECKLIST.md` is the manual checklist |

## Local development
- Project folder: `/Users/eohano/Emuri/Emura` · App folder: `emura-app/`
- Run dev server: `cd emura-app && npm run dev` → http://localhost:3000

## Tech stack
- Frontend: Next.js 16 (React, App Router, TypeScript) — see `emura-app/AGENTS.md` (Next.js 16 has breaking changes; read `node_modules/next/dist/docs/` before writing framework code)
- Hosting: Vercel (auto-deploys on git push to main)
- Auth + DB / Cloud save: Supabase (`@supabase/supabase-js` + `@supabase/ssr`); Postgres, quotes as JSONB per dept
- Email: Resend (transactional auth emails via custom SMTP on emura.io)
- Payments: Stripe (Phase 6 — not yet implemented)
- Domain registrar: Namecheap (emura.io connected to Vercel)

## Vercel configuration (required settings)
- **Root Directory**: `emura-app` (not `./` — the Next.js app is in the subdirectory)
- Framework Preset: Next.js · Build: `npm run build` · Output: `.next`
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — baked into the JS bundle at
  build time, so changing them on Vercel requires a redeploy. Never commit `.env.local` (`.env*` is gitignored).

## Project phases
- ✅ 0 Env setup · ✅ 1 Live on Vercel · ✅ 2 Full React migration (8 tabs, calcs, drag-drop)
- ✅ 3 Supabase auth · ✅ 4 Cloud save + org schema (quotes JSONB, org/site/dept, admin drawer, invites)
- 🔜 5 Organizations & sharing — cross-user quote visibility, org switcher, share links
- 6 Launch prep — Stripe subscriptions, error tracking

## Current state (Phase 4 complete)
- All 8 tabs functional in React: Quote Info, Finished Goods, BOM, Material Costs, Equipment, Operations, Summary, Mfg Summary.
- Auth required (unauthenticated → `/login`; logout clears localStorage). Quotes in Supabase (`quotes` table, JSONB `state`) per department; localStorage is a write-through cache / offline fallback. 1-second debounced cloud save on every change.
- Entry point is a Quotes list; open a quote to enter the tab editor (`← Quotes` returns without losing it).
- Org hierarchy + roles (admin/estimator/viewer), admin drawer, token-based invites. Undo/redo + JSON Export/Import. All calculations run client-side, synchronously.
- Parts & equipment library auto-synced on save; Quote Review, Cost Drivers, Primary FG+Break, Standard materials, Advanced content search, Revision Compare. (Details in [docs/architecture.md](docs/architecture.md).)
- `index.html` is the original prototype (NOT deployed); `manufacturing-cost-estimator-spec.html` is the spec.

## Core TypeScript interfaces (in `lib/calculations.ts`)
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
- **Mission**: Fastest, easiest, most accurate cost estimating software for manufacturing — the estimator's favorite for speed, sales' favorite for clear pricing, engineering's favorite for BOMs/BOOs.
- **Speed is a feature.** All calculations run client-side. Never make a network call during user interaction.
- **No unnecessary dependencies.** Fight bundle size.
- **Save asynchronously**, never block the UI. Keep localStorage as a backup even with Supabase.
- **No pop-ups or warnings ever** (except deleting an entire quote). Instead allow undo.
- **+Add buttons add exactly one row per click.**

## Conventions
- All cost calculation logic goes in `lib/calculations.ts` as pure functions.
- All state helpers (uid, parse, default, migrate, load, save) go in `lib/state.ts`. **Every new `AppState` field needs a `migrateState()` null guard** — see [docs/gotchas.md](docs/gotchas.md#migratestate-contract-critical).
- Tab components receive `{ state: AppState, onUpdate: (s: AppState) => void, resetKey: number }`.
- Drag-sortable tables use the `useDragSort` hook; it operates on the full parent array using global indices.
- UI runs on the dark-only `.mcx` design system (`app/mcx.css`); do not reintroduce bare-tag form/table CSS rules.
