# Profile + Settings UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polished, responsive, accessible redesign of the My Profile and Settings pages plus chrome (navbar mobile menu, footer), frontend-only.

**Architecture:** CSS-first, reusing the existing design tokens/primitives in `client/src/styles.css` (`.field`, `.form-card`, `.btn`, `.chip`, `.alert`, `.modal`) and existing logic in the page components untouched. New markup re-uses these classes; a few leaf pieces (password eye toggles, brand icons, segmented theme control, collapsible chip list) are added inline in the two pages / `Icons.jsx`. No backend/API/route/db/auth changes.

**Tech Stack:** React 18 (Vite), React Router, plain CSS (`client/src/styles.css`), no new dependencies. E2E harness (Playwright) lives at `/tmp/opencode/e2e/` (untracked, outside the repo).

## Global Constraints

- Frontend-only. Never edit files under `/workspace/server/`, never change routes, API payloads, or business logic.
- Spec (authoritative): `/workspace/docs/superpowers/specs/2026-09-04-profile-settings-ui-design.md`.
- Preserve the E2E DOM contract. Any element id/class the harness asserts on MUST keep working (full list in spec "Edge cases & rules"). The only intentional string change is the Settings heading "Danger zone" → "Danger Zone" (E2E updated in Task 6); Playwright `:has-text()` is case-insensitive, but `body.includes()` is NOT.
- Backend `password` validation is authoritative for hint text: min 8, max 128, at least one letter and one number. Do NOT state an uppercase requirement.
- Upload helper text is authoritative: "JPG, PNG, GIF, WebP, SVG, or AVIF · Max 5 MB".
- No emoji in UI text/code. Inline SVG icons only. No new npm dependencies, no new fonts.
- `data/` is never committed. Commit ONLY the files each task touches (many client source files are intentionally untracked; they become tracked when first staged by a task).
- React 18 `StrictMode` is on: no mount-time POST side effects without a single-submit guard.
- Every task ends with a successful `npx vite build` (expected `✓ built in ...s`).
- Existing running services: Vite dev server (`:5173`, HMR) and API (`:4000`). E2E requires a backend restart before the full run (in-memory rate limiters reset).

## File Structure

- `client/src/styles.css` — appended new primitives: account page layout, field helpers (icon input, password toggle, textarea-lg, counter), edit-avatar header, chip-list/show-more, settings section cards + segmented theme control + danger card, action rows, chrome helpers (`.mobile-only`, `.mobile-btn`, `.mobile-divider`), footer/nav responsive tweaks.
- `client/src/components/Icons.jsx` — add `EyeOffIcon` (stroke, lucide-style) and 4 filled brand glyphs (`GitHubIcon`, `TwitterIcon`, `LinkedInIcon`, `GoogleIcon`) plus a small filled-icon `brand()` helper.
- `client/src/components/ConfirmationModal.jsx` — a11y: focus first focusable on open, restore focus on close, Escape-to-close (only when not busy).
- `client/src/pages/MyProfilePage.jsx` — restructured markup (edit-avatar header, `.field` rows, icon-prefixed social inputs, larger bio + counter, collapsible interest chips, stacked actions). All logic unchanged.
- `client/src/pages/SettingsPage.jsx` — restructured markup (sectioned cards, segmented theme control, labeled fields with password visibility toggles + hint, Danger Zone card). All logic unchanged; headings/text per spec.
- `client/src/components/Navbar.jsx` — signed-in/out mobile menu items added under `.mobile-only` (hidden on desktop).
- `client/src/components/Footer.jsx` — markup unchanged; spacing handled in CSS (Task 1).
- E2E (not committed): `/tmp/opencode/e2e/test.mjs` — two copy/selector updates (Task 6).

---

### Task 1: CSS foundation + new icons

**Files:**
- Modify: `client/src/styles.css` (append at end of file)
- Modify: `client/src/components/Icons.jsx` (append new icons + helper)

**Interfaces:**
- Produces: CSS classes consumed by later tasks — `.acct-page`, `.field .counter`, `.textarea-lg`, `.icon-input`, `.password-field`, `.password-toggle`, `.edit-avatar`, `.avatar-ring`, `.edit-avatar-actions`, `.chip-list`, `.chip-toggle`, `.settings-stack`, `.settings-section`, `.section-desc`, `.seg`, `.card-danger`, `.acct-actions`, `.acct-subhead`, `.mobile-only`, `.mobile-btn`, `.mobile-divider`, plus `@media (max-width:720px)`/`(max-width:480px)` additions. Produces icons consumed by Task 3 (`GitHubIcon`, `TwitterIcon`, `LinkedInIcon`, `GoogleIcon`) and Task 4 (`EyeOffIcon`).
- Consumes: existing CSS tokens/variables only.

