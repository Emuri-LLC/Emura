# Emura — QA Testing

See [CLAUDE.md](../CLAUDE.md) for the overview.

## Overview

The checklist lives at `QA_CHECKLIST.md` (repo root). Dated result files go next to it:
`QA_RESULTS_YYYY-MM-DD.md`. Run before every production deploy.

The automated portion is a Playwright headless-Chromium script. It lives at:
```
/tmp/emura-qa-runner/index.mjs   ← the test script (not committed; rebuild from scratch each time)
```
The script is not committed to the repo because it is a disposable automation artifact —
re-generate it from the checklist rather than maintaining it as source code.

## How to re-run automated QA

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

## Writing the test script

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

## What we learned from the first QA run (2026-05-21)

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

## Keeping the test script current

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

## Test account credentials (localhost)

| Role | Email | Password |
|------|-------|----------|
| Admin | eohano@gmail.com | claudetest |
| Estimator | *(not yet created — set up via invite flow and record here)* | |
| Viewer | *(not yet created — set up via invite flow and record here)* | |

## migrateState contract

The full `migrateState` contract (every `AppState` field needs a null guard) lives in
[gotchas.md](gotchas.md#migratestate-contract-critical) — it is load-bearing for QA because
partial-JSON imports are a test case.
