# User Settings — Design

**Date:** 2026-09-01
**Status:** APPROVED (design review complete)
**Applies to:** Readify (React + Vite + Express + SQLite)

## Overview

Add a protected `/settings` page where a signed-in user manages their account:

- **Appearance** — Light/Dark theme selection. Client-side only (persisted to `localStorage` via the existing `ThemeContext`); no backend change.
- **Email** — change the account email, confirmed through an emailed verification link.
- **Password** — change password with current-password verification.
- **Danger zone** — deactivate (soft-delete) their own account.

Add a public `/verify-email` page that completes an email change. Mail delivery uses nodemailer when SMTP env vars are set, otherwise a dev fallback that logs the verification link to the server console and returns it in the response (so tests and local users can complete the flow).

## Goals

- Users can change their password safely, with other active sessions invalidated.
- Users can change their email with proof-of-control via a one-time, expiring verification link.
- Users can deactivate their own account (soft-deactivate, reversible by an admin).
- Deactivated accounts cannot sign in (fix the existing login query that ignores `active`).
- Theme preference remains a client-side concern; the Settings page surfaces the existing control.
- All new endpoints follow existing patterns: zod validation, `wrap`, CSRF origin check, httpOnly cookie, rate limiting, `trackActivity`.

## Non-goals

- Email verification for initial registration.
- Hard-deleting accounts or user content.
- Server-side preference sync / settings API for appearance.
- Password reset / forgot-password flows.
- Notification preferences (no notification system exists yet).

## Data Model

### users — new columns (nullable / defaulted)

Migration in `server/src/db.js` (mirror the existing `PRAGMA table_info` guard pattern):

| Column                  | Type     | Notes                                                        |
| ----------------------- | -------- | ------------------------------------------------------------ |
| `pending_email`         | TEXT     | New email awaiting verification (NULL when idle).             |
| `email_verify_token`    | TEXT     | One-time verification token (64 hex chars).                   |
| `email_verify_expires`  | DATETIME | UTC expiry timestamp (`now + 1 hour`).                        |
| `token_version`         | INTEGER  | `NOT NULL DEFAULT 0`. Bumped on password change.              |

### JWT versioning

`signToken` includes `v: user.token_version` in the payload. `attachUser` compares `payload.v` against the current `token_version`; on mismatch the token is treated as invalid (`req.user = null` → 401 on protected routes). This invalidates all previously-issued sessions when `token_version` is bumped.

### Associated fix: reject inactive users at login

`POST /api/auth/login` currently loads the user with `SELECT * FROM users WHERE email = ?` (no `active` filter) — a deactivated account can still sign in (verified: deactivated user receives 200 + cookie). Fix the query to `WHERE email = ? AND active = 1` so `active = 0` users are rejected with the same uniform `401 "Invalid email or password"`. This is required for both admin deactivation and the new self-deactivation to actually lock an account out.

## API

New router `server/src/routes/settings.js`, mounted at `/api/settings`. All endpoints except `/email/verify` use `requireAuth`. A dedicated `settingsLimiter` (30 requests / 15 min / IP) is applied to the whole router, on top of the global `generalLimiter`.

Reusable validation: `password` schema already exists in `server/src/validation.js` (`min 8, max 128, at least one letter and one number`) — reuse it. Email reuse: `z.string().trim().toLowerCase().email(...)` as in `login`.

### POST /api/settings/password (requireAuth, settingsLimiter)

Body: `{ current_password, new_password }`

1. Load the user; `bcrypt.compare(current_password, user.password_hash)` fails → `401 "Current password is incorrect"`.
2. Validate `new_password` via the `password` schema.
3. Reject if `new_password === current_password` → `400 "New password must be different"`.
4. Hash the new password (bcrypt cost 12), update `password_hash`, bump `token_version = token_version + 1`.
5. Re-issue a fresh cookie (`signToken` picks up the new version) so the current device stays signed in; all other sessions are invalidated.
6. `trackActivity(db, user.id, 'account.password_changed', 'user', user.id)`.
7. `200 { message: 'Password updated' }`.

### POST /api/settings/email (requireAuth, settingsLimiter)

Body: `{ new_email, password }`

