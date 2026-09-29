# Sign In Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Readify Sign In page polished and production-ready while preserving branding, authentication, routing, and the role system.

**Architecture:** Enhance `LoginPage` in place using existing CSS primitives (`.form-card`, `.field`, `.icon-input`, `.password-field`/`.password-toggle`, `.alert-*`, `.btn*`). Extract the already-duplicated password field into one shared `PasswordField` component used by both Sign In and Settings. Add a client-only `/forgot-password` info page and a minor topbar current-page treatment. No server changes.

**Tech Stack:** React 18 + Vite (client), Express + better-sqlite3 (server, untouched), Playwright E2E harness at `/tmp/opencode/e2e`.

## Global Constraints

- Frontend-only. Do not modify anything under `/workspace/server/`.
- No new npm dependencies, no new fonts, no emoji. Inline SVG only.
- Preserve Readify design tokens (purple `#4f46e5` / `--primary`, warm background, Libre Bodoni serif + Public Sans) and light/dark themes.
- Preserve the E2E DOM contract: ids `#login-email` and `#login-password`, a `<button type="submit">` inside the login `<form>`, heading text `Sign in to Readify`, admin sign-in lands on `/admin`, and a non-admin sees `Admin access required`.
- Keep the existing redirect: `location.state?.from || (role === 'admin' ? '/admin' : '/')`.
- Generic `401` message `Invalid email or password` must be used for wrong password **and** deactivated accounts (no enumeration). Do not add a distinct deactivated message.
- Behavior-preserving refactor for Settings: its E2E tests must still pass.
- Commits go directly to `master` (this repo has no remote/feature branch). Stage only the files listed per task. Commit messages end with `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.
- Test harness is outside the repo at `/tmp/opencode/e2e` (playwright installed there). Run scripts with `node <name>.mjs` from that directory. The Vite dev server runs on `:5173`, the API on `:4000`.

## File Structure

- `client/src/components/PasswordField.jsx` — **new**. One password input with label, optional leading icon, optional label-row action (for "Forgot password?"), optional inline error, optional hint, and accessible show/hide toggle.
- `client/src/components/Icons.jsx` — **modified**. Add `MailIcon`.
- `client/src/pages/LoginPage.jsx` — **modified**. Full enhancement (layout, fields, validation, feedback, loading).
- `client/src/pages/SettingsPage.jsx` — **modified**. Use shared `PasswordField`; delete the local duplicate.
- `client/src/pages/ForgotPasswordPage.jsx` — **new**. Client-only info page.
- `client/src/App.jsx` — **modified**. Add the `/forgot-password` route.
- `client/src/components/Navbar.jsx` — **modified**. Mark `/login` with `aria-current="page"` + muted style.
- `client/src/styles.css` — **modified**. Auth layout/card/label-row/nav-current rules.

---

### Task 1: Shared `PasswordField` + `MailIcon`, refactor Settings

**Files:**
- Create: `client/src/components/PasswordField.jsx`
- Modify: `client/src/components/Icons.jsx` (insert after `EyeOffIcon`, currently ends line 164)
- Modify: `client/src/pages/SettingsPage.jsx` (delete local `PasswordField` at lines 15-41; add import)
- Test: `/tmp/opencode/e2e/pwfield_check.mjs`

**Interfaces:**
- Consumes: `EyeIcon`, `EyeOffIcon` from `./Icons.jsx`.
- Produces:
  ```js
  export function PasswordField({
    id, label, value, onChange, onBlur, visible, onToggle,
    placeholder, autoComplete, hint, error, toggleLabel, leadingIcon, labelAction
  })
  ```
  - `leadingIcon`: a component (e.g. `LockIcon`) rendered at the left of the input.
  - `labelAction`: optional React node rendered right-aligned beside the label (used for the forgot-password link).
  - `autoComplete`: when omitted, derives `new-password` for labels `New password`/`Confirm new password`, else `current-password` (preserves existing Settings behavior).

> This is a behavior-preserving refactor; the test in Step 1 is a characterization test that must pass both before and after.

- [ ] **Step 1: Write the characterization test**

Create `/tmp/opencode/e2e/pwfield_check.mjs`:

```js
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
let failed = 0;
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) failed++; };

const browser = await chromium.launch();
const page = await browser.newPage();
const email = `pw_${Date.now()}@readify.test`;

await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.fill('#reg-name', 'PW Check');
await page.fill('#reg-email', email);
await page.fill('#reg-password', 'Password123');
await page.fill('#reg-confirm', 'Password123');
await page.click('form button[type="submit"]');
await page.waitForURL((u) => u.pathname === '/', { timeout: 15000 });

