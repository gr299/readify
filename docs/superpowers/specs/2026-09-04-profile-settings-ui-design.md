# Profile + Settings UI Polish — Design

**Date:** 2026-09-04
**Status:** APPROVED (design review complete)
**Applies to:** Readify (React + Vite + Express + SQLite) — frontend only.

## Overview

Polish the visual design and interaction quality of the two account-management surfaces — **My Profile** (`/profile`) and **Settings** (`/settings`) — plus the site chrome those pages sit inside (navbar, footer), making everything fully responsive and accessible. The change is strictly **frontend**: no backend, API, route, database, authentication, or business-logic changes.

## Goals

- Make `/profile` and `/settings` look like a polished, modern publishing platform while preserving ALL existing functionality.
- Give the Profile form a coherent visual structure (it currently uses an unstyled `.form-group` markup with no shared field styling).
- Improve responsive behavior from 320px up and close accessibility gaps (labels, aria, focus, error text).
- Complete the mobile navigation for signed-in users (New Article, Profile, Settings, Sign out) and keep the footer from overflowing/crowding on small screens.

## Non-goals

- Any backend/API/route/db/auth change (including the email/password/deactivation flows — their logic is untouched).
- Any redesign of Home, Discover, the article reader, dashboard, admin, or the public author profile page (`/authors/:id`) — that page is already styled (banner/stats/social row) and stays as-is.
- Changing the global design tokens (colors, fonts, radii, shadows, theme system). The app already matches the brief's palette (purple `#4f46e5`, warm off-white `#faf9f6`, white cards, charcoal/`muted` text, editorial Libre Bodoni + Public Sans).
- Adding a "System" theme option (the app supports only Light/Dark via `ThemeContext` + `localStorage.readify_theme`; the backend has no theme API). Keep Light/Dark.
- Adding an avatar crop pipeline. Keep the existing Upload/Remove photo behavior.
- Introducing a new CSS framework, Tailwind, or a component library. Continue with plain CSS in `client/src/styles.css`.

## Current-state notes (facts the design relies on)

- Design tokens live in `styles.css` `:root` / `[data-theme="dark"]`; themes applied via `data-theme` on `<html>`; `ThemeContext` exposes `{ theme, setTheme, toggleTheme }`.
- Existing primitives to reuse: `.field`, `.form-card`, `.btn` (+ `.btn-sm/.btn-lg/.btn-outline/.btn-ghost/.btn-danger`), `.chip` (`.active`), `.alert` (`-error/-success/-info/-warning`), `.toast`, `.modal`/`.modal-overlay`, `.avatar` (+ sizes), `.page-head`/`.sub`, `.stack`, `.row`, `.divider`, `.small`, `.muted`, `.eyebrow`.
- `MyProfilePage` uses markup classes that have **no** CSS today (`.form-group`, `.chip.active` exists for chips but field rows are unstyled). Inputs/social links/bio rely on raw controls inside `.form-card`.
- `SettingsPage` was built with `.form-card` + `.stack` + `.alert`; inputs are bare (no visible labels above each control).
- Backend `password` schema (authoritative for any hint text): min 8, max 128, at least one letter `[a-zA-Z]` and one number `[0-9]`. **No uppercase requirement** — do not invent one.
- Image upload limits (authoritative for helper text): `MAX_UPLOAD_SIZE = 5 MB`; allowed `image/jpeg|png|gif|webp|svg+xml|avif`.
- Interest tags in DB: 38.
- Navbar mobile menu (≤720px, `.topbar-nav.open`) currently lists only Home/Discover/My Dashboard/Admin — missing New Article, Profile, Settings, Sign out for signed-in users. Theme toggle and account actions remain in the topbar.
- React 18 `StrictMode` is enabled in `main.jsx`. Any mount-time effect that POSTs must keep its single-submit guard (see existing `VerifyEmailPage` `sent` ref).
- E2E harness at `/tmp/opencode/e2e/` asserts a fixed DOM contract (below). The redesign must preserve these selectors; where heading copy changes by design, the matching assertion is updated in the same change.

## Approach

Frontend-only, CSS-first: add a dedicated "Profile & Settings" section (plus small chrome helpers) to `styles.css`, and update JSX markup in the four component files to use existing primitives. New reusable JSX is limited to genuinely reused leaf pieces. No backend files touched.

Files:
- `client/src/styles.css` — new primitives + responsive tuning (main change).
- `client/src/pages/MyProfilePage.jsx` — markup/structure restructure, logic unchanged.
- `client/src/pages/SettingsPage.jsx` — markup restructure, logic unchanged.
- `client/src/components/Navbar.jsx` — extend the mobile menu for signed-in users.
- `client/src/components/Footer.jsx` — small responsive tightening.
- `client/src/components/Icons.jsx` — add `EyeOffIcon` and lightweight social glyphs (GitHub, X/Twitter, LinkedIn, Google) used by the Profile social inputs. Icons are inline SVGs matching the existing file style.

## Design

### Shared page anatomy (both pages)