1. `bcrypt.compare(password, user.password_hash)` fails → `401 "Current password is incorrect"`.
2. Normalize `new_email` (trim, lowercase); must differ from current email → `400 "New email must be different from your current email"`.
3. Another active user already has `new_email` → `409 "An account with this email already exists"`.
4. Generate token: `crypto.randomBytes(32).toString('hex')`. Send the verification link `${CLIENT_ORIGIN}/verify-email?token=<token>` via `mailer.sendVerificationLink(new_email, link)`. If SMTP is configured and the send throws → `502 "Could not send verification email"` and do **not** persist anything (dev mode never throws).
5. On successful send, store `pending_email`, `email_verify_token`, `email_verify_expires = new Date(Date.now() + 3600e3).toISOString()` (overwrites any previous pending request).
6. `trackActivity(db, user.id, 'account.email_change_requested', 'user', user.id)`.
7. Response:
   - SMTP configured: `200 { message: 'Verification link sent to <new_email>' }`.
   - Dev mode: `200 { dev: true, verification_link: link, message: 'Verification link sent to <new_email> (dev mode)' }`.

### POST /api/settings/email/verify (public, settingsLimiter)

Body: `{ token }`

1. Find user by `email_verify_token = token` where `email_verify_expires > ?` (bound = JS-generated `new Date().toISOString()`). Store and compare expiry as ISO 8601 UTC strings (`2026-09-01T02:00:00.000Z`) so SQLite string comparison is chronological. Missing / expired → `400 "Invalid or expired verification link"`.
2. `pending_email` NULL (already consumed) → `400 "Invalid or expired verification link"`.
3. Another active user has `pending_email` → `409 "An account with this email already exists"` (address claimed meanwhile).
4. Set `email = pending_email`; clear `pending_email`, `email_verify_token`, `email_verify_expires`.
5. Do NOT bump `token_version` (session continuity is fine; the request already required the password).
6. `trackActivity(db, user.id, 'account.email_changed', 'user', user.id)`.
7. `200 { email: <new email> }`.

### DELETE /api/settings/account (requireAuth, settingsLimiter)

Body: `{ password }`

1. `bcrypt.compare(password, user.password_hash)` fails → `401 "Current password is incorrect"`.
2. If `user.role === 'admin'`: count active admins; `<= 1` → `400 "At least one active administrator is required"` (mirror `admin.js` guard).
3. `UPDATE users SET active = 0 WHERE id = ?` (same as admin deactivation).
4. `clearCookie(COOKIE_NAME, ...)`.
5. `trackActivity(db, user.id, 'account.deactivated', 'user', user.id)`.
6. `200 { ok: true }`. Client redirects to `/login`.

## Mailer (`server/src/mailer.js`)

- Reads env: `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` (default false), `MAIL_FROM` (default `Readify <no-reply@readify.app>`).
- If `SMTP_HOST` is set → `nodemailer` `createTransport({ host, port, secure, auth: { user, pass } })`, `sendMail({ from: MAIL_FROM, to, subject: 'Verify your new Readify email', text })`, return `{ dev: false }`. Add `nodemailer` dependency (`server/package.json`).
- Otherwise dev mode → `console.log('[readify:mail] Verification link: <link>')`, return `{ dev: true }`.
- `sendVerificationLink(to, link)` returns `{ dev: boolean }`.

`CLIENT_ORIGIN` (env, default `http://localhost:5173`) is the link base. For the sandbox preview, set `CLIENT_ORIGIN` to the preview origin when starting the server so links resolve to the public frontend.

## Frontend

### Routes (client/src/App.jsx)

- `/settings` → `SettingsPage` (RequireAuth) — add alongside `/profile`/`/dashboard` patterns.
- `/verify-email` → `VerifyEmailPage` (public) — like `/login` but without `RequireGuest`.

### SettingsPage (`/settings`)

Single page, sections stacked:

1. **Appearance** — two option cards / segmented control (Light / Dark) bound to `ThemeContext` (`setTheme` + `theme`). No API call; theme persists via existing `localStorage` (`readify_theme`).
2. **Email** — shows current email. Form: new email + current password → `POST /api/settings/email`. On success show an inline success state: "Verification link sent to {new_email}" and, when the response is dev mode (`dev: true`), render the `verification_link` as a clickable link labeled "Open verification link (dev mode)".
3. **Password** — current password + new password + confirm new password → `POST /api/settings/password`. Local check that new === confirm; server validates strength. Toast "Password updated" on success. Client stays signed in (fresh cookie issued).
4. **Danger zone** — "Deactivate account" button opens the existing `ConfirmationModal`. The modal body asks the user to type their current password into a password input (plus confirm checkbox). Submit → `DELETE /api/settings/account` → toast, then `navigate('/login')`. On 401/400 show the error inline in the modal.