- [ ] **Step 1: Append the icon additions to `client/src/components/Icons.jsx`**

Open `client/src/components/Icons.jsx`. Immediately after the `base` helper at the top (line 16), add a `brand` helper:

```jsx
const brand = (path, props) => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    {path}
  </svg>
);
```

At the very end of the file (after the `KeyIcon` export) append:

```jsx
export const EyeOffIcon = (p) =>
  base(<><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /></>, p);

export const GitHubIcon = (p) =>
  brand(<path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />, p);

export const TwitterIcon = (p) =>
  brand(<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />, p);

export const LinkedInIcon = (p) =>
  brand(<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.72C24 .77 23.2 0 22.22 0Z" />, p);

export const GoogleIcon = (p) =>
  brand(<path d="M21.35 11.1h-9.17v2.9h6.51c-.33 3.25-2.89 5.5-6.51 5.5-3.83 0-6.94-3.11-6.94-6.94S8.35 5.62 12.18 5.62c1.74 0 3.31.63 4.54 1.66l2.15-2.15C17.36 3.8 15.16 2.9 12.18 2.9 7.02 2.9 2.9 7.02 2.9 12.18s4.12 9.28 9.28 9.28c5.35 0 8.9-3.76 8.9-9.18 0-.71-.08-1.26-.22-1.8Z" />, p);
```

- [ ] **Step 2: Append the CSS foundation to `client/src/styles.css`**

Append exactly the following to the end of `client/src/styles.css` (after the final `@media (max-width: 720px)` block):

```css
/* =================================================================
   Profile + Settings polish (2026-09-04)
   Reuses existing tokens. Appended after the responsive block so
   later rules win at small sizes.
   ================================================================= */

.acct-page { width: 100%; max-width: 780px; margin: 0 auto; padding: 44px 20px 8px; }
.acct-page .page-head { padding: 0 0 24px; }
.acct-page h1 { font-size: clamp(1.7rem, 4vw, 2.2rem); }

.acct-page .field label { display: inline-flex; align-items: center; gap: 6px; }
.acct-page .field input, .acct-page .field textarea { width: 100%; }
.acct-page .field .hint { margin-top: 2px; }
.acct-page .field .counter { align-self: flex-end; margin-top: 5px; font-variant-numeric: tabular-nums; }

.textarea-lg { min-height: 132px !important; resize: vertical; }

.icon-input { position: relative; }
.icon-input > svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--ink-mute); pointer-events: none; }
.icon-input input { padding-left: 38px; }

.password-field { position: relative; }
.password-field input { padding-right: 46px; }
.password-toggle {
  position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
  width: 32px; height: 32px; display: grid; place-items: center;
  border: none; background: transparent; color: var(--ink-mute);
  border-radius: 8px; font-size: 1rem;
}
.password-toggle:hover { color: var(--primary); background: var(--bg-alt); }

.edit-avatar { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 0 20px; }
.avatar-ring { padding: 5px; border: 1px solid var(--line); border-radius: 50%; background: var(--surface); box-shadow: var(--shadow-sm); }
.edit-avatar .avatar-xl { width: 104px; height: 104px; font-size: 2.6rem; }
.edit-avatar-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
.edit-avatar .hint { display: block; margin-top: 10px; font-size: 0.78rem; color: var(--ink-mute); }

.acct-subhead {
  font-family: var(--serif); font-size: 1.2rem; font-weight: 700;
  margin: 28px 0 12px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
}

.chip-list { display: flex; flex-wrap: wrap; gap: 9px; }
.chip.active { box-shadow: 0 0 0 3px var(--primary-soft); }
.chip-toggle {
  background: none; border: none; color: var(--primary); font-weight: 600;
  font-size: 0.86rem; padding: 6px 4px; margin-top: 8px; cursor: pointer; border-radius: 6px;
}
.chip-toggle:hover { text-decoration: underline; }

.settings-stack { display: flex; flex-direction: column; gap: 18px; }
.settings-section {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 24px 26px;
}
.settings-section > h2 { font-size: 1.3rem; margin-bottom: 4px; }
.section-desc { color: var(--ink-mute); font-size: 0.92rem; margin-bottom: 20px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.settings-section form { display: flex; flex-direction: column; gap: 14px; }
.settings-section form .alert { margin-bottom: 0; }

.seg { display: inline-flex; gap: 4px; padding: 4px; background: var(--bg-alt); border: 1px solid var(--line); border-radius: 999px; }
.seg button {
  display: inline-flex; align-items: center; gap: 8px; border: none; background: transparent;
  color: var(--ink-soft); font-weight: 600; font-size: 0.92rem;
  padding: 9px 18px; border-radius: 999px; cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.seg button:hover { color: var(--ink); }
.seg button.active { background: var(--primary); color: #fff; box-shadow: 0 1px 3px rgba(79, 70, 229, 0.35); }

.settings-section.card-danger { border: 1px solid var(--danger); background: var(--danger-soft); }
.settings-section.card-danger h2 { color: var(--danger); }

.acct-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
.acct-actions .btn-primary { min-width: 150px; }

.mobile-only { display: none; }
.mobile-divider { display: none; }

@media (max-width: 720px) {
  .footer { margin-top: 36px; }
  .footer-inner { padding: 26px 0 18px; gap: 22px; }
  .topbar-nav.open .mobile-divider { display: block; border-top: 1px solid var(--line); margin: 6px 0; }
  .topbar-nav.open .mobile-only { display: flex; align-items: center; gap: 10px; width: 100%; }
  .topbar-nav.open button.mobile-only {
    display: flex; background: none; border: none; text-align: left; font: inherit;
    color: var(--ink-soft); font-weight: 500;
  }
  .topbar-nav.open button.mobile-only:hover { background: var(--bg-alt); color: var(--ink); }
}

@media (max-width: 480px) {
  .acct-page { padding: 28px 16px 4px; }
  .settings-section { padding: 20px 18px; }
  .seg { display: flex; width: 100%; }
  .seg button { flex: 1; justify-content: center; }
  .acct-actions { flex-direction: column; align-items: stretch; }
  .acct-actions .btn { width: 100%; }
  .footer-bottom { justify-content: center; text-align: center; }
}
```

