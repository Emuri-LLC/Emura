# Emura QA Checklist

Run before every production deploy. Copy this file, fill in the Pass/Fail column, and keep the copy as a dated record.

**Date:**  
**Build / commit:**  
**Tester:**  
**Environment:** ☐ localhost:3000  ☐ emura-olive.vercel.app  ☐ emura.io

Accounts needed: one **admin**, one **estimator**, one **viewer** (create via invite), plus a spare email for invite tests.

> **Migration prerequisite (advanced search):** the `quote_search_text()` / `search_quotes()` functions and `quotes_search_idx` index from `emura-app/supabase/schema.sql` must be run in the Supabase SQL Editor for the target environment before section 3.12–3.14 will pass.

---

## 1. Auth

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 1.1 | Visit `/` while logged out | Redirect to `/login` | |
| 1.2 | Visit `/login`, submit wrong password | Inline error message, no redirect | |
| 1.3 | Submit correct admin credentials | Redirect to `/`, quotes list shown | |
| 1.4 | Click Logout | Redirect to `/login`; pressing browser Back does not reveal the app | |
| 1.5 | Sign up with a new email and company name | "Check your email" screen shows the submitted email address | |
| 1.6 | Click confirmation link in email | Lands on `emura.io` (not a Supabase URL), user is signed in | |
| 1.7 | Sign up again with same email | Supabase error shown inline, no crash | |
| 1.8 | Sign in immediately after signup before confirming | Supabase "Email not confirmed" error shown inline | |

---

## 2. Org Bootstrap

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 2.1 | After confirming a brand-new account, sign in | App loads directly to quotes list, no "No organization found" error at any point | |
| 2.2 | Open Supabase → Table Editor → `organizations` | One row for the new user's company name | |
| 2.3 | Check `sites` and `departments` tables | "Main Site" and "General" rows exist, linked to the new org | |
| 2.4 | Check `org_members` | One row: new user, role = admin, department = General | |

---

## 3. Quotes List

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 3.1 | Load app with no quotes | Empty state: "No quotes yet" message visible | |
| 3.2 | Click **+ New Quote** | Blank tab editor opens; "New Quote" appears in header | |
| 3.3 | Edit quote name on Quote Info tab, blur field | Save status shows "Saving…" then "Saved" within ~2 s | |
| 3.4 | Click **← Quotes** | Returns to list; edited quote appears with updated name | |
| 3.5 | Create two more quotes | List shows 3 quotes, sorted by most-recently-updated first | |
| 3.6 | Reload the page | All 3 quotes still listed (loaded from Supabase, not localStorage) | |
| 3.7 | Click **Open** on a quote | Tab editor opens with that quote's data | |
| 3.8 | Click **Delete** on a quote | Confirmation dialog appears; confirm → quote removed from list | |
| 3.9 | Delete the currently-open quote | Returns to quotes list | |
| 3.10 | On a quote with a **primary FG + break** set, view the list | **Est. $/unit** column shows the cost/unit at that combo (monospace `$x.xx`); quotes with no primary show `—` | |
| 3.11 | Open a quote, change a material cost, return to the list | The status dot **and** Est. $/unit refresh to the new value (not stale) | |
| 3.12 | Type a part number used in a quote into **Search within quotes**, click Search | List shows matching quotes; content-only matches badged "in contents"; name/customer matches listed first | |
| 3.13 | Click **Clear** on the content search | List returns to the full quote list; the quick name/customer filter still works independently | |
| 3.14 | Content-search a term that matches nothing | "No quotes match …" empty state; no crash | |

---

