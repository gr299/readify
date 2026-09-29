# Sign In Page Polish — Design

**Date:** 2026-09-10
**Status:** Approved (pending written-spec review)
**Scope:** Frontend-only, plus one new informational client route. No server, database, or role-system changes.

## Goal

Make the Readify Sign In page feel polished and production-ready while preserving the existing editorial branding, authentication behavior, routing, and role system. Enhance the current page in place rather than redesigning it.

## Non-Goals

- No redesign of RegisterPage or other pages (only the shared password field underneath).
- No server/auth code changes. Backend admin authorization already exists and is sufficient.
- No password-reset backend, token generation, or email sending.
- No new npm dependencies, fonts, or emoji.
- No change to the database schema or seeded demo accounts.

## Clarified Decisions

1. **"Forgot password?" link** opens a new client-only info page (`/forgot-password`) stating that self-serve reset is not available yet and linking back to Sign in. No reset flow.
2. **Disabled accounts** continue to surface the generic `Invalid email or password` message. The backend intentionally returns the same `401` for a wrong password and an inactive account to prevent account enumeration. This is preserved; there is no distinct "deactivated" client message.
3. **Topbar "Sign in" on `/login`** stays present but is marked as the current page (`aria-current="page"`) and visually muted; "Get started" remains the primary CTA.
4. **Approach:** focused enhancement of `LoginPage` using existing primitives, plus extraction of the already-duplicated password-field markup into one shared `PasswordField` component used by both Sign In and Settings.

## Existing Behavior To Preserve (verified)

- Auth is httpOnly-cookie based (`readify_token`). The client never stores a token and always sends `credentials: 'same-origin'`.
- `POST /api/auth/login` responses:
  - `401 "Invalid email or password"` for wrong password **and** inactive account.
  - `400` first zod validation message.
  - `429 "Too many authentication attempts. Please try again later."` from `authLimiter`.
  - `500 { error: "Internal server error" }` for unexpected errors.
- Redirect after login: `location.state?.from || (user.role === 'admin' ? '/admin' : '/')`.
- `/api/admin/*` routes are protected server-side by `requireAdminDomain` then `requireAdmin` (`401` unauthenticated, `403` non-admin). Frontend `RequireAdmin` is UX only.
- E2E contract that must not break:
  - ids `#login-email`, `#login-password`.
  - a `<button type="submit">` inside the `<form>` (matched by `form button[type="submit"]` and `button[type="submit"]`).
  - heading text `Sign in to Readify`.
  - admin login lands on `/admin`; a normal user visiting `/admin` sees `Admin access required`.
  - login success relies on cookie/session, not a client token.

## Reusable Assets

- Layout/typography: `.form-card`, `.eyebrow`, `.muted`, `.small`, `.divider`, `.container-narrow`.
- Form: `.field`, `.field label`, `.field .hint`, `.field .error`, `.field input:focus`, `.icon-input` (+ its `> svg` and `input` padding), `.password-field`, `.password-toggle`.
- Buttons: `.btn`, `.btn-primary`, `.btn-lg`, `.btn-block`, `.btn-ghost`, `.btn:disabled`; global `:focus-visible` ring.
- Feedback: `.alert`, `.alert-error`, `.alert-info`, `.alert-success`; `useToast()`.
- Icons: `EyeIcon`, `EyeOffIcon`, `LockIcon` from `components/Icons.jsx`; `MailIcon` will be added.
- Auth: `useAuth()` (`login`, `user`) from `AuthContext.jsx`; `ApiError`/`api` from `api.js`; `useNavigate`/`useLocation` with `location.state.from`.

## Design

### 1. Layout and card

- Add a `.auth-page` wrapper rendered inside the existing `.main` (`#root` is a flex column with `min-height: 100vh`; `.main` is `flex: 1`). The wrapper is a flex container that centers the card horizontally and vertically within the available main area:
  - `display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 40px 20px;`
- The card reuses `.form-card` (white `var(--surface)`) with a narrower `max-width` (~420px) and reduced padding so it reads as a focused auth card, not a wide page.
- Card content order: eyebrow "Welcome back" → `h1` "Sign in to Readify" (text preserved for E2E) → muted subtitle "Continue reading and writing." → alerts → form → forgot-password affordance → "New to Readify? Create an account".

### 2. Fields and validation

- **Email:** `.icon-input` wrapper with `MailIcon`; `id="login-email"`, `type="email"`, `autoComplete="email"`, placeholder `you@example.com`.
- **Password:** shared `PasswordField` with `LockIcon` on the left and the eye toggle on the right; `id="login-password"`, `autoComplete="current-password"`, placeholder `Your password`.
- Validation is client-side, run on submit and on field blur, and cleared as the user edits:
  - Email: must match a standard email pattern → `Enter a valid email address.`
  - Password: must be non-empty → `Enter your password.`
  - The server's `400` message is surfaced when the API rejects a request before authentication.
- No minimum password length on Sign In (the server imposes none for login; length is a registration concern).
- Inline errors render under the relevant field using `.field .error`, with a stable `id`; the input receives `aria-invalid="true"` and `aria-describedby` pointing at that id.

### 3. Password field component

- New `client/src/components/PasswordField.jsx` extracted from the canonical implementation currently local to `SettingsPage.jsx`. Props: `id`, `label`, `value`, `onChange`, `onToggle`, `visible`, `placeholder`, `autoComplete`, `hint`, `error`, optional `toggleLabel`, optional leading icon. Renders `.field` + `.password-field` with the toggle button.
- The input `type` is `password` unless `visible` is true; it is only ever shown as text when the user deliberately toggles.
- The toggle is `<button type="button">` with a dynamic `aria-label` ("Show password" / "Hide password") and `aria-pressed`.
- `SettingsPage.jsx` is updated to import this shared component instead of defining its own; behavior and tests for Settings must remain unchanged.

