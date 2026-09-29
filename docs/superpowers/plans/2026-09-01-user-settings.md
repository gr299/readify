# User Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings` page where users change their password, change their email (with link verification), pick a Light/Dark theme, and deactivate their own account, backed by a new `/api/settings` route.

**Architecture:** New backend router `server/src/routes/settings.js` mounted at `/api/settings` with four endpoints (password change, email-change request, email verify, account deactivate). New `server/src/mailer.js` sends verification links via nodemailer when SMTP env vars exist, otherwise dev mode logs/returns the link. JWT gains a `token_version` (`v`) so password changes revoke other sessions; login rejects `active = 0` users. Frontend adds `SettingsPage` (`/settings`, auth-guarded) and `VerifyEmailPage` (`/verify-email`, public).

**Tech Stack:** Express 4, better-sqlite3, zod, bcryptjs, nodemailer (new), jsonwebtoken, express-rate-limit; React 18 + Vite + react-router-dom.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-01-user-settings-design.md` (authoritative).
- All settings endpoints live under `/api/settings` and run behind `settingsLimiter` (30 requests / 15 min / IP) plus the global `generalLimiter`.
- Reuse the existing `password` zod schema from `server/src/validation.js`; email uses `z.string().trim().toLowerCase().email(...).max(255)` (as in `login`).
- bcrypt cost 12; auth cookie `readify_token`, `httpOnly`, `sameSite: 'lax'`, `secure: false`, `path: '/'`, 7d.
- JWT payload carries `v: user.token_version`; `attachUser` treats a mismatch as unauthenticated; a token with no `v` is treated as `v = 0`.
- `POST /api/auth/login` must reject `active = 0` users with the same uniform `401 "Invalid email or password"`.
- Email verification token: 64 hex chars, single-use, 1-hour expiry, stored/compar as ISO 8601 UTC strings.
- Dev mode returns `verification_link` in the response ONLY when SMTP is not configured.
- Deactivation sets `active = 0` and refuses if the user is the last active admin (`400 "At least one active administrator is required"`).
- Password change bumps `token_version` and re-issues a fresh cookie in the same response.
- Never commit `data/` (SQLite). `client/`, `server/` source is untracked in git (repo predates the app) — commit only the files each task touches.
- Restart the backend after every server-file change (resets in-memory rate limiters). Run `cd /workspace/client && npx vite build` after every client change.
- E2E lives at `/tmp/opencode/e2e/test.mjs` (untracked). Full regression: restart backend → `node cleanup.mjs` → `node test.mjs` → `node sanitize_check.mjs` (`CHECK PASS`).

---

### Task 1: DB migration + JWT versioning + login active filter

**Files:**
- Modify: `server/src/db.js` (after the social-links migration loop, ~line 78)
- Modify: `server/src/middleware/auth.js` (`signToken`, `attachUser`)
- Modify: `server/src/routes/auth.js` (login query)

**Interfaces:**
- Consumes: existing `JWT_SECRET`, `COOKIE_NAME`, `db`, `ApiError` from `../utils.js`.
- Produces: `users.token_version` (INTEGER, default 0), `users.pending_email`, `users.email_verify_token`, `users.email_verify_expires`; `signToken(user)` embeds `v`; `attachUser` enforces version + `active = 1`; login rejects inactive users.

- [ ] **Step 1: Add the migration columns**

In `server/src/db.js`, immediately after the existing `userCols` social-links loop, add:

```js
// Migration: user settings (password change / email verification / deactivation).
for (const [col, decl] of [
  ['pending_email', 'TEXT'],
  ['email_verify_token', 'TEXT'],
  ['email_verify_expires', 'DATETIME'],
  ['token_version', 'INTEGER NOT NULL DEFAULT 0'],
]) {
  if (!userCols.includes(col)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${col} ${decl}`);
  }
}
```

- [ ] **Step 2: Update `signToken` and `attachUser`**

In `server/src/middleware/auth.js`:

```js
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, v: user.token_version ?? 0 },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
```

Replace the `attachUser` verification block:

```js
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.sub);
    if (!user || (payload.v ?? 0) !== (user.token_version ?? 0)) {
      req.user = null;
      return next();
    }
    req.user = user;
    req.token = token;
    return next();
  } catch {
    req.user = null;
    return next();
  }
```

- [ ] **Step 3: Fix the login query**

In `server/src/routes/auth.js` (the `POST /login` handler):

```js
const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
```

- [ ] **Step 4: Restart backend and verify**

Run: `kill` the running backend terminal (`term_1788224609304_37`) via `background_terminal_kill`, then `background_terminal_create` with `cd /workspace/server && node src/index.js`. Wait for `http://localhost:4000/api/health` → 200.

Run (replace `<ts>` with a timestamp):

```bash
cd /tmp/opencode/e2e
C1=$(mktemp)
EMAIL="t1_$(date +%s)@readify.test"
curl -s -c $C1 -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Plan T1\",\"email\":\"$EMAIL\",\"password\":\"Password123\"}" > /dev/null
curl -s -b $C1 http://localhost:4000/api/auth/me            # expect {"user":{...}}
```

Expected: `user` present. Now bump the version and confirm the old token is rejected:

```bash
node -e "const{createRequire}=require('node:module');const r=createRequire('/workspace/server/package.json');const db=r('better-sqlite3')('/workspace/data/readify.db');db.prepare('UPDATE users SET token_version = 1 WHERE email = ?').run('$EMAIL');db.close();"
curl -s -b $C1 http://localhost:4000/api/auth/me            # expect {"user":null}
```

Expected: `user` is `null` (version mismatch invalidates the token). Now confirm login rejects an inactive user:

```bash
node -e "const{createRequire}=require('node:module');const r=createRequire('/workspace/server/package.json');const db=r('better-sqlite3')('/workspace/data/readify.db');db.prepare('UPDATE users SET active = 0 WHERE email = ?').run('$EMAIL');db.close();"
curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Password123\"}"
```

Expected: `401 {"error":"Invalid email or password"}`.

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add server/src/db.js server/src/middleware/auth.js server/src/routes/auth.js
git commit -m "feat(api): add user settings columns, JWT token versioning, reject inactive logins"
```

---

### Task 2: mailer.js + settingsLimiter + nodemailer dependency

**Files:**
- Create: `server/src/mailer.js`
- Modify: `server/src/middleware/rateLimit.js` (add `settingsLimiter`)
- Modify: `server/package.json` (add `nodemailer`)

**Interfaces:**
- Consumes: `process.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`).
- Produces: `sendVerificationLink(to, link)` → `Promise<{ dev: boolean }>`; `isSmtpConfigured()` → boolean; `settingsLimiter` (express middleware).

- [ ] **Step 1: Install nodemailer**

Run: `cd /workspace/server && npm install nodemailer`
Expected: added to `package.json` `dependencies` and `node_modules`.

- [ ] **Step 2: Create `server/src/mailer.js`**

```js
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const MAIL_FROM = process.env.MAIL_FROM || 'Readify <no-reply@readify.app>';

let transport = null;
if (SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export function isSmtpConfigured() {
  return Boolean(transport);
}

export async function sendVerificationLink(to, link) {
  if (transport) {
    await transport.sendMail({
      from: MAIL_FROM,
      to,
      subject: 'Verify your new Readify email',
      text: `Click this link to confirm your new email address:\n\n${link}\n\nIf you did not request this change, you can safely ignore this email.`,
    });
    return { dev: false };
  }
  console.log(`[readify:mail] Verification link for ${to}: ${link}`);
  return { dev: true };
}
```

- [ ] **Step 3: Add `settingsLimiter`**

In `server/src/middleware/rateLimit.js`, after the `authLimiter` definition:

```js
// Settings: 30 requests per 15 minutes per IP.
export const settingsLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many attempts. Please try again later.',
});
```

- [ ] **Step 4: Restart backend and verify dev mode**

Restart the backend (kill + recreate the background terminal). Run:

```bash
cd /workspace/server && node -e "import('./src/mailer.js').then(async m => { console.log('smtp configured:', m.isSmtpConfigured()); const r = await m.sendVerificationLink('test@example.com', 'http://localhost:5173/verify-email?token=abc'); console.log('send result:', JSON.stringify(r)); })"
```

Expected: `smtp configured: false` and the dev-mode link logged to the console (`Verification link for test@example.com: ...`), `send result: {"dev":true}`.

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add server/src/mailer.js server/src/middleware/rateLimit.js server/package.json server/package-lock.json
git commit -m "feat(api): add dev/SMTP mailer and settings rate limiter"
```

---

### Task 3: POST /api/settings/password

**Files:**
- Create: `server/src/routes/settings.js`
- Modify: `server/src/validation.js` (add settings schemas)
- Modify: `server/src/index.js` (mount router)

**Interfaces:**
- Consumes: `settingsLimiter`, `signToken`, `requireAuth`, `validate`, `schemas`, `ApiError`, `wrap`, `trackActivity`, `COOKIE_NAME`, `db`.
- Produces: router default export; `schemas.passwordChange`; mounted at `/api/settings`.

- [ ] **Step 1: Add validation schemas**

In `server/src/validation.js`, after the `interests` schema:

```js
  passwordChange: z.object({
    current_password: z.string().max(128),
    new_password: password,
  }),

  emailChange: z.object({
    new_email: z.string().trim().toLowerCase().email('A valid email is required').max(255),
    password: z.string().max(128),
  }),

  emailVerify: z.object({
    token: z.string().trim().min(1, 'Token is required').max(128),
  }),

  accountDelete: z.object({
    password: z.string().max(128),
  }),
```

- [ ] **Step 2: Create `server/src/routes/settings.js`**

```js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { COOKIE_NAME } from '../config.js';
import { ApiError, wrap, trackActivity } from '../utils.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { settingsLimiter } from '../middleware/rateLimit.js';
import { validate, schemas } from '../validation.js';

const router = Router();
router.use(settingsLimiter);

function setAuthCookie(res, user) {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

router.post(
  '/password',
  requireAuth,
  validate(schemas.passwordChange),
  wrap(async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!(await bcrypt.compare(current_password, req.user.password_hash))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    if (new_password === current_password) {
      throw new ApiError(400, 'New password must be different');
    }
    const passwordHash = await bcrypt.hash(new_password, 12);
    db.prepare(
      "UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?"
    ).run(passwordHash, req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    trackActivity(db, user.id, 'account.password_changed', 'user', user.id);
    setAuthCookie(res, user);
    return res.json({ message: 'Password updated' });
  })
);

export default router;
```

- [ ] **Step 3: Mount the router**

In `server/src/index.js`:

- Add import near the other route imports: `import settingsRoutes from './routes/settings.js';`
- Add after the `userRoutes` mount (`app.use('/api/users', userRoutes);`):

```js
app.use('/api/settings', settingsRoutes);
```

- [ ] **Step 4: Restart backend and verify**

Restart the backend. Run (replace `<ts>`):

```bash
cd /tmp/opencode/e2e
C1=$(mktemp); C2=$(mktemp)
EMAIL="t3_$(date +%s)@readify.test"
curl -s -c $C1 -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Plan T3\",\"email\":\"$EMAIL\",\"password\":\"Password123\"}" > /dev/null
# wrong current password -> 401
curl -s -o /dev/null -w 'wrong-pw:%{http_code}\n' -b $C1 -X POST http://localhost:4000/api/settings/password \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"wrong","new_password":"NewPass123"}'
# correct -> 200, response sets new cookie into C2
curl -s -o /dev/null -w 'correct:%{http_code}\n' -b $C1 -c $C2 -X POST http://localhost:4000/api/settings/password \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"Password123","new_password":"NewPass123"}'
# current session (new cookie) still valid; old cookie invalidated
curl -s -b $C2 http://localhost:4000/api/auth/me   # expect user present
curl -s -b $C1 http://localhost:4000/api/auth/me   # expect user null
# old password fails, new password works
curl -s -o /dev/null -w 'old-login:%{http_code}\n' -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Password123\"}"
curl -s -o /dev/null -w 'new-login:%{http_code}\n' -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"NewPass123\"}"
```

Expected: `wrong-pw:401`, `correct:200`, me-with-C2 user present, me-with-C1 user null, `old-login:401`, `new-login:200`.

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add server/src/routes/settings.js server/src/validation.js server/src/index.js
git commit -m "feat(api): change own password endpoint with session invalidation"
```

---

### Task 4: POST /api/settings/email + POST /api/settings/email/verify

**Files:**
- Modify: `server/src/routes/settings.js` (add two endpoints before `export default router;`)

**Interfaces:**
- Consumes: `crypto`, `CLIENT_ORIGIN`, `sendVerificationLink`, `schemas.emailChange`, `schemas.emailVerify` (all already available/imported in earlier tasks; add imports).
- Produces: `POST /api/settings/email` (returns `{ dev, verification_link?, message }` in dev, `{ message }` in SMTP mode) and `POST /api/settings/email/verify` (returns `{ email }`).

- [ ] **Step 1: Update imports**

Add to the top of `server/src/routes/settings.js`:

```js
import crypto from 'node:crypto';
import { CLIENT_ORIGIN } from '../config.js';
import { sendVerificationLink } from '../mailer.js';
```

- [ ] **Step 2: Add the two endpoints**

Insert before `export default router;` in `server/src/routes/settings.js`:

```js
router.post(
  '/email',
  requireAuth,
  validate(schemas.emailChange),
  wrap(async (req, res) => {
    const { new_email, password } = req.body;
    if (!(await bcrypt.compare(password, req.user.password_hash))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    if (new_email === req.user.email) {
      throw new ApiError(400, 'New email must be different from your current email');
    }
    const taken = db.prepare('SELECT id FROM users WHERE email = ?').get(new_email);
    if (taken) {
      throw new ApiError(409, 'An account with this email already exists');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const link = `${CLIENT_ORIGIN}/verify-email?token=${token}`;
    const { dev } = await sendVerificationLink(new_email, link);
    db.prepare(
      "UPDATE users SET pending_email = ?, email_verify_token = ?, email_verify_expires = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(new_email, token, new Date(Date.now() + 3600e3).toISOString(), req.user.id);
    trackActivity(db, req.user.id, 'account.email_change_requested', 'user', req.user.id);
    if (dev) {
      return res.json({
        dev: true,
        verification_link: link,
        message: `Verification link sent to ${new_email} (dev mode)`,
      });
    }
    return res.json({ message: `Verification link sent to ${new_email}` });
  })
);

router.post(
  '/email/verify',
  validate(schemas.emailVerify),
  wrap((req, res) => {
    const { token } = req.body;
    const user = db
      .prepare('SELECT * FROM users WHERE email_verify_token = ? AND email_verify_expires > ?')
      .get(token, new Date().toISOString());
    if (!user || !user.pending_email) {
      throw new ApiError(400, 'Invalid or expired verification link');
    }
    const taken = db.prepare('SELECT id FROM users WHERE email = ?').get(user.pending_email);
    if (taken) {
      throw new ApiError(409, 'An account with this email already exists');
    }
    const newEmail = user.pending_email;
    db.prepare(
      "UPDATE users SET email = ?, pending_email = NULL, email_verify_token = NULL, email_verify_expires = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(newEmail, user.id);
    trackActivity(db, user.id, 'account.email_changed', 'user', user.id);
    return res.json({ email: newEmail });
  })
);
```

- [ ] **Step 3: Restart backend and verify**

Restart the backend. Run:

```bash
cd /tmp/opencode/e2e
C1=$(mktemp)
EMAIL="t4_$(date +%s)@readify.test"
NEWMAIL="t4b_$(date +%s)@readify.test"
curl -s -c $C1 -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Plan T4\",\"email\":\"$EMAIL\",\"password\":\"Password123\"}" > /dev/null
# wrong password -> 401
curl -s -o /dev/null -w 'wrong-pw:%{http_code}\n' -b $C1 -X POST http://localhost:4000/api/settings/email \
  -H 'Content-Type: application/json' \
  -d "{\"new_email\":\"$NEWMAIL\",\"password\":\"bad\"}"
# taken email (admin exists) -> 409
curl -s -o /dev/null -w 'taken:%{http_code}\n' -b $C1 -X POST http://localhost:4000/api/settings/email \
  -H 'Content-Type: application/json' \
  -d '{"new_email":"admin@readify.app","password":"Password123"}'
# valid request -> 200 with dev link
RESP=$(curl -s -b $C1 -X POST http://localhost:4000/api/settings/email \
  -H 'Content-Type: application/json' \
  -d "{\"new_email\":\"$NEWMAIL\",\"password\":\"Password123\"}")
echo "$RESP" | head -c 200; echo
TOKEN=$(echo "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(new URL(JSON.parse(s).verification_link).searchParams.get('token')))")
# verify -> 200 email updated
curl -s -o /dev/null -w 'verify:%{http_code}\n' -X POST http://localhost:4000/api/settings/email/verify \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\"}"
# login with new email works, old email fails
curl -s -o /dev/null -w 'new-mail-login:%{http_code}\n' -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$NEWMAIL\",\"password\":\"Password123\"}"
curl -s -o /dev/null -w 'old-mail-login:%{http_code}\n' -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Password123\"}"
# expired token -> 400
node -e "const{createRequire}=require('node:module');const r=createRequire('/workspace/server/package.json');const db=r('better-sqlite3')('/workspace/data/readify.db');db.prepare(\"UPDATE users SET pending_email='exp@test.com', email_verify_token='deadbeef', email_verify_expires='2020-01-01T00:00:00.000Z' WHERE email='$NEWMAIL'\").run();db.close();"
curl -s -o /dev/null -w 'expired:%{http_code}\n' -X POST http://localhost:4000/api/settings/email/verify \
  -H 'Content-Type: application/json' \
  -d '{"token":"deadbeef"}'
```

Expected: `wrong-pw:401`, `taken:409`, dev link present in RESP, `verify:200`, `new-mail-login:200`, `old-mail-login:401`, `expired:400`.

- [ ] **Step 4: Commit**

```bash
cd /workspace
git add server/src/routes/settings.js
git commit -m "feat(api): email change request and verification endpoints"
```

---

### Task 5: DELETE /api/settings/account

**Files:**
- Modify: `server/src/routes/settings.js` (add endpoint before `export default router;`)

**Interfaces:**
- Consumes: `schemas.accountDelete` (already added in Task 3), `COOKIE_NAME`, `db`, `ApiError`, `trackActivity`.
- Produces: `DELETE /api/settings/account` → `200 { ok: true }` and clears the cookie.

- [ ] **Step 1: Add the endpoint**

Insert before `export default router;` in `server/src/routes/settings.js`:

```js
router.delete(
  '/account',
  requireAuth,
  validate(schemas.accountDelete),
  wrap(async (req, res) => {
    const { password } = req.body;
    if (!(await bcrypt.compare(password, req.user.password_hash))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    if (req.user.role === 'admin') {
      const admins = db
        .prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1")
        .get().c;
      if (admins <= 1) {
        throw new ApiError(400, 'At least one active administrator is required');
      }
    }
    db.prepare("UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ?").run(req.user.id);
    trackActivity(db, req.user.id, 'account.deactivated', 'user', req.user.id);
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
    return res.json({ ok: true });
  })
);
```

- [ ] **Step 2: Restart backend and verify**

Restart the backend. Run:

```bash
cd /tmp/opencode/e2e
C1=$(mktemp)
EMAIL="t5_$(date +%s)@readify.test"
curl -s -c $C1 -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Plan T5\",\"email\":\"$EMAIL\",\"password\":\"Password123\"}" > /dev/null
# wrong password -> 401
curl -s -o /dev/null -w 'wrong-pw:%{http_code}\n' -b $C1 -X DELETE http://localhost:4000/api/settings/account \
  -H 'Content-Type: application/json' \
  -d '{"password":"bad"}'
# correct -> 200
curl -s -o /dev/null -w 'deactivate:%{http_code}\n' -b $C1 -c /tmp/t5_jar.txt -X DELETE http://localhost:4000/api/settings/account \
  -H 'Content-Type: application/json' \
  -d '{"password":"Password123"}'
# session gone
curl -s -b /tmp/t5_jar.txt http://localhost:4000/api/auth/me   # expect user null
# login rejected
curl -s -o /dev/null -w 'login:%{http_code}\n' -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Password123\"}"
```

Expected: `wrong-pw:401`, `deactivate:200`, me returns user null, `login:401`.

- [ ] **Step 3: Commit**

```bash
cd /workspace
git add server/src/routes/settings.js
git commit -m "feat(api): deactivate own account endpoint"
```

---

### Task 6: Frontend — SettingsPage, VerifyEmailPage, routes, navbar link

**Files:**
- Create: `client/src/pages/SettingsPage.jsx`
- Create: `client/src/pages/VerifyEmailPage.jsx`
- Modify: `client/src/App.jsx` (imports + two routes)
- Modify: `client/src/components/Navbar.jsx` (Settings link + icon import)

**Interfaces:**
- Consumes: `api` (`post`, `del`), `useAuth`, `useToast`, `useTheme`, `ConfirmationModal`, icons (`SunIcon`, `MoonIcon`, `LockIcon`, `TrashIcon`, `SettingsIcon`), `RouteGuards` (`RequireAuth`).
- Produces: `/settings` (auth) and `/verify-email` (public) routes; Settings link in the user menu.

- [ ] **Step 1: Create `client/src/pages/SettingsPage.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { ConfirmationModal } from '../components/ConfirmationModal.jsx';
import { SunIcon, MoonIcon, LockIcon, TrashIcon } from '../components/Icons.jsx';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [emailForm, setEmailForm] = useState({ new_email: '', password: '' });
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailErr, setEmailErr] = useState('');

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState('');

  const [deactOpen, setDeactOpen] = useState(false);
  const [deactPw, setDeactPw] = useState('');
  const [deactBusy, setDeactBusy] = useState(false);
  const [deactErr, setDeactErr] = useState('');

  const requestEmailChange = async (e) => {
    e.preventDefault();
    setEmailBusy(true);
    setEmailErr('');
    setEmailMsg(null);
    try {
      const data = await api.post('/api/settings/email', emailForm);
      setEmailMsg({ text: data.message, link: data.dev ? data.verification_link : null });
      setEmailForm((f) => ({ ...f, password: '' }));
      toast('Verification link sent', 'success');
    } catch (err) {
      setEmailErr(err.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      setPwErr('New passwords do not match');
      return;
    }
    setPwBusy(true);
    setPwErr('');
    try {
      await api.post('/api/settings/password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast('Password updated', 'success');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwErr(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const deactivate = async () => {
    setDeactBusy(true);
    setDeactErr('');
    try {
      await api.del('/api/settings/account', { password: deactPw });
      toast('Account deactivated', 'success');
      await logout();
      navigate('/login');
    } catch (err) {
      setDeactErr(err.message);
      setDeactBusy(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 32, maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>Settings</h1>

      <div className="form-card" style={{ padding: '22px 26px', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>Appearance</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>Saved to this browser.</p>
        <div className="row" style={{ gap: 10 }}>
          {[
            { key: 'light', label: 'Light', icon: <SunIcon /> },
            { key: 'dark', label: 'Dark', icon: <MoonIcon /> },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`btn ${theme === opt.key ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTheme(opt.key)}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-card" style={{ padding: '22px 26px', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>Email</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>
          Current: <strong>{user?.email}</strong>
        </p>
        <form onSubmit={requestEmailChange} className="stack" style={{ gap: 12 }}>
          <input id="settings-email-new" type="email" placeholder="New email" required
            value={emailForm.new_email}
            onChange={(e) => setEmailForm((f) => ({ ...f, new_email: e.target.value }))} />
          <input id="settings-email-pw" type="password" placeholder="Current password" required
            value={emailForm.password}
            onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))} />
          {emailErr && <div className="alert alert-error">{emailErr}</div>}
          {emailMsg && (
            <div className="alert alert-success">
              {emailMsg.text}
              {emailMsg.link && (
                <> <a href={emailMsg.link}>Open verification link (dev mode)</a></>
              )}
            </div>
          )}
          <div>
            <button id="email-submit" type="submit" className="btn btn-primary" disabled={emailBusy}>
              {emailBusy ? 'Sending…' : 'Send verification link'}
            </button>
          </div>
        </form>
      </div>

      <div className="form-card" style={{ padding: '22px 26px', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>Password</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>
          <LockIcon /> Changing your password signs you out everywhere else.
        </p>
        <form onSubmit={changePassword} className="stack" style={{ gap: 12 }}>
          <input id="settings-pw-current" type="password" placeholder="Current password" required
            value={pwForm.current_password}
            onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))} />
          <input id="settings-pw-new" type="password" placeholder="New password" required
            value={pwForm.new_password}
            onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))} />
          <input id="settings-pw-confirm" type="password" placeholder="Confirm new password" required
            value={pwForm.confirm}
            onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} />
          {pwErr && <div className="alert alert-error">{pwErr}</div>}
          <div>
            <button id="pw-submit" type="submit" className="btn btn-primary" disabled={pwBusy}>
              {pwBusy ? 'Updating…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>

      <div className="form-card" style={{ padding: '22px 26px', borderColor: 'var(--danger)' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>Danger zone</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>
          Deactivating your account hides it from everyone and prevents sign-in. Your articles
          and comments stay. An administrator can re-activate it.
        </p>
        <button className="btn btn-danger" onClick={() => { setDeactErr(''); setDeactPw(''); setDeactOpen(true); }}>
          <TrashIcon /> Deactivate account
        </button>
      </div>

      <ConfirmationModal
        open={deactOpen}
        title="Deactivate your account?"
        message="Enter your current password to confirm. This can be reversed by an administrator."
        confirmLabel="Deactivate"
        busy={deactBusy}
        onConfirm={deactivate}
        onCancel={() => setDeactOpen(false)}
      >
        <input id="settings-deact-pw" type="password" placeholder="Current password"
          value={deactPw} onChange={(e) => setDeactPw(e.target.value)} autoFocus />
        {deactErr && <div className="alert alert-error">{deactErr}</div>}
      </ConfirmationModal>
    </div>
  );
}
```

- [ ] **Step 2: Create `client/src/pages/VerifyEmailPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState('loading');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('This verification link is invalid or has expired. Request a new one from Settings.');
      return;
    }
    api
      .post('/api/settings/email/verify', { token })
      .then((data) => {
        setEmail(data.email);
        setState('success');
      })
      .catch((err) => {
        setError(err.message || 'This verification link is invalid or has expired. Request a new one from Settings.');
        setState('error');
      });
  }, [token]);

  return (
    <div className="container" style={{ paddingTop: 64, maxWidth: 480 }}>
      <div className="form-card" style={{ padding: '28px 30px', textAlign: 'center' }}>
        {state === 'loading' && <p>Verifying your email…</p>}
        {state === 'success' && (
          <>
            <h1 style={{ fontSize: '1.4rem', marginBottom: 8 }}>Email updated</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              Your email has been updated to <strong>{email}</strong>.
            </p>
            <Link to="/login" className="btn btn-primary">Sign in</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 style={{ fontSize: '1.4rem', marginBottom: 8 }}>Verification failed</h1>
            <p className="muted" style={{ marginBottom: 16 }}>{error}</p>
            <Link to="/settings" className="btn btn-primary">Go to Settings</Link>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add routes in `client/src/App.jsx`**

Add imports:

```jsx
import SettingsPage from './pages/SettingsPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
```

Add after the `/profile` route block:

```jsx
      <Route
        path="/settings"
        element={
          <PublicLayout>
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          </PublicLayout>
        }
      />
      <Route
        path="/verify-email"
        element={
          <PublicLayout>
            <VerifyEmailPage />
          </PublicLayout>
        }
      />
```

- [ ] **Step 4: Add the Settings link to `client/src/components/Navbar.jsx`**

Update the icon import line:

```jsx
import { MenuIcon, PlusIcon, UserIcon, FileTextIcon, LogOutIcon, ShieldIcon, BookIcon, SunIcon, MoonIcon, SettingsIcon } from './Icons.jsx';
```

Add inside the user-menu-pop, after the Admin Portal block (and before the divider):

```jsx
                    <Link to="/settings" onClick={() => setMenuOpen(false)}>
                      <SettingsIcon /> Settings
                    </Link>
```

- [ ] **Step 5: Build and verify the DOM**

Run: `cd /workspace/client && npx vite build`
Expected: `✓ built in ...`.

Then run:

```bash
cd /tmp/opencode/e2e && cat > sets_dom.mjs <<'EOF'
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const email = `sdom_${Date.now()}@readify.test`;
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.fill('#reg-name', 'Settings DOM');
await page.fill('#reg-email', email);
await page.fill('#reg-password', 'Password123');
await page.fill('#reg-confirm', 'Password123');
await page.click('form button[type="submit"]');
await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/admin', { timeout: 15000 });
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.waitForSelector('h1:has-text("Settings")', { timeout: 15000 });
const body = await page.textContent('body');
console.log('sections:', ['Appearance', 'Email', 'Password', 'Danger zone'].every((s) => body.includes(s)));
await page.click('button:has-text("Dark")');
await page.waitForFunction(() => localStorage.getItem('readify_theme') === 'dark');
await page.goto(`${BASE}/verify-email?token=bad`, { waitUntil: 'networkidle' });
await page.waitForSelector('h1:has-text("Verification failed")', { timeout: 15000 });
console.log('verify-email error state: OK');
await browser.close();
EOF
node sets_dom.mjs
```

Expected: `sections: true`, `verify-email error state: OK`.

- [ ] **Step 6: Commit**

```bash
cd /workspace
git add client/src/pages/SettingsPage.jsx client/src/pages/VerifyEmailPage.jsx client/src/App.jsx client/src/components/Navbar.jsx
git commit -m "feat(ui): settings page, email verification page, routes, navbar link"
```

---

### Task 7: E2E additions + full regression

**Files:**
- Modify: `/tmp/opencode/e2e/test.mjs` (append sections before `// ---- Summary ----`)
- Modify: `/tmp/opencode/e2e/cleanup.mjs` (add `set_`, `set2_`, `setx_`, `setz_` prefixes)

**Interfaces:**
- Consumes: existing `check(name, ok, detail)`, `page`, `BASE` helpers in `test.mjs`.
- Produces: sections 31–35 of the suite (Settings render/appearance, password change, email dev flow, expired token, deactivate + admin guard).

- [ ] **Step 1: Update `cleanup.mjs` user prefixes**

In `/tmp/opencode/e2e/cleanup.mjs`, extend the prefix pattern to include `set_|set2_|setx_|setz_` (in addition to existing prefixes like `user_|del_|editor_|delete_|prof_|empty_|feed_|av_|plan_|dbg_|rev_|ui_|ov_`). Match the existing array/string used there.

- [ ] **Step 2: Append the settings sections to `test.mjs`**

Insert before the `// ---- Summary ----` block:

```js
// ---- 31. Settings page: render + appearance ----
await page.context().clearCookies();
const setEmail = `set_${Date.now()}@readify.test`;
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.fill('#reg-name', 'Settings User');
await page.fill('#reg-email', setEmail);
await page.fill('#reg-password', 'Password123');
await page.fill('#reg-confirm', 'Password123');
await page.click('form button[type="submit"]');
await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/admin', { timeout: 15000 });
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.waitForSelector('h1:has-text("Settings")', { timeout: 15000 });
const setBody = await page.textContent('body');
check('Settings page renders four sections', ['Appearance', 'Email', 'Password', 'Danger zone'].every((s) => setBody.includes(s)));
await page.click('button:has-text("Dark")');
await page.waitForFunction(() => localStorage.getItem('readify_theme') === 'dark');
check('Settings appearance: dark theme saved to localStorage', true);
await page.reload({ waitUntil: 'networkidle' });
check('Settings appearance: dark theme applied after reload', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark');
await page.click('button:has-text("Light")');
await page.waitForFunction(() => localStorage.getItem('readify_theme') === 'light');

// ---- 32. Settings: change password ----
await page.fill('#settings-pw-current', 'Password123');
await page.fill('#settings-pw-new', 'NewPass123');
await page.fill('#settings-pw-confirm', 'NewPass123');
await page.click('#pw-submit');
await page.waitForSelector('.toast', { timeout: 8000 });
check('Password change shows success toast', (await page.textContent('.toast')).includes('Password updated'));
const oldLogin = await page.evaluate(async (email) => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123' }), credentials: 'same-origin' });
  return r.status;
}, setEmail);
check('Password change: old password rejected (401)', oldLogin === 401, `status ${oldLogin}`);
const newLogin = await page.evaluate(async (email) => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'NewPass123' }), credentials: 'same-origin' });
  return r.status;
}, setEmail);
check('Password change: new password logs in (200)', newLogin === 200, `status ${newLogin}`);

// ---- 33. Settings: email change dev flow ----
const newMail = `set2_${Date.now()}@readify.test`;
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.waitForSelector('#settings-email-new', { timeout: 15000 });
await page.fill('#settings-email-new', newMail);
await page.fill('#settings-email-pw', 'NewPass123');
await page.click('#email-submit');
await page.waitForSelector('.alert-success', { timeout: 8000 });
const linkEl = page.locator('a:has-text("Open verification link")');
check('Email change: dev verification link shown', (await linkEl.count()) === 1);
const verifyLink = await linkEl.getAttribute('href');
check('Email change: verification link points to /verify-email', verifyLink.includes('/verify-email?token='));
const wrongPwEmail = await page.evaluate(async (mail) => {
  const r = await fetch('/api/settings/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_email: mail, password: 'badpass' }), credentials: 'same-origin' });
  return r.status;
}, newMail);
check('Email change: wrong password rejected (401)', wrongPwEmail === 401, `status ${wrongPwEmail}`);
const takenEmail = await page.evaluate(async () => {
  const r = await fetch('/api/settings/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_email: 'admin@readify.app', password: 'NewPass123' }), credentials: 'same-origin' });
  return r.status;
});
check('Email change: taken email rejected (409)', takenEmail === 409, `status ${takenEmail}`);
await page.goto(verifyLink, { waitUntil: 'networkidle' });
await page.waitForSelector('h1:has-text("Email updated")', { timeout: 15000 });
check('Verify page confirms email updated', true);
const newEmailLogin = await page.evaluate(async (email) => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'NewPass123' }), credentials: 'same-origin' });
  return r.status;
}, newMail);
check('Email change: new email logs in (200)', newEmailLogin === 200, `status ${newEmailLogin}`);
const oldEmailLogin = await page.evaluate(async (email) => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'NewPass123' }), credentials: 'same-origin' });
  return r.status;
}, setEmail);
check('Email change: old email no longer logs in (401)', oldEmailLogin === 401, `status ${oldEmailLogin}`);

// ---- 34. Settings: expired token rejected ----
const expEmail = `setx_${Date.now()}@readify.test`;
await page.context().clearCookies();
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.fill('#reg-name', 'Expired Token User');
await page.fill('#reg-email', expEmail);
await page.fill('#reg-password', 'Password123');
await page.fill('#reg-confirm', 'Password123');
await page.click('form button[type="submit"]');
await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/admin', { timeout: 15000 });
const expReq = await page.evaluate(async (mail) => {
  const r = await fetch('/api/settings/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_email: mail, password: 'Password123' }), credentials: 'same-origin' });
  return r.json();
}, `setz_${Date.now()}@readify.test`);
const expToken = new URL(expReq.verification_link).searchParams.get('token');
const { createRequire } = await import('node:module');
const sqliteRequire = createRequire('/workspace/server/package.json');
const db = sqliteRequire('better-sqlite3')('/workspace/data/readify.db');
db.prepare("UPDATE users SET email_verify_expires = '2020-01-01T00:00:00.000Z' WHERE email_verify_token = ?").run(expToken);
db.close();
const expVerify = await page.evaluate(async (tok) => {
  const r = await fetch('/api/settings/email/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tok }), credentials: 'same-origin' });
  return r.status;
}, expToken);
check('Email change: expired token rejected (400)', expVerify === 400, `status ${expVerify}`);

// ---- 35. Settings: deactivate account + admin guard ----
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.waitForSelector('button:has-text("Deactivate account")', { timeout: 15000 });
await page.click('button:has-text("Deactivate account")');
await page.waitForSelector('.modal', { timeout: 8000 });
await page.fill('#settings-deact-pw', 'wrongpass');
await page.click('.modal button:has-text("Deactivate")');
await page.waitForSelector('.modal .alert-error', { timeout: 8000 });
check('Deactivate: wrong password shows error', (await page.textContent('.modal')).includes('Current password is incorrect'));
await page.fill('#settings-deact-pw', 'Password123');
await page.click('.modal button:has-text("Deactivate")');
await page.waitForURL((u) => u.pathname === '/login', { timeout: 15000 });
check('Deactivate: redirects to login', true);
const deactLogin = await page.evaluate(async (email) => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123' }), credentials: 'same-origin' });
  return r.status;
}, expEmail);
check('Deactivate: login rejected for inactive user (401)', deactLogin === 401, `status ${deactLogin}`);
const db2 = sqliteRequire('better-sqlite3')('/workspace/data/readify.db');
const adminCount = db2.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1").get().c;
db2.close();
if (adminCount === 1) {
  const adminGuard = await page.evaluate(async () => {
    const login = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@readify.app', password: 'Admin123!' }), credentials: 'same-origin' });
    if (login.status !== 200) return login.status;
    const r = await fetch('/api/settings/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'Admin123!' }), credentials: 'same-origin' });
    return r.status;
  });
  check('Deactivate: last active admin protected (400)', adminGuard === 400, `status ${adminGuard}`);
} else {
  check('Deactivate: last active admin protected (400)', true, 'skipped, multiple active admins');
}
```

- [ ] **Step 3: Restart backend, clean, run full regression**

Restart the backend terminal (kills in-memory rate limiters). Then:

```bash
cd /tmp/opencode/e2e && node cleanup.mjs && node test.mjs 2>&1 | tail -5
```

Expected: `==== RESULT: 84 passed, 0 failed ====` (66 existing + 18 new).

Then: `node sanitize_check.mjs` → `CHECK PASS`.

- [ ] **Step 4: Commit test data note**

The E2E harness (`/tmp/opencode/e2e/`) is untracked (outside the repo). No git commit needed for it. Backend/frontend code was already committed in Tasks 1–6; verify with `git status --porcelain` that only untracked pre-existing files remain (client/server source is intentionally untracked). No further commit required.