## 4. Quote Info Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 4.1 | Fill in Name, Customer, Date | All fields save and reload correctly | |
| 4.2 | Paste a screenshot image into the Notes area | Image renders inline in the notes editor | |
| 4.3 | Reload the page and reopen the quote | Image still present in notes | |
| 4.4 | Export the quote, edit the JSON to set `quote.notes` to `<script>alert(1)</script>`, import it | No alert fires; notes field is empty or stripped | |
| 4.5 | Add a **Revision Note** (e.g., "Initial pricing") | Text appears in the field | |
| 4.6 | Click **Save Revision**, then make any edit | Revision Note field clears on the first edit after the save | |
| 4.7 | Open the revision selector in the Quotes List | Revision Note is shown next to the revision number | |
| 4.8 | Add volume breaks (on Finished Goods tab) | All breaks appear in Breaks section | |
| 4.9 | Open Quote Info tab on a quote that has BOM items with material costs entered | Quote Review card appears below the info cards | |
| 4.10 | Quote Review with no library data yet (fresh org) | "No library data yet" empty state shown; no crash | |
| 4.11 | Click **← Use Library** on a single finding | That line's quote value updates to the library value; Undo reverts it | |
| 4.12 | Click **← Update All from Library** | All findings applied at once; Undo reverts all | |
| 4.13 | Add a Labor Rate ("Shop Rate", $50/hr) | Rate appears in the list on Quote Info; no shopRate input visible | |
| 4.14 | Add a second Labor Rate | Both rates visible; each has name and rate fields | |
| 4.15 | Delete a Labor Rate that is assigned to an op | Rate removed; that op's rateId is cleared (falls back to settings default) | |

---

## 5. Finished Goods Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 5.1 | Click **+ Add Finished Good** | New row appears | |
| 5.2 | Enter name and description | Fields save on blur | |
| 5.3 | Enter EAU per break | Values persist on tab switch and reload | |
| 5.4 | Add a second FG; drag the first row below the second | Order changes and persists on reload | |
| 5.5 | Delete a FG | Row removed; FG-specific BOM items for that FG are no longer shown | |
| 5.6 | Set the **Primary FG** and **Primary Break** dropdowns | Selections persist on reload; Est. $/unit appears in the quotes list and pc/hr helpers appear on Operations | |
| 5.7 | Delete the FG currently set as primary | No crash; primary selection resolves to "unset" (Est. $/unit blanks, pc/hr helpers hide) | |

---

## 6. BOM Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 6.1 | Add a **Common** BOM item | Appears in Common section with Part #, Description, UOM, Qty fields | |
| 6.2 | Set Qty to `1/4` (fraction) | Field saves `0.25` on blur without resetting while typing | |
| 6.3 | Add an **FG-Specific** BOM item | Appears per-FG with individual qty fields per FG | |
| 6.4 | Check **Customer Supplied** on an item | Item shows as customer-supplied; material cost excluded from Summary | |
| 6.5 | Drag rows to reorder | New order persists on reload | |
| 6.6 | Delete an item | Row removed immediately | |
| 6.7 | Type a part number that matches a library part | Dropdown shows "From library" section with matching parts | |
| 6.8 | Select a library part | Part number, description, and UOM pre-filled from library data | |
| 6.9 | Type a part number that matches an existing BOM item | "From this quote" section shows the match | |
| 6.10 | Check the **Std** box on a non-customer-supplied item | Item is flagged standard; Material Costs tab shows a single flat-price input for it (see 7.5) | |

---

## 7. Material Costs Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 7.1 | Each BOM item (non-customer-supplied) appears as a row | Correct part numbers listed | |
| 7.2 | Enter a unit cost per break | Cost saves on blur | |
| 7.3 | Enter a Source value | Source text saves on blur | |
| 7.4 | Switch to Summary tab | Material cost line reflects entered costs × qty | |
| 7.5 | For a **Std**-flagged item, enter one flat price | A single flat-price input shown (no per-break cells); the same $/unit is used at every break in Summary | |
| 7.6 | Save the quote with a standard item priced, check `part_prices` in Supabase | A `min_qty = 0` tier row exists for that part | |

---

## 8. Equipment Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 8.1 | Click **+ Add Equipment** | New row appears | |
| 8.2 | Enter CapEx ($50,000), Hourly Run Cost, Annual Maintenance | Fields save on blur | |
| 8.3 | Check **Project-Specific** | Equipment cost calculated differently (full CapEx / TAU instead of utilization-based) | |
| 8.4 | Delete equipment | Row removed; any ops that referenced it no longer list it | |
| 8.5 | When library equipment exists (added via another quote), "From library" chips appear above the table | Chips show equipment not yet in this quote | |
| 8.6 | Click a library chip | Equipment copied into quote with library capex/run/maintenance values | |

---