- [ ] **Step 3: Verify build**

Run: `cd /workspace/client && npx vite build`
Expected: `✓ built in ...s` (no errors).

- [ ] **Step 4: Commit**

```bash
cd /workspace && git add client/src/styles.css client/src/components/Icons.jsx
git commit -m "feat(ui): add profile/settings CSS foundation and icons"
```

---

### Task 2: ConfirmationModal accessibility

**Files:**
- Modify: `client/src/components/ConfirmationModal.jsx` (full rewrite of the file)

**Interfaces:**
- Produces: same props as before — `{ open, title, message, confirmLabel='Confirm', cancelLabel='Cancel', tone='danger', onConfirm, onCancel, busy, children }`. Behavior: on open focus the first focusable (non-disabled) control inside the modal; Escape calls `onCancel` only when not `busy`; on close focus returns to the element that opened the modal. `onCancel` is read from a ref so re-renders do not rebind the key handler.
- Consumes: nothing new. Callers (Settings deactivation modal, admin delete confirmations, follower close modal) pass the same props and are unaffected.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `client/src/components/ConfirmationModal.jsx` with:

```jsx
import { useEffect, useRef } from 'react';

export function ConfirmationModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', onConfirm, onCancel, busy, children }) {
  const modalRef = useRef(null);
  const lastFocused = useRef(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  onCancelRef.current = onCancel;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement;
    const node = modalRef.current;
    const first = node && node.querySelector('button:not([disabled]), input:not([disabled]), select, textarea, a[href]');
    if (first && typeof first.focus === 'function') first.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busyRef.current && onCancelRef.current) onCancelRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) return;
    const el = lastFocused.current;
    if (el && typeof el.focus === 'function') el.focus();
    lastFocused.current = null;
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        {children}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and behavior**

Run: `cd /workspace/client && npx vite build` — expected `✓ built in ...s`.

Then a Playwright sanity check (the deactivation modal focus/Escape path is re-verified by the full E2E in Task 6; here just confirm no runtime regression on an existing modal). Create `/tmp/opencode/e2e/modal_check.mjs`:

```js
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.fill('#reg-name', 'Modal Check');
await page.fill('#reg-email', `mchk_${Date.now()}@readify.test`);
await page.fill('#reg-password', 'Password123');
await page.fill('#reg-confirm', 'Password123');
await page.click('form button[type="submit"]');
await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/admin', { timeout: 15000 });
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.click('button:has-text("Deactivate account")');
await page.waitForSelector('.modal input#settings-deact-pw', { timeout: 8000 });
console.log('modal input focused:', await page.evaluate(() => document.activeElement?.id === 'settings-deact-pw'));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log('escape closed modal:', (await page.locator('.modal').count()) === 0);
await browser.close();
```

Run: `cd /tmp/opencode/e2e && node modal_check.mjs` — expected both lines `true`. (If the backend rate limiter has been exhausted by earlier runs, restart the backend first: kill the current backend background terminal and start `cd /workspace/server && node src/index.js`, wait for `curl -sf http://localhost:4000/api/health`.)

- [ ] **Step 3: Commit**

```bash
cd /workspace && git add client/src/components/ConfirmationModal.jsx
git commit -m "feat(ui): modal focus management and escape-to-close"
```

---

### Task 3: Profile page redesign

