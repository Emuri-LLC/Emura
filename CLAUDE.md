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
- Stage: Phase 2 complete — full React app live at emura.io

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
- Frontend: Next.js (React, App Router, TypeScript)
- Hosting: Vercel (auto-deploys on git push to main)
- Database + Auth: Supabase (Phase 3 — not yet implemented)
- Payments: Stripe (Phase 6 — not yet implemented)
- Domain registrar: Namecheap (emura.io connected to Vercel)

## Project phases
- ✅ Phase 0: Environment setup (Node, Git, GitHub, Vercel)
- ✅ Phase 1: Get something live on Vercel
- ✅ Phase 2: Full React migration — all 7 tabs, calculations, drag-and-drop
- 🔜 Phase 3: Add Supabase authentication (login/signup, protect app behind auth)
- Phase 4: Cloud save/load (replace localStorage with Supabase JSONB)
- Phase 5: Organizations and sharing (org model, invite flow, roles)
- Phase 6: Launch prep (Stripe subscriptions, custom email, error tracking)

## Current state (Phase 2 complete)
- `index.html`: original prototype, kept for reference only, NOT deployed
- `manufacturing-cost-estimator-spec.html`: product specification document
- `emura-app/`: the live Next.js application deployed to emura.io
- `emura-app/public/emura.js`: intentional stub (3-line comment), all logic is in React
- All 7 tabs fully functional in React: Quote Info, Finished Goods, BOM, Material Costs, Equipment, Operations, Summary
- State persists to localStorage (`STORE_KEY = 'mce_v4'`)
- Undo/redo via history stack in page.tsx (40-state depth)
- Export/Import as JSON
- All calculations run client-side synchronously

## Key file locations

### App entry
- `emura-app/app/page.tsx` — root component; owns AppState, history, resetKey
- `emura-app/app/layout.tsx` — sets metadata and loads globals.css (no scripts)
- `emura-app/app/globals.css` — all CSS (migrated from index.html)

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

## Critical implementation gotchas

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