## 9. Operations Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 9.1 | Add a **Direct Op** | New row with Rate, Operators, Cycle Time, Order Setup, Line Setup, Equipment fields | |
| 9.2 | Assign a labor rate to the direct op via the Rate dropdown | Rate name appears; Summary uses that op's rate | |
| 9.3 | Assign equipment to the direct op via the Equipment dropdown | Equipment chip appears on the row | |
| 9.4 | Select library equipment in Equipment dropdown | "From library" section appears; selecting copies equipment into quote | |
| 9.5 | Select library rate in Rate dropdown | Rate copied into quote's labor rates list; op now uses it | |
| 9.6 | Add an **Indirect Op** with annual hours and assign a rate | Rate shown; IL cost in Summary uses that rate | |
| 9.7 | Add a **Subcontract** with price-each and price-per-order | Appears in Subcontracts section | |
| 9.8 | Delete one of each type | Rows removed; Summary updates | |
| 9.9 | Warning shown when no labor rates defined | "No labor rates defined" banner appears in Direct Labor and Indirect sections | |
| 9.10 | With a primary FG + break set, view Direct Labor | Each op shows a grey **pc/hr** helper under its name; a line-rate banner shows the combined pc/hr and person-hrs/build | |
| 9.11 | No primary FG + break set | No pc/hr helpers or banner shown (informational only; costs unaffected) | |

---

## 10. Summary Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 10.1 | Open Summary with a fully-filled quote | Cost-per-unit table visible for each FG × break combination | |
| 10.2 | Verify sell price formula | Sell price = Total Cost ÷ (1 − Margin%) for a known margin (e.g., 30% margin on $10 cost → $14.29) | |
| 10.3 | Set margin to 0% | Sell price equals total cost | |
| 10.4 | Set margin to 100% | Sell price shown as very large or ∞ (no crash) | |
| 10.5 | Change a material cost and return to Summary | Cost-per-unit updates immediately without reload | |

---

## 11. Role Gating

Use separate browser sessions or incognito windows for each role. Generate estimator and viewer accounts via the invite flow (Section 14) first.

| # | Role | Action | Expected | Pass/Fail |
|---|------|--------|----------|-----------|
| 11.1 | Admin | Load app | Gear icon (⚙) visible in header | |
| 11.2 | Admin | Open a quote | All fields editable; Undo, Export, Import buttons present | |
| 11.3 | Estimator | Load app | No gear icon; **+ New Quote** button visible | |
| 11.4 | Estimator | Open a quote | All fields editable | |
| 11.5 | Estimator | Attempt to open admin drawer via URL or console | No drawer; no admin data accessible | |
| 11.6 | Viewer | Load app | No gear icon; no **+ New Quote** button | |
| 11.7 | Viewer | Open a quote | Tab content visible; all inputs appear disabled or non-interactive | |
| 11.8 | Viewer | Call `saveQuote` in browser console | Supabase returns permission denied; no data written | |

---

## 12. Undo / Redo

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 12.1 | Edit a field, click **↺ Undo** | Field reverts to previous value | |
| 12.2 | Undo button disabled on a fresh quote | Undo button is greyed out / disabled | |
| 12.3 | Make 5 edits, undo 5 times | State returns to pre-edit baseline | |
| 12.4 | Import a quote, click Undo | Previous quote state restored | |
| 12.5 | Create a new quote, click Undo | Previous quote state restored | |
| 12.6 | Make 45 edits (beyond 40-state limit) | No crash; oldest history entries silently dropped | |
| 12.7 | Make an edit, Undo, then click **Redo** | Edit is re-applied | |
| 12.8 | Redo button disabled after a new edit | Making any edit clears redo history; Redo button greys out | |
| 12.9 | Make edit on Operations tab, switch to Summary tab, Undo/Redo repeatedly | Stays on Summary tab; Summary shows the correct before/after state | |
| 12.10 | Make 5 edits, Undo 5 times, Redo 5 times | Returns to latest state | |

---

## 13. Import / Export

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 13.1 | Click **Export** on a populated quote | `.json` file downloaded named after the quote | |
| 13.2 | Create a blank quote, click **Import**, select the exported file | All data restored; quote name, BOM, costs, ops all present | |
| 13.3 | Reload after importing | Imported data persisted to Supabase | |
| 13.4 | Import a file with `"notes": "<img src=x onerror=alert(1)>"` | No alert fires; `onerror` attribute stripped from notes | |
| 13.5 | Import a file with `"notes": "<div style=\"background:red\">"` | No red background; `style` attribute stripped | |
| 13.6 | Import a plain text file (not JSON) | No crash; state unchanged | |
| 13.7 | Import a JSON file missing fields (e.g., no `equipment` key) | App loads with defaults for missing fields; no crash | |