**Files:**
- Modify: `client/src/pages/MyProfilePage.jsx` (full rewrite of the file; all handlers/logic preserved)

**Interfaces:**
- Consumes: CSS from Task 1 (`.acct-page`, `.edit-avatar`, `.avatar-ring`, `.edit-avatar-actions`, `.hint`, `.field`, `.textarea-lg`, `.counter`, `.icon-input`, `.acct-subhead`, `.chip-list`, `.chip-toggle`, `.acct-actions`); icons from Task 1 (`GlobeIcon` exists, `GitHubIcon`, `TwitterIcon`, `LinkedInIcon`, `GoogleIcon`).
- Produces: unchanged DOM contract for the E2E harness — ids `pf-name`, `pf-bio`, `pf-website`, `pf-github`, `pf-twitter`, `pf-google`, `pf-linkedin`; `button.chip` items with `#name` text; a Save button whose accessible text includes "Save profile". Interest persistence/save behavior identical.
- Consumes existing API/state: `api.patch('/api/users/me', {...})`, `api.put('/api/users/me/interests', { tag_ids })`, `refresh()`, toast `'Profile updated'`, upload via `api.upload('/api/uploads/images', [file])`.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `client/src/pages/MyProfilePage.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { SaveIcon, UploadIcon, XIcon, GlobeIcon, GitHubIcon, TwitterIcon, LinkedInIcon, GoogleIcon } from '../components/Icons.jsx';

const MAX_INTERESTS = 5;
const CHIPS_VISIBLE = 12;

const SOCIAL_FIELDS = [
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com', hint: 'Full URL required' },
  { key: 'github', label: 'GitHub username', placeholder: 'octocat' },
  { key: 'twitter', label: 'X (Twitter) handle', placeholder: '@handle' },
  { key: 'google', label: 'Google Developers profile', placeholder: 'username' },
  { key: 'linkedin', label: 'LinkedIn username', placeholder: 'username' },
];

const SOCIAL_ICONS = {
  website: GlobeIcon,
  github: GitHubIcon,
  twitter: TwitterIcon,
  google: GoogleIcon,
  linkedin: LinkedInIcon,
};

export default function MyProfilePage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [interestIds, setInterestIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      website: user.website || '',
      github: user.github || '',
      twitter: user.twitter || '',
      google: user.google || '',
      linkedin: user.linkedin || '',
    });
    api.get('/api/tags?limit=50').then((d) => setAllTags(d.tags)).catch(() => {});
    api.get('/api/users/me/interests')
      .then((d) => setInterestIds(d.interests.map((t) => t.id)))
      .catch(() => {});
  }, [user]);

  if (!form) {
    return <div className="container" style={{ padding: '60px 20px' }}><div className="skeleton" style={{ height: 200 }} /></div>;
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await api.upload('/api/uploads/images', [file]);
      const url = data.images?.[0]?.url;
      if (url) set('avatar', url);
    } catch (err) {
      toast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const toggleInterest = (id) => {
    setInterestIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_INTERESTS) {
        toast(`Choose up to ${MAX_INTERESTS} interests`, 'error');
        return cur;
      }
      return [...cur, id];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/api/users/me', {
        name: form.name,
        bio: form.bio,
        avatar: form.avatar,
        website: form.website,
        github: form.github,
        twitter: form.twitter,
        google: form.google,
        linkedin: form.linkedin,
      });
      await api.put('/api/users/me/interests', { tag_ids: interestIds });
      await refresh();
      toast('Profile updated', 'success');
    } catch (err) {
      toast(err.message || 'Could not save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const collapsed = allTags.slice(0, CHIPS_VISIBLE);
  const pinned = allTags.slice(CHIPS_VISIBLE).filter((t) => interestIds.includes(t.id));
  const visibleTags = showAll ? allTags : [...collapsed, ...pinned];
  const hiddenCount = allTags.length - visibleTags.length;

  return (
    <div className="acct-page">
      <div className="page-head">
        <h1>My Profile</h1>
        <p className="sub">Make your author profile yours — this is what readers see on your public page.</p>
      </div>

      <div className="form-card">
        <div className="edit-avatar">
          <div className="avatar-ring">
            <Avatar user={{ name: form.name, avatar: form.avatar }} size="xl" />
          </div>
          <div className="edit-avatar-actions">
            <label className="btn btn-outline btn-sm" style={{ display: 'inline-flex', gap: 6 }}>
              {uploading ? 'Uploading…' : (<><UploadIcon /> Upload photo</>)}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatarFile} disabled={uploading} />
            </label>
            {form.avatar && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('avatar', '')}>
                <XIcon /> Remove photo
              </button>
            )}
          </div>
          <span className="hint">JPG, PNG, GIF, WebP, SVG, or AVIF · Max 5 MB</span>
        </div>

        <div className="field">
          <label htmlFor="pf-name">Display name</label>
          <input id="pf-name" value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="pf-bio">Bio</label>
          <textarea
            id="pf-bio"
            className="textarea-lg"
            maxLength={500}
            placeholder="Tell readers a little about yourself, your interests, and what you write about."
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
          />
          <span className="counter small muted">{form.bio.length}/500</span>
        </div>

        <h3 className="acct-subhead">Social links</h3>
        {SOCIAL_FIELDS.map((s) => {
          const FieldIcon = SOCIAL_ICONS[s.key];
          return (
            <div className="field" key={s.key}>
              <label htmlFor={`pf-${s.key}`}>{s.label}</label>
              <div className="icon-input">
                {FieldIcon && <FieldIcon />}
                <input id={`pf-${s.key}`} placeholder={s.placeholder} value={form[s.key]} onChange={(e) => set(s.key, e.target.value)} />
              </div>
              {s.hint && <span className="hint small muted">{s.hint}</span>}
            </div>
          );
        })}

        <h3 className="acct-subhead">
          Your interests <span className="muted small">({interestIds.length}/{MAX_INTERESTS})</span>
        </h3>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Pick topics you care about — we'll use them to tailor a "For you" section on your home page.
        </p>
        {allTags.length === 0 ? (
          <p className="small muted">No tags available yet.</p>
        ) : (
          <>
            <div className="chip-list">
              {visibleTags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${interestIds.includes(t.id) ? 'active' : ''}`}
                  onClick={() => toggleInterest(t.id)}
                  aria-pressed={interestIds.includes(t.id)}
                >
                  #{t.name}
                </button>
              ))}
            </div>
            {hiddenCount > 0 && (
              <button type="button" className="chip-toggle" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show more (${hiddenCount})`}
              </button>
            )}
          </>
        )}

        <div className="acct-actions" style={{ marginTop: 26 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <SaveIcon /> {saving ? 'Saving…' : 'Save profile'}
          </button>
          <Link to={`/authors/${user.id}`} className="btn btn-ghost">View public profile</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /workspace/client && npx vite build`
Expected: `✓ built in ...s` (no errors).

- [ ] **Step 3: Quick DOM smoke**

Create `/tmp/opencode/e2e/prof_dom.mjs`:

```js
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const email = `pdom_${Date.now()}@readify.test`;
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.fill('#reg-name', 'Profile DOM');
await page.fill('#reg-email', email);
await page.fill('#reg-password', 'Password123');
await page.fill('#reg-confirm', 'Password123');
await page.click('form button[type="submit"]');
await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/admin', { timeout: 15000 });
await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
await page.waitForSelector('#pf-name', { timeout: 15000 });
const body = await page.textContent('body');
console.log('ids render:', (await page.locator('#pf-bio').count()) === 1 && (await page.locator('#pf-website').count()) === 1);
console.log('bio counter present:', body.includes('/500'));
console.log('show-more present:', (await page.locator('button.chip-toggle').count()) > 0);
console.log('chips capped at 12:', (await page.locator('button.chip').count()) === 12);
await page.click('button.chip-toggle');
console.log('show-more expands all:', (await page.locator('button.chip').count()) > 12);
await browser.close();
```

Run: `cd /tmp/opencode/e2e && node prof_dom.mjs`
Expected all lines `true`/matching (`chips capped at 12` → true, `expands` → true). If rate limiters are exhausted, restart the backend first (see Task 2 note).

- [ ] **Step 4: Commit**

```bash
cd /workspace && git add client/src/pages/MyProfilePage.jsx
git commit -m "feat(ui): redesign profile editing page"
```

---

### Task 4: Settings page redesign

**Files:**
- Modify: `client/src/pages/SettingsPage.jsx` (full rewrite; all handlers/logic preserved)

**Interfaces:**
- Consumes: CSS from Task 1 (`.acct-page`, `.settings-stack`, `.settings-section`, `.section-desc`, `.seg`, `.card-danger`, `.field`, `.password-field`, `.password-toggle`, `.hint`); icons (`SunIcon`, `MoonIcon`, `CheckIcon`, `EyeIcon`, `EyeOffIcon`, `LockIcon`, `TrashIcon`).
- Produces: unchanged DOM contract — ids `settings-email-new`, `settings-email-pw`, `email-submit`, `settings-pw-current`, `settings-pw-new`, `settings-pw-confirm`, `pw-submit`, `settings-deact-pw`; button texts "Light"/"Dark", "Send verification link", "Change password", "Deactivate account"; `.toast` text "Password updated"; success alert + "Open verification link (dev mode)" anchor; Danger Zone card. API/state logic identical.
- Consumes existing API: `POST /api/settings/email`, `POST /api/settings/password`, `DELETE /api/settings/account`, then `logout()` + `navigate('/login')`.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `client/src/pages/SettingsPage.jsx` with:

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { ConfirmationModal } from '../components/ConfirmationModal.jsx';
import { CheckIcon, EyeIcon, EyeOffIcon, LockIcon, TrashIcon, SunIcon, MoonIcon } from '../components/Icons.jsx';

const THEME_OPTIONS = [
  { key: 'light', label: 'Light', icon: SunIcon },
  { key: 'dark', label: 'Dark', icon: MoonIcon },
];

function PasswordField({ id, label, value, onChange, placeholder, visible, onToggle, hint }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          required
          autoComplete={label === 'Confirm new password' ? 'new-password' : label === 'New password' ? 'new-password' : 'current-password'}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          onClick={onToggle}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && <span className="hint small muted">{hint}</span>}
    </div>
  );
}

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

  const [visible, setVisible] = useState({ email: false, current: false, next: false, confirm: false });

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

  const openDeactivate = () => {
    setDeactErr('');
    setDeactPw('');
    setDeactOpen(true);
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

  const toggleVisible = (key) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div className="acct-page">
      <div className="page-head">
        <h1>Settings</h1>
        <p className="sub">Manage your account and preferences.</p>
      </div>

      <div className="settings-stack">
        <section className="settings-section" aria-labelledby="sec-appearance">
          <h2 id="sec-appearance">Appearance</h2>
          <p className="section-desc">Choose how Readify looks on your device.</p>
          <div className="seg" role="group" aria-label="Theme">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={active ? 'active' : ''}
                  aria-pressed={active}
                  onClick={() => setTheme(opt.key)}
                >
                  {active && <CheckIcon />}
                  <Icon />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="sec-email">
          <h2 id="sec-email">Email</h2>
          <p className="section-desc">
            Current: <strong>{user?.email}</strong>
          </p>
          <form onSubmit={requestEmailChange}>
            <div className="field">
              <label htmlFor="settings-email-new">New email address</label>
              <input
                id="settings-email-new"
                type="email"
                placeholder="you@example.com"
                required
                value={emailForm.new_email}
                onChange={(e) => setEmailForm((f) => ({ ...f, new_email: e.target.value }))}
              />
            </div>
            <PasswordField
              id="settings-email-pw"
              label="Current password"
              placeholder="Enter your current password"
              value={emailForm.password}
              visible={visible.email}
              onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))}
              onToggle={() => toggleVisible('email')}
            />
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
        </section>

        <section className="settings-section" aria-labelledby="sec-password">
          <h2 id="sec-password">Password</h2>
          <p className="section-desc">
            <LockIcon /> Changing your password signs you out everywhere else.
          </p>
          <form onSubmit={changePassword}>
            <PasswordField
              id="settings-pw-current"
              label="Current password"
              placeholder="Enter your current password"
              value={pwForm.current_password}
              visible={visible.current}
              onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))}
              onToggle={() => toggleVisible('current')}
            />
            <PasswordField
              id="settings-pw-new"
              label="New password"
              placeholder="At least 8 characters"
              value={pwForm.new_password}
              visible={visible.next}
              onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
              onToggle={() => toggleVisible('next')}
              hint="At least 8 characters · at least one letter · one number"
            />
            <PasswordField
              id="settings-pw-confirm"
              label="Confirm new password"
              placeholder="Repeat the new password"
              value={pwForm.confirm}
              visible={visible.confirm}
              onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
              onToggle={() => toggleVisible('confirm')}
            />
            {pwErr && <div className="alert alert-error">{pwErr}</div>}
            <div>
              <button id="pw-submit" type="submit" className="btn btn-primary" disabled={pwBusy}>
                {pwBusy ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-section card-danger" aria-labelledby="sec-danger">
          <h2 id="sec-danger">Danger Zone</h2>
          <p className="section-desc">
            Deactivating your account hides it from everyone and prevents sign-in. Your articles
            and comments stay. An administrator can re-activate it.
          </p>
          <button type="button" className="btn btn-danger" onClick={openDeactivate}>
            <TrashIcon /> Deactivate Account
          </button>
        </section>
      </div>

      <ConfirmationModal
        open={deactOpen}
        title="Deactivate your account?"
        message="Are you sure you want to deactivate your account? It will be hidden and you will not be able to sign in. Your articles and comments will remain available. Enter your current password to confirm."
        confirmLabel="Deactivate"
        busy={deactBusy}
        onConfirm={deactivate}
        onCancel={() => setDeactOpen(false)}
      >
        <div className="field">
          <label htmlFor="settings-deact-pw">Current password</label>
          <input
            id="settings-deact-pw"
            type="password"
            placeholder="Current password"
            value={deactPw}
            onChange={(e) => setDeactPw(e.target.value)}
          />
        </div>
        {deactErr && <div className="alert alert-error">{deactErr}</div>}
      </ConfirmationModal>
    </div>
  );
}
```

Note: the modal heading must remain "Deactivate your account?" and the confirm label "Deactivate" (E2E click targets). The heading case "Danger Zone" intentionally replaces "Danger zone" — the matching E2E `includes` check is updated in Task 6.

- [ ] **Step 2: Verify build**

Run: `cd /workspace/client && npx vite build`
Expected: `✓ built in ...s`.

- [ ] **Step 3: Verify key DOM strings**

Run: `cd /tmp/opencode/e2e && node sets_dom.mjs` — reuse the existing Task 6-era smoke if present, else quick check via Playwright that `/settings` (signed in) body includes `Danger Zone`, `Appearance`, `Email`, `Password`, that `.seg button` count is 2, that `#settings-deact-pw` exists after opening the modal, and that pressing the Dark option writes `readify_theme=dark` to localStorage. If `sets_dom.mjs` is absent, write a minimal inline check with the register → `/settings` flow used in earlier tasks. (See the harness examples in `/tmp/opencode/e2e/`.)

