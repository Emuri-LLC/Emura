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
- 8 React tabs (Quote Info, Finished Goods, BOM, Material Costs, Equipment, Operations, Summary, Mfg Summary). Auth required; quotes in Supabase (`quotes.state` JSONB per dept), localStorage is a write-through/offline cache, 1-s debounced cloud save.
- Org hierarchy + roles, admin drawer, token invites, undo/redo + JSON export/import, library auto-sync, Quote Review, Cost Drivers, Primary FG+Break, Standard materials, content search, Revision Compare. All calcs client-side. (Details: [docs/architecture.md](docs/architecture.md).)
- `index.html` = original prototype (NOT deployed); `manufacturing-cost-estimator-spec.html` = the spec (also served login-gated at `/spec`).

## Core types & calculations
All `AppState` interfaces and every cost formula live in `emura-app/lib/calculations.ts` — that file is
the single source of truth (don't restate the field lists here; they drift). Read it plus
[docs/gotchas.md](docs/gotchas.md) before touching costs. Setup model in one line: each break has a shared
**Orders/Year** (`Break.buildsPerYear`) and each FG a per-break **Lots/Year** (`FGBreak.lotsPerYear`); line
setup is private per FG (over its own lots), order setup is a shared pool allocated by lot-share.

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