### 4. Button, loading, and double-submit

- Submit button: `.btn btn-primary btn-lg btn-block`, strong `var(--primary)` purple, full width. The existing `.btn-primary:hover` lift plus the global `:focus-visible` outline make it clearly interactive.
- While `busy`: `disabled`, label changes to `Signing in…`, and `aria-busy="true"`.
- Duplicate submissions are prevented by both the `disabled` attribute and an early `if (busy) return;` guard in the submit handler.

### 5. Authentication feedback mapping

Auth/server/network problems render in a top-of-form `.alert alert-error` with `role="alert"`; field-level problems render inline:

| Condition | Surfaced message |
|---|---|
| `401` | `Invalid email or password` (also covers deactivated accounts) |
| `400` | server-provided validation message |
| `429` | `Too many attempts. Please wait a moment and try again.` |
| `>= 500` | `Something went wrong on our side. Please try again.` |
| Network / fetch failure (no HTTP status) | `We couldn't reach the server. Check your connection and try again.` |
| Success | existing toast `Welcome back, {first}!`, then redirect |

Detection: `err instanceof ApiError` and `err.status` for HTTP cases; a thrown `TypeError`/`err.status === undefined` is treated as a network failure. The generic 401 message is used verbatim so no account-existence information is revealed.

### 6. Routing and backend authorization

- Redirect logic is unchanged: prefer `location.state?.from`, otherwise `/admin` for `role === 'admin'`, otherwise `/`.
- No server change. `/api/admin/*` is already protected by `requireAdminDomain` + `requireAdmin`; this is documented and verified, not reimplemented.

### 7. Header

- `Navbar` uses `useLocation()`; when the path is `/login`, the topbar Sign in link receives `aria-current="page"` and a muted class (no hover accent), signaling it is the current destination. "Get started" keeps its primary styling. Home/Discover/theme toggle/mobile menu are otherwise untouched.

### 8. Forgot password

- A `Forgot password?` link is placed beside the Password label (right-aligned in the label row) and routes to `/forgot-password`.
- New `client/src/pages/ForgotPasswordPage.jsx` uses the same `.auth-page` + `.form-card` treatment: a clear heading, an explanation that self-serve password reset is not yet available, and a link back to `/login`. No form submission, no server call.
- A new public route `/forgot-password` is added in `App.jsx` inside `PublicLayout` (no guard so signed-out users can reach it).

### 9. Accessibility

- Every input has a `<label htmlFor>`.
- Invalid fields: `aria-invalid` + `aria-describedby`.
- Error messages: `role="alert"`.
- Password toggle: accessible name + `aria-pressed`.
- Loading/submit: `aria-busy` and disabled state.
- Keyboard: global `:focus-visible` ring is preserved; no focus traps needed on this page.

### 10. Mobile responsiveness

- Card is `width: 100%` with a `max-width`, so it adapts down to 320px.
- Card padding reduces on small screens; inputs and the submit button are full width; `.btn-block` already ensures the button, and `.field input` is made full width by the card layout.
- No new topbar overflow risk; existing `<=720px`/`<=480px` rules for the header, `.mobile-only`, and `.user-chip` remain in effect.

## Files

**New**
- `client/src/components/PasswordField.jsx`
- `client/src/pages/ForgotPasswordPage.jsx`

**Modified**
- `client/src/pages/LoginPage.jsx` — full enhancement.
- `client/src/pages/SettingsPage.jsx` — import shared `PasswordField` (remove local duplicate).
- `client/src/components/Navbar.jsx` — current-page treatment for `/login`.
- `client/src/components/Icons.jsx` — add `MailIcon`.
- `client/src/App.jsx` — add `/forgot-password` route.
- `client/src/styles.css` — add `.auth-page` (centering wrapper), auth card sizing/spacing, `.field .error` presentation, and a `.nav-current`/`[aria-current="page"]` treatment. All additions are appended after existing rules and scoped to avoid affecting other pages.

## Testing and Verification

- **E2E contract:** keep ids `#login-email`/`#login-password`, a submit button in the form, the `Sign in to Readify` heading, admin→`/admin` redirect, and `Admin access required` for non-admins.
- **New smoke checks (harness in `/tmp/opencode/e2e`):**
  - Email format error and required-password error appear inline on submit.
  - `aria-invalid`/`aria-describedby` set on invalid inputs.
  - Password eye toggles `type` between `password` and `text`; `aria-pressed` updates.
  - Submit shows `Signing in…` and is disabled while in flight (can be simulated by delaying the API or observing the disabled state).
  - `Forgot password?` link routes to `/forgot-password`; the page renders and links back.
  - 401 shows the generic message; network failure shows the network message (via request interception).
  - Topbar Sign in has `aria-current="page"` on `/login`.
  - Responsive at 320 / 390 / 1280 px: no horizontal overflow; card centered; full-width controls.
- **Regression:** run the full existing suite (currently 84 tests) and the production build; both must pass. Settings tests must still pass after the `PasswordField` extraction.

## Risks and Mitigations

- **Extracting `PasswordField` could regress Settings.** Mitigation: preserve the existing prop behavior (label-derived `autoComplete`, `toggleLabel`, `hint`), and rely on the Settings E2E tests plus a focused DOM check.
- **Vertical centering depends on parent height.** Mitigation: `.auth-page` uses `min-height: 100%` inside `.main`; verify at multiple viewport heights and add a viewport fallback only if needed.
- **New icon import.** `MailIcon` is a trivial addition using the existing `base()` helper; no dependency added.