- [ ] **Step 4: Commit**

```bash
cd /workspace && git add client/src/pages/SettingsPage.jsx
git commit -m "feat(ui): redesign settings page sections"
```

---

### Task 5: Navbar mobile menu + footer responsiveness

**Files:**
- Modify: `client/src/components/Navbar.jsx` (full rewrite; desktop markup/logic preserved)
- Modify: `client/src/components/Footer.jsx` (optional no-op — only if a markup tweak is needed; spacing is handled by Task 1 CSS)

**Interfaces:**
- Consumes: CSS from Task 1 (`.mobile-only`, `.mobile-btn`, `.mobile-divider`). Icons already imported (`MenuIcon`, `PlusIcon`, `UserIcon`, `LogOutIcon`, `ShieldIcon`, `FileTextIcon`, `BookIcon`, `SettingsIcon`).
- Produces: `Navbar` renders the same desktop topbar. On ≤720px, opening the burger shows: Home, Discover, My Dashboard (signed in), New Article (signed in, `.mobile-only`), divider, Profile/Settings/Sign out (signed in, `.mobile-only`). Signed-out mobile menu shows Home, Discover, divider, Sign in, Create account. `handleLogout`, `menuOpen`, `mobileOpen` logic unchanged. Burger gets `aria-expanded`/`aria-controls`.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `client/src/components/Navbar.jsx` with:

