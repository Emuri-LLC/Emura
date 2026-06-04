# Emura — Security

See [CLAUDE.md](../CLAUDE.md) for the overview and [gotchas.md](gotchas.md) for Supabase RLS/trigger gotchas.

## Auth & session
- Logout clears `localStorage` (`STORE_KEY`) before redirecting — prevents quote data leaking on shared devices
- `proxy.ts` gates all routes except `_next/static`, `_next/image`, and `favicon.ico`

## Input sanitization
- `quote.notes` is the **only** place a stored string becomes live HTML (rendered into a contenteditable div via `innerHTML`). All sanitization funnels through one helper, `sanitizeNotes()` in `lib/sanitize.ts`, applied at **all four** entry points: render (`QuoteInfoTab.tsx:25`), paste (`:50`), blur/commit (`:132`), and import (`migrateState` in `state.ts:75`). Sanitizing on write — not just render — means unsanitized markup never transits storage.
- `sanitizeNotes()` allowlist: tags `p br b i u em strong img`, attr `src` only, no data-attrs. An `afterSanitizeAttributes` hook strips any `<img src>` not starting with `data:` — blocks external tracking-pixel / viewer-IP-leak URLs and keeps the sanitizer in agreement with the CSP `img-src 'self' data:` directive. The hook is added/removed around each call so it can't affect other DOMPurify usage.
- Imported JSON is piped through `migrateState()` before loading — normalizes missing/malformed fields instead of casting blind
- Only the Supabase anon key is used client-side; secret key never touches the frontend

## HTTP security headers (next.config.ts)
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

## What's intentionally deferred
- localStorage is now a cache (write-through), not primary storage — primary is Supabase
- No server-side CSRF tokens — Supabase SDK handles request signing
- No client-side login rate limiting — Supabase enforces server-side; add UI feedback in Phase 6

## Security review log (2026-05-31)
A flagged-findings pass; outcomes recorded here so they aren't re-flagged:
- **`get_org_member_emails` RPC (HIGH, resolved).** The flagged "unaudited security-definer email RPC" did **not exist** in the DB — the app's call was silently erroring, which is why the Admin → Users tab showed UUIDs instead of emails. Created it in `schema.sql` **with a membership guard** (`raise exception 'not a member of this org'` unless `auth.uid()` ∈ `p_org_id`), `security definer` + `row_security off`, granted to `authenticated` only. This both fixes email resolution and makes the hypothesized cross-tenant enumeration impossible by construction. Guard columns are table-qualified (`m.user_id`) — an unqualified `user_id` collides with the `RETURNS TABLE` OUT-variable and makes the guard always fail.
- **CSP `'unsafe-eval'` (MEDIUM, resolved).** Removed from production (dev-only now). `'unsafe-inline'` in `script-src` kept deliberately: the only HTML sink is `quote.notes`, guarded by `sanitizeNotes`; worst-case is a stored cross-user XSS within an org via a DOMPurify bypass. Full nonce/SRI hardening was evaluated and declined — nonces force dynamic rendering (kills static/CDN caching, conflicts with the speed mission); SRI is experimental.
- **External `<img src>` in notes (LOW, resolved).** `sanitizeNotes` now strips non-`data:` image src — see Input sanitization above.
- **Notes saved without re-sanitizing (LOW, resolved).** Write paths now sanitize too — see Input sanitization above.
- **Last-admin orphaning (LOW, resolved).** RLS let any admin demote/remove any member incl. the last admin (UI-only guard in `AdminDrawer`). Added `prevent_last_admin_change()` trigger (`before update or delete on org_members`) in `schema.sql` — blocks demoting/deleting the last admin at the DB level. `security definer` + `row_security off` so the admin count sees all rows.
- **Invite tokens in URL query (LOW, accepted).** Single-use + 7-day expiry + 192-bit random + `Referrer-Policy` containment. Acceptable residual; no change.