---

## 14. Invite Flow

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 14.1 | Admin opens Admin Drawer → Users tab → Generate Invite Link for email A, role Estimator | Link displayed and copyable | |
| 14.2 | Open the link in an incognito window | Join page shown | |
| 14.3 | Sign up with email A on the join page | Account created; org membership set to Estimator; redirect to app | |
| 14.4 | Check Users tab in Admin Drawer | New user listed with Estimator role | |
| 14.5 | Try to accept the same token again | "Invalid or expired invite token" error | |
| 14.6 | Generate a second invite for email B, but sign up as email C | "Invalid or expired invite token" error — wrong email blocked | |
| 14.7 | Generate an invite; wait 7 days (or manually expire in DB) and click the link | "Invalid or expired invite token" error | |
| 14.8 | Admin changes user's role from Estimator to Viewer in Admin Drawer | Change saved; user's next session reflects new role | |
| 14.9 | Admin removes a user from the org | User no longer appears in Users tab; that user cannot access the app | |

---

## 15. Admin Drawer

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 15.1 | Open Admin Drawer → Org tab | Current org name shown in editable field | |
| 15.2 | Rename the org, click Save | Name updates in header and persists on reload | |
| 15.3 | Sites & Depts tab → Add a new site | New site appears in the tree | |
| 15.4 | Add a department under the new site | Department appears nested under that site | |
| 15.5 | Double-click site name to rename | Inline input appears; save updates the name | |
| 15.6 | Delete a department with no quotes | Department removed | |
| 15.7 | Delete a department that has quotes | Warning shows quote count; requires confirmation | |
| 15.8 | Close drawer by clicking backdrop or ✕ | Drawer closes; app state unchanged | |

---

## 16. Mfg Summary Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 16.1 | Open **Mfg Summary** tab with a fully-filled quote | Takt/cycle, equipment utilization, DL hours per FG per break, IL hours visible | |
| 16.2 | Equipment utilization exceeds 100% | Value shown in red with ⚠ indicator | |
| 16.3 | Slowest cycle exceeds takt time | Value shown in red with ⚠ indicator | |
| 16.4 | Slowest cycle is within takt | Value shown in green with ✓ indicator | |
| 16.5 | Quote with no operations | Sections show "No direct/indirect operations defined" | |
| 16.6 | DL setup % — verify with a quote where all time is setup | Direct Labor section shows 100% setup | |
| 16.7 | Indirect Labor section | **No "Setup %" row** is present (removed); DL section keeps its own setup % | |

---

## 17. Edge Cases & Stability

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 17.1 | Log in; watch the initial page load carefully | No "No organization found" error screen flashes before quotes list appears | |
| 17.2 | Open a quote, edit it, then rapidly click between all 8 tabs | No crashes, no blank tabs, no stale data | |
| 17.3 | Open a quote on mobile viewport (375 px wide) | Tabs scroll horizontally; no horizontal overflow on content | |
| 17.4 | Leave the app idle for 15+ minutes, then make an edit | Edit saves successfully (session still valid) | |
| 17.5 | Open the same quote in two browser tabs, edit in one | Other tab shows stale data (expected); no data corruption | |
| 17.6 | Create a quote with 10 FGs, 20 BOM items, 5 ops | No performance degradation; Summary calculates without visible lag | |
| 17.7 | Check browser console after a normal session | No unhandled errors or warnings in console | |

---

## 18. Parts & Equipment Library

Requires at least one saved quote with BOM items, material costs entered on the Material Costs tab, and equipment defined.

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 17.1 | Save a quote with a non-customer-supplied BOM item that has a part number | Part appears in Supabase `parts` table | |
| 17.2 | Enter a cost on the Material Costs tab, save the quote | Corresponding row appears in `part_prices` with the correct `min_qty` (annual purchasing qty) and `unit_cost` | |
| 17.3 | Define equipment on the Equipment tab, save the quote | Equipment row appears in `equipment_library` | |
| 17.4 | Open a second quote with the same part number at a different cost | Quote Review shows a finding for that part | |
| 17.5 | Open browser DevTools console after saving a quote | No `[library]` error messages | |
| 18.6 | Save a quote with a customer-supplied BOM item | That item does **not** appear in `parts` table | |