await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
const toggles = page.locator('.password-toggle');
ok('settings renders 4 password toggles', (await toggles.count()) === 4);

const emailPw = page.locator('#settings-email-pw');
ok('settings password starts hidden', (await emailPw.getAttribute('type')) === 'password');
await toggles.first().click();
ok('settings password reveals on toggle', (await emailPw.getAttribute('type')) === 'text');
ok('settings toggle exposes aria-pressed', (await toggles.first().getAttribute('aria-pressed')) === 'true');

console.log(`\n==== ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'} ====`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it against current code to confirm the baseline passes**

Run: `node pwfield_check.mjs` (workdir `/tmp/opencode/e2e`)
Expected: `settings renders 4 password toggles`, reveal, and aria-pressed all PASS (baseline behavior).

- [ ] **Step 3: Add `MailIcon` to `Icons.jsx`**

Insert immediately after the `EyeOffIcon` export (after line 164):

```jsx
export const MailIcon = (p) =>
  base(<><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>, p);
```

- [ ] **Step 4: Create the shared `PasswordField` component**

Create `client/src/components/PasswordField.jsx`:

```jsx
import { EyeIcon, EyeOffIcon } from './Icons.jsx';

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  visible,
  onToggle,
  placeholder,
  autoComplete,
  hint,
  error,
  toggleLabel,
  leadingIcon: LeadingIcon,
  labelAction,
}) {
  const auto =
    autoComplete ??
    (label === 'New password' || label === 'Confirm new password' ? 'new-password' : 'current-password');
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      {labelAction ? (
        <div className="label-row">
          <label htmlFor={id}>{label}</label>
          {labelAction}
        </div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      <div className={`password-field${LeadingIcon ? ' icon-input' : ''}`}>
        {LeadingIcon ? <LeadingIcon /> : null}
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={auto}
          required
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={`${visible ? 'Hide' : 'Show'} ${toggleLabel || label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={onToggle}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error ? <span className="error" id={errorId}>{error}</span> : null}
      {hint ? <span className="hint small muted" id={hintId}>{hint}</span> : null}
    </div>
  );
}
```

- [ ] **Step 5: Refactor `SettingsPage.jsx` to use the shared component**

In `client/src/pages/SettingsPage.jsx`, add to the imports (after the `ConfirmationModal` import on line 7):

```jsx
import { PasswordField } from '../components/PasswordField.jsx';
```

Then delete the local component definition, lines 15-41 (from `function PasswordField({ id, label, ...` through its closing `}`). Leave the `THEME_OPTIONS` constant and everything else unchanged.

- [ ] **Step 6: Verify build and characterization test pass**

Run: `cd /workspace/client && npm run build`
Expected: `✓ built in` with no errors.

Run: `node pwfield_check.mjs` (workdir `/tmp/opencode/e2e`)
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
cd /workspace
git add client/src/components/PasswordField.jsx client/src/components/Icons.jsx client/src/pages/SettingsPage.jsx
git commit -m "refactor(ui): extract shared PasswordField and add MailIcon

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 2: Rewrite `LoginPage` (layout, fields, validation, feedback, loading) + auth CSS

**Files:**
- Modify: `client/src/pages/LoginPage.jsx` (full file)
- Modify: `client/src/styles.css` (append auth rules)
- Test: `/tmp/opencode/e2e/signin_check.mjs`

**Interfaces:**
- Consumes: `PasswordField` (Task 1), `MailIcon` and `LockIcon` from `Icons.jsx`, `ApiError` from `../api.js`, `useAuth`, `useToast`, `useNavigate`, `useLocation`.
- Produces: a login page preserving ids `#login-email`/`#login-password`, the heading `Sign in to Readify`, `.auth-page`/`.auth-card` classes, `.label-row`, and the redirect logic.

- [ ] **Step 1: Write the failing test**

Create `/tmp/opencode/e2e/signin_check.mjs`:

```js
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
let failed = 0;
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) failed++; };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });

ok('heading "Sign in to Readify"', (await page.textContent('body')).includes('Sign in to Readify'));
ok('#login-email present', (await page.locator('#login-email').count()) === 1);
ok('#login-password present', (await page.locator('#login-password').count()) === 1);
ok('submit button in form', (await page.locator('form button[type="submit"]').count()) === 1);
ok('forgot password link', (await page.locator('a[href="/forgot-password"]').count()) === 1);

const pw = page.locator('#login-password');
const toggle = page.locator('.password-field .password-toggle');
ok('password hidden by default', (await pw.getAttribute('type')) === 'password');
ok('toggle has accessible label', ((await toggle.getAttribute('aria-label')) || '').toLowerCase().includes('password'));
await toggle.click();
ok('password revealed on toggle', (await pw.getAttribute('type')) === 'text');
ok('toggle aria-pressed true', (await toggle.getAttribute('aria-pressed')) === 'true');
await toggle.click();
ok('password hidden again', (await pw.getAttribute('type')) === 'password');

await page.click('form button[type="submit"]');
ok('empty email error', (await page.textContent('body')).includes('Enter your email address.'));
ok('empty password error', (await page.textContent('body')).includes('Enter your password.'));
ok('email aria-invalid', (await page.locator('#login-email').getAttribute('aria-invalid')) === 'true');
ok('email aria-describedby wired', (await page.locator('#login-email').getAttribute('aria-describedby')) === 'login-email-error');

await page.fill('#login-email', 'not-an-email');
await page.fill('#login-password', 'whatever');
await page.click('form button[type="submit"]');
ok('invalid email format error', (await page.textContent('body')).includes('Enter a valid email address.'));

await page.fill('#login-email', 'nobody@readify.test');
await page.fill('#login-password', 'WrongPass123');
await page.click('form button[type="submit"]');
await page.waitForSelector('.alert-error', { timeout: 10000 });
ok('generic invalid-credentials message', (await page.textContent('.alert-error')).includes('Invalid email or password'));

await page.fill('#login-email', 'alice@readify.app');
await page.fill('#login-password', 'User123!');
await page.click('form button[type="submit"]');
await page.waitForURL((u) => u.pathname !== '/login', { timeout: 15000 });
ok('successful sign-in leaves /login', new URL(page.url()).pathname !== '/login');

await page.context().clearCookies();
for (const w of [320, 390, 1280]) {
  await page.setViewportSize({ width: w, height: 820 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(`no horizontal overflow at ${w}px`, !overflow);
  const box = await page.locator('.auth-card').boundingBox();
  ok(`card horizontally centered at ${w}px`, Math.abs((box.x + box.width / 2) - w / 2) < 24);
}

console.log(`\n==== ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'} ====`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node signin_check.mjs` (workdir `/tmp/opencode/e2e`)
Expected: FAIL on `forgot password link`, password toggle checks, validation checks, and card centering (current page has none of these). The heading/id/submit checks pass.

- [ ] **Step 3: Append auth CSS to `styles.css`**

Append to the end of `client/src/styles.css`:

```css
/* =================================================================
   Sign-in polish (2026-09-10)
   ================================================================= */

.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 44px 20px;
}

.auth-card { width: 100%; max-width: 420px; padding: 34px 32px; }
.auth-card .auth-header { margin-bottom: 22px; }
.auth-card h1 { font-size: 1.9rem; margin: 6px 0 4px; }
.auth-card .auth-sub { margin-bottom: 0; }
.auth-card .field input { width: 100%; }
.auth-card .btn-block { margin-top: 6px; }
.auth-card .auth-foot { text-align: center; margin-top: 4px; }

.label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.label-row label { margin: 0; }
.label-row a { font-size: 0.82rem; font-weight: 600; color: var(--primary); }
.label-row a:hover { text-decoration: underline; }

a.nav-current { color: var(--ink-mute); pointer-events: none; }

@media (max-width: 480px) {
  .auth-page { padding: 24px 14px; }
  .auth-card { padding: 24px 18px; }
}
```

- [ ] **Step 4: Rewrite `LoginPage.jsx`**

Replace the entire contents of `client/src/pages/LoginPage.jsx` with:

```jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ApiError } from '../api.js';
import { MailIcon, LockIcon } from '../components/Icons.jsx';
import { PasswordField } from '../components/PasswordField.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value) => {
  if (!value.trim()) return 'Enter your email address.';
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
  return '';
};

const validatePassword = (value) => (value ? '' : 'Enter your password.');

function messageFor(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Invalid email or password';
    if (err.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (err.status >= 500) return 'Something went wrong on our side. Please try again.';
    return err.message || 'Sign in failed';
  }
  return "We couldn't reach the server. Check your connection and try again.";
}

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const onEmailChange = (e) => {
    setEmail(e.target.value);
    if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: '' }));
    if (formError) setFormError('');
  };

  const onPasswordChange = (e) => {
    setPassword(e.target.value);
    if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: '' }));
    if (formError) setFormError('');
  };

  const validateAll = () => {
    const next = { email: validateEmail(email), password: validatePassword(password) };
    setFieldErrors(next);
    return !next.email && !next.password;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    if (!validateAll()) return;
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      toast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/'));
    } catch (err) {
      setFormError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="form-card auth-card">
        <div className="auth-header">
          <span className="eyebrow">Welcome back</span>
          <h1>Sign in to Readify</h1>
          <p className="muted auth-sub">Continue reading and writing.</p>
        </div>

        {formError ? <div className="alert alert-error" role="alert">{formError}</div> : null}

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <div className="icon-input">
              <MailIcon />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={onEmailChange}
                onBlur={() => setFieldErrors((f) => ({ ...f, email: validateEmail(email) }))}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={fieldErrors.email ? 'true' : undefined}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              />
            </div>
            {fieldErrors.email ? <span className="error" id="login-email-error">{fieldErrors.email}</span> : null}
          </div>

          <PasswordField
            id="login-password"
            label="Password"
            labelAction={<Link to="/forgot-password">Forgot password?</Link>}
            leadingIcon={LockIcon}
            value={password}
            onChange={onPasswordChange}
            onBlur={() => setFieldErrors((f) => ({ ...f, password: validatePassword(password) }))}
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            placeholder="Your password"
            autoComplete="current-password"
            error={fieldErrors.password}
            toggleLabel="password"
          />

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} aria-busy={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="divider" />
        <p className="small muted auth-foot">
          New to Readify? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /workspace/client && npm run build`
Expected: `✓ built in` with no errors.

Run: `node signin_check.mjs` (workdir `/tmp/opencode/e2e`)
Expected: all PASS, including the forgot link, toggle, validation, generic 401, success redirect, overflow, and centering.

- [ ] **Step 6: Commit**

```bash
cd /workspace
git add client/src/pages/LoginPage.jsx client/src/styles.css
git commit -m "feat(ui): polish sign-in page with validation, feedback, and loading state

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 3: Forgot-password info page and route

**Files:**
- Create: `client/src/pages/ForgotPasswordPage.jsx`
- Modify: `client/src/App.jsx` (import + route)
- Test: `/tmp/opencode/e2e/forgot_check.mjs`

**Interfaces:**
- Consumes: `.auth-page`/`.auth-card`/`.auth-header` styles (Task 2), `Link`.
- Produces: route `/forgot-password` rendering `ForgotPasswordPage` (default export).

- [ ] **Step 1: Write the failing test**

Create `/tmp/opencode/e2e/forgot_check.mjs`:

```js
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
let failed = 0;
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) failed++; };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' });
const body = (await page.textContent('body')).toLowerCase();
ok('forgot page renders a reset heading', body.includes('reset'));
ok('explains self-serve reset is unavailable', body.includes('not available'));
ok('has a link back to sign in', (await page.locator('a[href="/login"]').count()) >= 1);