```jsx
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { Avatar } from './Avatar.jsx';
import { Logo } from './Logo.jsx';
import { MenuIcon, PlusIcon, UserIcon, FileTextIcon, LogOutIcon, ShieldIcon, BookIcon, SunIcon, MoonIcon, SettingsIcon } from './Icons.jsx';

export function Navbar() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    setMobileOpen(false);
    try {
      await logout();
      toast('Signed out', 'success');
      navigate('/');
    } catch {
      toast('Could not sign out', 'error');
    }
  };

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <button
          type="button"
          className="burger"
          aria-label="Menu"
          aria-expanded={mobileOpen}
          aria-controls="site-nav"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <MenuIcon style={{ fontSize: '1.2rem' }} />
        </button>
        <Logo to="/" />

        <nav id="site-nav" className={`topbar-nav ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/discover">Discover</NavLink>
          {user && <NavLink to="/dashboard">My Dashboard</NavLink>}
          {user && user.role === 'admin' && <NavLink to="/admin">Admin Portal</NavLink>}

          {user ? (
            <>
              <div className="mobile-divider" />
              <Link to="/upload" className="mobile-only"><PlusIcon /> New Article</Link>
              <Link to="/profile" className="mobile-only"><UserIcon /> Profile</Link>
              <Link to="/settings" className="mobile-only"><SettingsIcon /> Settings</Link>
              <button type="button" className="mobile-only" onClick={handleLogout}>
                <LogOutIcon /> Sign out
              </button>
            </>
          ) : (
            <>
              <div className="mobile-divider" />
              <Link to="/login" className="mobile-only">Sign in</Link>
              <Link to="/register" className="mobile-only">Create account</Link>
            </>
          )}
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className="theme-toggle"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          {user ? (
            <>
              <Link to="/upload" className="btn btn-primary btn-sm">
                <PlusIcon /> <span className="new-article-label">New Article</span>
              </Link>
              <div className="user-menu">
                <button
                  type="button"
                  className="user-chip btn btn-ghost"
                  onClick={() => setMenuOpen((v) => !v)}
                  style={{ padding: '6px 10px', borderRadius: '999px' }}
                >
                  <Avatar user={user} size="sm" />
                  <span className="small">{user.name.split(' ')[0]}</span>
                </button>
                {menuOpen && (
                  <div className="user-menu-pop" onMouseLeave={() => setMenuOpen(false)}>
                    <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                      <FileTextIcon /> My Dashboard
                    </Link>
                    <Link to="/upload" onClick={() => setMenuOpen(false)}>
                      <PlusIcon /> Upload Article
                    </Link>
                    <Link to="/saved" onClick={() => setMenuOpen(false)}>
                      <BookIcon /> Saved Articles
                    </Link>
                    {user.role === 'admin' && (
                      <Link to="/admin" onClick={() => setMenuOpen(false)}>
                        <ShieldIcon /> Admin Portal
                      </Link>
                    )}
                    <Link to="/settings" onClick={() => setMenuOpen(false)}>
                      <SettingsIcon /> Settings
                    </Link>
                    <div className="divider" />
                    <Link to="/profile" onClick={() => setMenuOpen(false)}>
                      <UserIcon /> My Profile
                    </Link>
                    <Link to={`/authors/${user.id}`} onClick={() => setMenuOpen(false)}>
                      <UserIcon /> Public Profile
                    </Link>
                    <button type="button" onClick={handleLogout}>
                      <LogOutIcon /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

Footer: no markup change needed (Task 1 CSS reduces mobile margins/spacing). Only open `client/src/components/Footer.jsx` if the final visual check shows clipping; in that case adjust inline `gap`/padding values, never remove links or the copyright line.

- [ ] **Step 2: Verify build**

Run: `cd /workspace/client && npx vite build`
Expected: `✓ built in ...s`.

- [ ] **Step 3: Verify mobile menu content**

Create `/tmp/opencode/e2e/nav_mobile.mjs`:

```js
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const email = `nmob_${Date.now()}@readify.test`;
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.fill('#reg-name', 'Nav Mobile');
await page.fill('#reg-email', email);
await page.fill('#reg-password', 'Password123');
await page.fill('#reg-confirm', 'Password123');
await page.click('form button[type="submit"]');
await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/admin', { timeout: 15000 });
await page.click('.burger');
await page.waitForSelector('.topbar-nav.open a:has-text("New Article")', { timeout: 5000 });
const links = await page.locator('.topbar-nav.open a, .topbar-nav.open button').allTextContents();
console.log('mobile signed-in items:', ['Home', 'Discover', 'My Dashboard', 'New Article', 'Profile', 'Settings', 'Sign out'].every((x) => links.some((t) => t.includes(x))));
console.log('no desktop overflow:', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await browser.close();
```

Run: `cd /tmp/opencode/e2e && node nav_mobile.mjs` — expected `true` lines. (Restart backend first if rate-limited.)

- [ ] **Step 4: Commit**

```bash
cd /workspace && git add client/src/components/Navbar.jsx
git commit -m "feat(ui): complete mobile navigation for signed-in users"
```

---

### Task 6: E2E copy/selector updates + full regression

**Files:**
- Modify: `/tmp/opencode/e2e/test.mjs` (untracked harness — no commit)

**Interfaces:**
- Consumes: full app. Produces: full regression evidence.

- [ ] **Step 1: Update the Danger Zone string**

In `/tmp/opencode/e2e/test.mjs`, replace:

```js
check('Settings page renders four sections', ['Appearance', 'Email', 'Password', 'Danger zone'].every((s) => setBody.includes(s)));
```

with:

```js
check('Settings page renders four sections', ['Appearance', 'Email', 'Password', 'Danger Zone'].every((s) => setBody.includes(s)));
```

- [ ] **Step 2: Make the interests section expand the chip list**

In `/tmp/opencode/e2e/test.mjs`, replace:

```js
const jsChip = page.locator('button.chip:has-text("#javascript")').first();
```

with:

```js
const showMoreBtn = page.locator('button.chip-toggle');
if ((await showMoreBtn.count()) > 0) await showMoreBtn.click();
const jsChip = page.locator('button.chip:has-text("#javascript")').first();
```

- [ ] **Step 3: Restart backend, clean, run full regression**

Kill the current backend background terminal, then start a fresh one (`cd /workspace/server && node src/index.js`) and wait for `curl -sf http://localhost:4000/api/health`. Then:

```bash
cd /tmp/opencode/e2e && node cleanup.mjs && node test.mjs 2>&1 | tail -3
```

Expected: `==== RESULT: 84 passed, 0 failed ====`.

- [ ] **Step 4: Sanitizer**

```bash
cd /tmp/opencode/e2e && node sanitize_check.mjs 2>&1 | head -1
```

Expected: `CHECK PASS`.

- [ ] **Step 5: Repo state**

```bash
cd /workspace && git status --porcelain | rg -v '^\?\?'
```

Expected: no output (only untracked pre-existing files remain; `data/` never committed). The E2E harness is outside the repo, so no commit is needed for it.