### VerifyEmailPage (`/verify-email`)

Public. Reads `?token=` on mount → `POST /api/settings/email/verify` with `{ token }`.

- Success: "Your email has been updated to {email}" + link to log in.
- Error: friendly message ("This verification link is invalid or has expired. Request a new one from Settings.") + link to `/settings`.

### Navbar

Add a **Settings** entry to the user-menu dropdown (between "Saved Articles" and the divider, or after "Admin Portal" — use a settings icon from `Icons.jsx`, e.g. `SettingsIcon`; add the icon if missing). No new nav-link.

### client/src/api.js

No new methods required. `api.del(path, body)` already sends a JSON body, so `api.del('/api/settings/account', { password })` works as-is.

## Edge Cases & Rules

- Password change invalidates all sessions except the current one (token_version bump + re-cookie).
- Email request overwrites a previous pending request; each token is single-use and expires after 1 hour.
- Verifying an email for an address that became taken meanwhile → 409.
- Deactivating the last active admin → 400.
- Inactive users (`active = 0`) cannot use any settings endpoint (requireAuth loads only `active = 1` users).
- Dev-mode verification link is returned ONLY when SMTP is not configured; never in production.
- Password verify failures and other settings requests count against `settingsLimiter` (30/15 min/IP); do not reveal whether the account exists (use a uniform 401 message).

## Error Handling

- All zod failures → 400 with the first issue message (existing `validate` middleware).
- Auth failures → 401 uniform "Current password is incorrect".
- Conflicts → 409 with descriptive messages.
- Mailer errors: if SMTP is configured but send throws, return `502 "Could not send verification email"` and do not store the token (send happens before persisting).

## Testing (E2E additions)

Extend `/tmp/opencode/e2e/test.mjs` (and reuse `cleanup.mjs` patterns):

1. **Password change**: register → change password with wrong current password (expect 401) → change with correct current (200) → old password login fails → new password login succeeds → old cookie (captured before change) rejected on `/api/settings/password` or any protected route.
2. **Email change (dev)**: request with wrong password (401) → request with taken email (409) → valid request (200, dev `verification_link` present) → visit link (`page.goto(verification_link)`) → VerifyEmailPage shows success → login with the new email works; login with the old email fails.
3. **Expired token**: request change, then set `email_verify_expires` to the past via direct SQLite (pattern used by cleanup), verify → 400.
4. **Deactivate**: wrong password (401) → correct (200) → session cleared (protected fetch returns 401) → login fails with the old credentials (covers the login `active`-filter fix) → admin re-activation makes login work again (optional admin check).
5. **Appearance**: toggle Light/Dark on `/settings` → reload → preference persists (`localStorage.readify_theme`).
6. **Login active-filter fix**: deactivated user (via `DELETE /settings/account`) attempting `POST /api/auth/login` → 401 (covered in step 4).

Each full run requires a backend restart first (in-memory rate limiters reset). Run `npx vite build` after every client change; full regression = E2E (existing 66 + new) + `sanitize_check.mjs` (`CHECK PASS`).

## Migration / Data

- `db.js` adds the four columns behind `PRAGMA table_info(users)` guards (idempotent).
- `data/` (SQLite) remains gitignored; never commit it.

## Implementation Notes

- Mount `settingsRoutes` in `index.js` under `/api/settings`.
- `server/src/routes/auth.js`: login query gains `AND active = 1` (uniform 401 on failure).
- `signToken`/`attachUser` live in `middleware/auth.js` — update both together so every new token carries `v` and old tokens without `v` still verify (treat missing `v` as version 0 for backward compatibility with pre-migration tokens).
- Add `settingsLimiter` to `middleware/rateLimit.js`.
- Add `nodemailer` to `server/package.json` (foreground install with `npm install nodemailer`).
- `settings.js` should `import { CLIENT_ORIGIN } from '../config.js'` for link construction.