await page.click('a[href="/login"]');
await page.waitForURL((u) => u.pathname === '/login', { timeout: 10000 });
ok('back link navigates to /login', new URL(page.url()).pathname === '/login');
ok('login page links to forgot', (await page.locator('a[href="/forgot-password"]').count()) === 1);

console.log(`\n==== ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'} ====`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node forgot_check.mjs` (workdir `/tmp/opencode/e2e`)
Expected: FAIL — `/forgot-password` renders the NotFound page, so no reset heading/back link.

- [ ] **Step 3: Create `ForgotPasswordPage.jsx`**

Create `client/src/pages/ForgotPasswordPage.jsx`:

```jsx
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  return (
    <div className="auth-page">
      <div className="form-card auth-card">
        <div className="auth-header">
          <span className="eyebrow">Account help</span>
          <h1>Reset your password</h1>
          <p className="muted auth-sub">
            Self-serve password reset is not available yet. Please contact support and we'll help you
            regain access to your account.
          </p>
        </div>
        <div className="alert alert-info" role="status">
          Already signed in? You can change your password from Settings.
        </div>
        <Link to="/login" className="btn btn-primary btn-lg btn-block">Back to sign in</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the route in `App.jsx`**

Add the import after the `LoginPage` import (line 10):

```jsx
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
```

Add the route immediately after the `/login` route (line 63):

```jsx
<Route path="/forgot-password" element={<PublicLayout><ForgotPasswordPage /></PublicLayout>} />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /workspace/client && npm run build`
Expected: `✓ built in` with no errors.

Run: `node forgot_check.mjs` (workdir `/tmp/opencode/e2e`)
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd /workspace
git add client/src/pages/ForgotPasswordPage.jsx client/src/App.jsx
git commit -m "feat(ui): add forgot-password info page and route

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 4: Topbar current-page treatment for `/login`

**Files:**
- Modify: `client/src/components/Navbar.jsx`
- Test: `/tmp/opencode/e2e/nav_login_check.mjs`

**Interfaces:**
- Consumes: `useLocation` from `react-router-dom`, the `a.nav-current` rule from Task 2.
- Produces: on `/login`, the topbar Sign in link has `aria-current="page"` and class `nav-current`; no other topbar link is marked.

- [ ] **Step 1: Write the failing test**

Create `/tmp/opencode/e2e/nav_login_check.mjs`:

```js
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
let failed = 0;
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) failed++; };

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
const current = page.locator('.topbar a[aria-current="page"]');
ok('exactly one topbar current link', (await current.count()) === 1);
ok('current link is "Sign in"', (await current.textContent()).trim() === 'Sign in');
ok('Get started CTA still present', (await page.locator('.topbar a[href="/register"]').count()) === 1);

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
ok('no aria-current on home', (await page.locator('.topbar a[aria-current="page"]').count()) === 0);

console.log(`\n==== ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'} ====`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node nav_login_check.mjs` (workdir `/tmp/opencode/e2e`)
Expected: FAIL on the current-link checks (no `aria-current` today).

- [ ] **Step 3: Add `useLocation` and the current-page link**

In `client/src/components/Navbar.jsx`, change the router import (line 2) to:

```jsx
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
```

Add inside the component, after `const navigate = useNavigate();` (line 14):

```jsx
const { pathname } = useLocation();
const onLogin = pathname === '/login';
```

Replace the signed-out Sign in link (line 128) with:

```jsx
<Link
  to="/login"
  className={`btn btn-ghost btn-sm${onLogin ? ' nav-current' : ''}`}
  aria-current={onLogin ? 'page' : undefined}
>
  Sign in
</Link>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node nav_login_check.mjs` (workdir `/tmp/opencode/e2e`)
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add client/src/components/Navbar.jsx
git commit -m "feat(ui): mark sign-in link as current page in topbar

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 5: Final verification — full regression and a11y/responsive pass

**Files:**
- Verify only (no production changes expected; fix inline only if a check fails and re-run).
- Test: `/tmp/opencode/e2e/signin_check.mjs`, `/tmp/opencode/e2e/forgot_check.mjs`, `/tmp/opencode/e2e/nav_login_check.mjs`, `/tmp/opencode/e2e/pwfield_check.mjs`, `/tmp/opencode/e2e/test.mjs`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified, passing feature.

- [ ] **Step 1: Confirm the dev servers are healthy**

Run:
```bash
curl -s -o /dev/null -w "api:%{http_code}\n" http://localhost:4000/api/articles
curl -s -o /dev/null -w "vite:%{http_code}\n" http://localhost:5173/
```
Expected: `api:200` and `vite:200`. If the API is not running, start it with the background terminal: `cd /workspace/server && node src/index.js`.

- [ ] **Step 2: Run the focused smoke scripts**

Run each from `/tmp/opencode/e2e`:
```bash
node pwfield_check.mjs
node signin_check.mjs
node forgot_check.mjs
node nav_login_check.mjs
```
Expected: every script prints `ALL PASS`.

- [ ] **Step 3: Run the full existing regression suite**

Run: `node test.mjs` (workdir `/tmp/opencode/e2e`)
Expected: `==== RESULT: 84 passed, 0 failed ====`. The reported `console: Failed to load resource` lines are expected negative-path API calls from the tests.

- [ ] **Step 4: Run the sanitizer check**

Run: `node sanitize_check.mjs` (workdir `/tmp/opencode/e2e`)
Expected: `CHECK PASS`. If it returns 401, regenerate the admin cookie (`/tmp/rf_cookies.txt`) by logging in as `admin@readify.app / Admin123!`, then re-run.

- [ ] **Step 5: Final build**

Run: `cd /workspace/client && npm run build`
Expected: `✓ built in` with no errors.

- [ ] **Step 6: Report**

Summarize: files changed, the smoke results, the full-suite result, and confirm the E2E contract is intact. No commit is required for verification-only changes; if an inline fix was needed, commit it with:

```bash
cd /workspace
git add <touched files>
git commit -m "fix(ui): address sign-in verification findings

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```