---

## 19. Cost Drivers (Quote Info tab)

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 19.1 | Open Quote Info on a quote with FGs, EAU, and costs | "Top Cost Drivers" panel shown below Quote Review | |
| 19.2 | Review the category table | Categories (Material / Direct Labor / Equipment / Indirect Labor / Subcontract) sorted highest → lowest annual $; % and bars shown; Total reconciles with Summary | |
| 19.3 | Review the individual drivers table | Sorted highest → lowest; capped at 7 rows with a **Show all** button | |
| 19.4 | Click **Show all**, then **Show top 7** | Toggles between full list and top 7 | |
| 19.5 | With a primary break set vs unset | Uses the primary break when set; falls back to the highest-volume break when unset (header notes which break) | |
| 19.6 | Empty quote (no costs/EAU) | "Add finished goods with EAU and entered costs…" empty state; no crash | |

---

## 20. Revision Compare

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 20.1 | Save at least one revision, then click **Compare** in the header | Modal opens with From / To dropdowns (Working Draft + each Rev) | |
| 20.2 | Compare a saved revision to the Working Draft after editing | Cost-change table shows per-FG/break $/unit deltas; detailed field-by-field changes listed | |
| 20.3 | Add/remove an op or BOM item between revisions | Added/removed items listed by name only (no full parameter dump) | |
| 20.4 | Select the same revision for From and To | "Select two different revisions" message; no crash | |
| 20.5 | Close the modal | Returns to the quote unchanged (compare is read-only) | |

---

## 21. Security Regression (added 2026-05-31)

Covers the security-review fixes. Items marked **(SQL)** require the matching block
from `emura-app/supabase/schema.sql` to have been run in the Supabase SQL Editor first.

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 21.1 | Open Admin → Users tab | Member rows show **email addresses**, not UUID strings (confirms `get_org_member_emails` deployed + guarded) | |
| 21.2 | **(SQL)** In SQL Editor, impersonate a non-member (`set local request.jwt.claims` with a random `sub`) and call `get_org_member_emails('<any-org-id>')` | Raises `not a member of this org` (cross-tenant enumeration blocked) | |
| 21.3 | In Notes, paste an image | Inserts inline as a `data:` URL and renders | |
| 21.4 | Import a JSON quote whose `notes` contains `<img src="https://example.com/x.png">` then open Quote Info | Image `src` is stripped (no external request fired); inspect element shows `<img>` without src | |
| 21.5 | In Notes, type/paste markup with an event handler (e.g. `<img src=x onerror=alert(1)>`) and reload | No script runs; `onerror` stripped on both write and render | |
| 21.6 | **(SQL)** In a one-admin org, `update org_members set role='estimator'` on that admin (or delete the row) | Raises `cannot remove or demote the last admin of an org` | |
| 21.7 | **(SQL)** In a two-admin org, demote one admin | Succeeds (guard only blocks the *last* admin) | |
| 21.8 | DevTools → Network, load any page | CSP response header has `script-src` **without** `'unsafe-eval'` in production; includes `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` | |

---

## Sign-off

| Area | Pass | Fail | Notes |
|------|------|------|-------|
| Auth (8 tests) | | | |
| Org Bootstrap (4) | | | |
| Quotes List (14) | | | |
| Quote Info (15) | | | |
| Finished Goods (7) | | | |
| BOM (10) | | | |
| Material Costs (6) | | | |
| Equipment (6) | | | |
| Operations (11) | | | |
| Summary (5) | | | |
| Role Gating (8) | | | |
| Undo (10) | | | |
| Import / Export (7) | | | |
| Invite Flow (9) | | | |
| Admin Drawer (8) | | | |
| Mfg Summary (7) | | | |
| Edge Cases (7) | | | |
| Parts & Equipment Library (6) | | | |
| Cost Drivers (6) | | | |
| Revision Compare (5) | | | |
| Security Regression (8) | | | |
| **Total** | | | |

**Deploy approved:** ☐ Yes  ☐ No — blocked on: ___________________________