- Consistent header: serif `<h1>` ("My Profile", "Settings") + muted one-line subtitle below it. Use the existing `.page-head` pattern with a tweak to keep comfortable top spacing on mobile.
- All field rows styled consistently via one shared set of classes (implemented as new CSS, e.g. `.field-row`/`.form-group` semantics mirroring the existing `.field` look):
  - Visible `<label>` above each control with `htmlFor`.
  - Input/select/textarea consistent height, padding, radius, 16px font (prevents iOS zoom), `1px solid var(--line-strong)` border, purple focus ring (`box-shadow 0 0 0 3px var(--primary-soft)`, existing pattern).
  - Optional `.hint` text below a control in `muted` small type; optional `.counter` aligned bottom-right of a textarea.
  - Inline `.error` text in `--danger` near the relevant control (not color-only; include an icon or text such as "Error" pattern already used).
- Both pages keep a single centered column with a comfortable max width, full-width inputs on small screens.

### Profile page (`/profile`)

- **Page header:** "My Profile" / "Make your author profile yours — this is what readers see on your public page."
- **Photo card:** centered circular photo (existing `Avatar`, `lg`/`xl` sizing) with stacked actions beneath:
  - "Upload photo" (existing label-wrapped file input flow, `UploadIcon`).
  - "Remove photo" (only when an avatar is set, existing ghost button).
  - Helper text: "JPG, PNG, GIF, WebP, SVG, or AVIF · Max 5 MB" (verified against `ALLOWED_IMAGE_TYPES`/`MAX_UPLOAD_SIZE`).
  - Keep busy label "Uploading…" and the disabled state while uploading.
- **Display name:** labeled, full-width on mobile, `maxLength=80` retained.
- **Bio:** textarea ~120px tall (min-height), `maxLength=500` retained, live counter "n/500" aligned bottom-right, placeholder from the brief ("Tell readers a little about yourself, your interests, and what you write about.").
- **Social links:** one labeled group per platform (Website, GitHub, X (Twitter), Google Developers profile, LinkedIn) with consistent widths/heights and a small inline SVG icon prefix per platform. Existing placeholders, hints ("Full URL required" for website), and validation/API logic unchanged. Field ids stay `pf-website`, `pf-github`, `pf-twitter`, `pf-google`, `pf-linkedin`.
- **Interests:** heading "Your interests (n/5)"; description text kept. Chips remain `button.chip` with `#name` text (E2E contract: `button.chip:has-text("#javascript")`). Selected chips get a clearly distinct filled style (existing `.chip.active` is already filled purple — keep, ensure contrast). Wrapping is natural (`flex-wrap`), no horizontal overflow.
  - **Show-more:** render the first 12 chips in every case; if more exist, a muted "Show more (26)" toggle button reveals the remainder and switches to "Show fewer". Selection state and the 0/5 counter are unaffected; the toggle is cosmetic. All chips (selected or not) remain reachable via the toggle; toggling must never drop a selected chip from view while it is selected.
- **Actions:** primary "Save profile" (existing `SaveIcon`, spinner "Saving…" while busy) and secondary "View public profile" link. Buttons stack full-width below ~480px; Save stays visually dominant. Save flow, toasts, and `refresh()` unchanged. No unsaved-changes prompt (not currently supported; out of scope — do not add).

### Settings page (`/settings`, stacked single column on all sizes)

Single column, sections in order Appearance → Email → Password → Danger Zone, each as a `.form-card` with a serif section title + one-line description.

- **Appearance** — Title "Appearance"; description "Choose how Readify looks on your device." Segmented control with two options Light / Dark (existing `SunIcon`/`MoonIcon`). Selected option: filled purple with a check indicator (color + icon, not color-only); unselected: outline. Bound to `theme`/`setTheme` from `ThemeContext`. No API call; persists via existing `localStorage`. Button text remains exactly "Light" / "Dark" (E2E references `button:has-text("Dark")` / `("Light")`).
- **Email** — Title "Email". Show "Current: {user.email}". Fields labeled "New email address" and "Current password". Submit "Send verification link" (`#email-submit`). Success: `.alert-success` "Verification link sent to {email}" and, when `dev: true`, the existing clickable "Open verification link" dev-mode anchor (E2E references `a:has-text("Open verification link")`). Errors inline. Logic unchanged. Element ids `settings-email-new`, `settings-email-pw` preserved.
- **Password** — Title "Password"; description notes the session-invalidation behavior ("Changing your password signs you out everywhere else."). Three fields: Current password, New password, Confirm new password (`settings-pw-current`, `settings-pw-new`, `settings-pw-confirm`), each with an eye toggle (add `EyeOffIcon`; local visibility state per field). Helper text under New password must state the true rules: "At least 8 characters · at least one letter · one number." Local new-vs-confirm mismatch error stays; server errors shown inline. Success toast "Password updated"; loading/disabled states on submit (`pw-submit`).
- **Danger Zone** — Title "Danger Zone" (copy change from current "Danger zone" — update the E2E assertion accordingly). Card visually separated with a subtle red border + tinted treatment. Description explains that the account is hidden, sign-in stops, articles/comments remain, and an administrator can re-activate. Button "Deactivate Account" (existing trash icon) opens `ConfirmationModal`. Modal copy: title "Deactivate your account?"; body explains consequences and requires the current password in `#settings-deact-pw`; confirm label "Deactivate"; cancel closes. Never deactivate on a single click. Wrong password shows inline error in the modal ("Current password is incorrect" — E2E asserts this string). After success: toast, `logout()`, redirect to `/login` (existing logic).

