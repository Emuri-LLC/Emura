# Emura QA Checklist

Run before every production deploy. Copy this file, fill in the Pass/Fail column, and keep the copy as a dated record.

**Date:**  
**Build / commit:**  
**Tester:**  
**Environment:** ☐ localhost:3000  ☐ emura-olive.vercel.app  ☐ emura.io

Accounts needed: one **admin**, one **estimator**, one **viewer** (create via invite), plus a spare email for invite tests.

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

---

## 4. Quote Info Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 4.1 | Fill in Name, Customer, Date, Revision | All fields save and reload correctly | |
| 4.2 | Paste a screenshot image into the Notes area | Image renders inline in the notes editor | |
| 4.3 | Reload the page and reopen the quote | Image still present in notes | |
| 4.4 | Export the quote, edit the JSON to set `quote.notes` to `<script>alert(1)</script>`, import it | No alert fires; notes field is empty or stripped | |
| 4.5 | Add 3 volume breaks | All 3 appear in the Breaks section with editable labels and EAU fields | |
| 4.6 | Delete a volume break | Break removed; Summary tab reflects the change | |

---

## 5. Finished Goods Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 5.1 | Click **+ Add Finished Good** | New row appears | |
| 5.2 | Enter name and description | Fields save on blur | |
| 5.3 | Enter EAU per break | Values persist on tab switch and reload | |
| 5.4 | Add a second FG; drag the first row below the second | Order changes and persists on reload | |
| 5.5 | Delete a FG | Row removed; FG-specific BOM items for that FG are no longer shown | |

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

---

## 7. Material Costs Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 7.1 | Each BOM item (non-customer-supplied) appears as a row | Correct part numbers listed | |
| 7.2 | Enter a unit cost per break | Cost saves on blur | |
| 7.3 | Enter a Source value | Source text saves on blur | |
| 7.4 | Switch to Summary tab | Material cost line reflects entered costs × qty | |

---

## 8. Equipment Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 8.1 | Click **+ Add Equipment** | New row appears | |
| 8.2 | Enter CapEx ($50,000), Hourly Run Cost, Annual Maintenance | Fields save on blur | |
| 8.3 | Check **Project-Specific** | Equipment cost calculated differently (full CapEx / TAU instead of utilization-based) | |
| 8.4 | Delete equipment | Row removed; any ops that referenced it no longer list it | |

---

## 9. Operations Tab

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 9.1 | Add a **Direct Op** | New row with Operators, Cycle Time, Order Setup, Line Setup fields | |
| 9.2 | Assign equipment to the direct op via the dropdown | Equipment chip appears on the row | |
| 9.3 | Add an **Indirect Op** with annual hours | Appears in Indirect section | |
| 9.4 | Add a **Subcontract** with price-each and price-per-order | Appears in Subcontracts section | |
| 9.5 | Delete one of each type | Rows removed; Summary updates | |

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

## 12. Undo

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 12.1 | Edit a field, click **↺ Undo** | Field reverts to previous value | |
| 12.2 | Undo button disabled on a fresh quote | Undo button is greyed out / disabled | |
| 12.3 | Make 5 edits, undo 5 times | State returns to pre-edit baseline | |
| 12.4 | Import a quote, click Undo | Previous quote state restored | |
| 12.5 | Create a new quote, click Undo | Previous quote state restored | |
| 12.6 | Make 45 edits (beyond 40-state limit) | No crash; oldest history entries silently dropped | |

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

## 16. Edge Cases & Stability

| # | Action | Expected | Pass/Fail |
|---|--------|----------|-----------|
| 16.1 | Log in; watch the initial page load carefully | No "No organization found" error screen flashes before quotes list appears | |
| 16.2 | Open a quote, edit it, then rapidly click between all 7 tabs | No crashes, no blank tabs, no stale data | |
| 16.3 | Open a quote on mobile viewport (375 px wide) | Tabs scroll horizontally; no horizontal overflow on content | |
| 16.4 | Leave the app idle for 15+ minutes, then make an edit | Edit saves successfully (session still valid) | |
| 16.5 | Open the same quote in two browser tabs, edit in one | Other tab shows stale data (expected); no data corruption | |
| 16.6 | Create a quote with 10 FGs, 20 BOM items, 5 ops | No performance degradation; Summary calculates without visible lag | |
| 16.7 | Check browser console after a normal session | No unhandled errors or warnings in console | |

---

## Sign-off

| Area | Pass | Fail | Notes |
|------|------|------|-------|
| Auth (8 tests) | | | |
| Org Bootstrap (4) | | | |
| Quotes List (9) | | | |
| Quote Info (6) | | | |
| Finished Goods (5) | | | |
| BOM (6) | | | |
| Material Costs (4) | | | |
| Equipment (4) | | | |
| Operations (5) | | | |
| Summary (5) | | | |
| Role Gating (8) | | | |
| Undo (6) | | | |
| Import / Export (7) | | | |
| Invite Flow (9) | | | |
| Admin Drawer (8) | | | |
| Edge Cases (7) | | | |
| **Total** | | | |

**Deploy approved:** ☐ Yes  ☐ No — blocked on: ___________________________