### Global chrome

- **Navbar mobile menu:** for signed-in users the opened mobile menu adds "New Article", "My Profile", "Settings", and "Sign out" entries (reuse the exact same handlers/menu-close behavior as the desktop dropdown). Order when signed in: Home, Discover, My Dashboard, New Article, Admin Portal (admin only), divider, My Profile, Settings, Sign out. Anonymous menu keeps Home, Discover, Sign in, Create account. No horizontal scrolling; menu stays below the sticky topbar. Desktop nav unchanged.
- **Footer:** tighten mobile spacing/typography so nothing is clipped at 320px and taps are comfortable; preserve all links/sections and the copyright line; avoid excessive blank space between main content and footer (review `.footer { margin-top: 64px }` on small screens).

### Responsive + accessibility

- Verify at widths: 320, 375, 390, 414, 768, 1024, and desktop. At every size: no horizontal scrolling, no clipped inputs, no overlapping buttons, chips wrap, footer fits, buttons tappable.
- Breakpoints: build on existing `1024`/`720` queries; add targeted rules for narrow screens where needed (profile actions, settings Danger Zone, segmented theme control wrapping). `body` default handles wide screens.
- Accessibility specifics: every control has a visible `<label htmlFor>`; icon-only buttons (`aria-label`); segmented theme control exposed as two buttons in a labelled `role="group"` (`aria-label="Theme"`) using `aria-pressed`; focus rings retained; error text is textual (never color alone); keyboard navigation works; `prefers-reduced-motion` already handled globally.
- **Modal (`ConfirmationModal`) enhancement (frontend-only):** wire Escape-to-close (calls `onCancel` when not `busy`), move focus to the first actionable element on open, and return focus to the previously focused element on close. Confirm buttons keep their existing `disabled={busy}` behavior. This affects the shared component; verify the crop/other modals that use `modal-overlay` semantics are unaffected (they do not use `ConfirmationModal`; the change is isolated to it).

## Edge cases & rules

- Do not change any element id or class that the E2E harness depends on unless the plan updates the matching assertion in the same commit. Known contract: `#pf-name`, `#pf-bio`, `#pf-website`, `button.chip`, `button:has-text("Save profile")`, `#settings-email-new`, `#settings-email-pw`, `#email-submit`, `#settings-pw-current/-new/-confirm`, `#pw-submit`, `#settings-deact-pw`, `.modal`, `button:has-text("Deactivate account")`, `.modal button:has-text("Deactivate")`, `.toast`, `.alert-success`, `a:has-text("Open verification link")`, h1 texts "Settings", "Email updated", "Verification failed", buttons "Light"/"Dark".
- Keep all copy referenced by `page.textContent('body').includes(...)` intact except the intentional "Danger zone" → "Danger Zone" change. `:has-text()` matching is case-insensitive; `includes()` is not — mind the difference.
- No new dependencies, no network fonts beyond the existing Google Fonts import, no emoji in UI text or code. Use inline SVG icons.
- Keep React `StrictMode` semantics in mind for any new mount-time side effects (none planned; all actions remain event-driven).

## Error handling / interaction states

- Loading: buttons show busy labels/disabled while requests run (existing patterns: "Uploading…", "Saving…", "Sending…", "Updating…").
- Success: toasts for profile save / password change / email link sent; inline `.alert-success` for the email section.
- Error: inline `.alert-error`/`.error` near the relevant section/control; messages come from the API unchanged.
- Focus/hover/selected/disabled: consistent with the existing design system; ensure disabled buttons are visually obvious (opacity already handled by `.btn:disabled`).

## Testing (verification)

1. `cd /workspace/client && npx vite build` after each client change (`✓ built in ...`).
2. DOM smoke with Playwright at multiple viewports (320/375/768/1280) against the running dev server: page renders, no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`), four settings sections present, chip toggle + counter works, mobile menu contains expected items, footer not clipped.
3. Full E2E regression at `/tmp/opencode/e2e/` (existing 84 checks + any copy updates) after a backend restart (rate budgets), then `sanitize_check.mjs` → `CHECK PASS`.
4. Manual/Playwright visual pass in light + dark mode for Profile and Settings.

## Out of scope reminder

Public author profile page, all non-Profile/Settings pages, backend behavior, and the email/password/deactivation flows themselves (their UI only). No unsaved-changes prompt (not currently supported). No "System" theme option. No avatar cropping.
