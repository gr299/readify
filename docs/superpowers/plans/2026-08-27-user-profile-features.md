# User Profile Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: COMPLETE** — all 7 tasks implemented and committed (`974bda3`..`39c5225`). Full Playwright E2E suite extended to 66 checks, **66 passed / 0 failed**; editor sanitizer XSS check `CHECK PASS`; `vite build` and `node --check` clean. Followers/following list totals and profile counts count only active users; stale follows pruned by `cleanup.mjs`.

**Goal:** Add five user-profile capabilities to Readify — editable own profile, public profile stats, core follow system with a Following feed, social links, and personalized "For you" recommendations.

**Architecture:** Extend the existing Express + SQLite backend (new `follows` and `user_interests` tables, social columns on `users`, a new `users.js` router, two new article-feed routes) and the existing React frontend (new `MyProfilePage`, upgraded `AuthorProfilePage`, Discover tabs, Home "For you" section). Everything is backend-enforced, reusing `attachUser`/`requireAuth`, `publicUser`, `serializeArticle`, `validate()`, and the idempotent PRAGMA migration pattern.

**Tech Stack:** Node 20 + Express + better-sqlite3, React 18 + Vite, zod, Playwright (E2E in `/tmp/opencode/e2e`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-27-user-profile-features-design.md`.
- The backend runs from a background terminal (`cd /workspace/server && node src/index.js`, port 4000). **Restart it after every server file change** (this also resets the in-memory rate-limit counters). The frontend Vite dev server (port 5173) picks up client changes via HMR; run `npx vite build` in `/workspace/client` to verify client changes compile.
- This repo has no unit-test framework. Backend verification = `node --check` + curl/API checks against `http://localhost:4000`; the full regression suite is the Playwright script at `/tmp/opencode/e2e/test.mjs` (runs against `http://localhost:5173`).
- Follow existing patterns exactly: `wrap()` + `ApiError`, `validate(schemas.x)` from `validation.js`, `publicUser`, `serializeArticle`, `trackActivity`. No secrets in the frontend.
- The existing Word-like editor object/sanitizer behavior and the XSS E2E checks (`/tmp/opencode/e2e/sanitize_check.mjs`) must stay green.
- Do not regress admin RBAC: admin endpoints remain gated by `requireAdminDomain` + `requireAdmin`; regular users must keep getting 403.
- In `articles.js`, route order matters: `/feed`, `/mine`, `/following`, `/for-you` must all be registered **before** `GET /:id`.
- New `follows`/`user_interests` FKs use `ON DELETE CASCADE` (admin user delete is a hard `DELETE FROM users`, and `foreign_keys = ON` is already set in `db.js`).
- Never commit `data/` (SQLite files) — already gitignored. Client build output and `node_modules` are gitignored.
- Seeded author "Alice Johnson" is user id 2 with published articles; her profile is `/authors/2`. Seeded tag slug `javascript` has published articles. These are test fixtures for E2E.

---

### Task 1: Database migration — social columns, follows, user_interests

**Files:**
- Modify: `server/src/db.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `users.website/github/twitter/google/linkedin` (TEXT, nullable); tables `follows(follower_id, following_id, UNIQUE)` and `user_interests(user_id, tag_id, UNIQUE)` with `ON DELETE CASCADE` FKs; indexes `idx_follows_follower`, `idx_follows_following`, `idx_user_interests_user`.

- [x] **Step 1: Add the migration block**

Insert this directly after the `idx_articles_featured` index line (line ~70) and before the FTS section:

```js
// Migration: user profile social links (nullable).
const userCols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
for (const col of ['website', 'github', 'twitter', 'google', 'linkedin']) {
  if (!userCols.includes(col)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
  }
}

// Follow graph and user interests.
db.exec(`
CREATE TABLE IF NOT EXISTS follows (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

CREATE TABLE IF NOT EXISTS user_interests (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE (user_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);
`);
```

- [x] **Step 2: Restart the backend and verify schema**

Kill the running backend terminal, start it again (`cd /workspace/server && node src/index.js` in a background terminal), then:

Run: `node --check server/src/db.js`
Expected: PASS (no output, exit 0).

Run: `node -e "import('./server/src/db.js').then(async () => { const Database = (await import('better-sqlite3')).default; const db = new Database('data/readify.db'); const cols = db.prepare('PRAGMA table_info(users)').all().map(c=>c.name); const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(t=>t.name); console.log('social cols:', ['website','github','twitter','google','linkedin'].every(c=>cols.includes(c))); console.log('tables:', tables.includes('follows') && tables.includes('user_interests')); })"` (run from `/workspace`)
Expected: `social cols: true` and `tables: true`.

- [x] **Step 3: Commit**

```bash
git add server/src/db.js
git commit -m "feat(db): add social columns, follows and user_interests tables"
```

---

### Task 2: Backend users API — profile, follow, stats, interests

**Files:**
- Create: `server/src/routes/users.js`
- Modify: `server/src/utils.js:149-160` (`publicUser`)
- Modify: `server/src/validation.js` (add `profileUpdate` + `interests` schemas)
- Modify: `server/src/routes/catalog.js` (remove `GET /users/:id`)
- Modify: `server/src/index.js` (mount new router)

**Interfaces:**
- Consumes: `publicUser` (extended here), `paginate`, `ApiError`, `wrap` from `utils.js`; `requireAuth` from `middleware/auth.js`; `validate` + `schemas` from `validation.js`; `serializeArticle` from `routes/articles.js`.
- Produces:
  - `PATCH /api/users/me` → `{ user }`
  - `GET /api/users/me/interests` → `{ interests: [{id,name,slug}] }`
  - `PUT /api/users/me/interests` body `{ tag_ids: number[] }` → `{ interests }`
  - `POST /api/users/:id/follow` → `{ following: true, follower_count }`
  - `DELETE /api/users/:id/follow` → `{ following: false, follower_count }`
  - `GET /api/users/:id/followers` → `{ followers: [publicUser], page, limit, total, total_pages }`
  - `GET /api/users/:id/following` → `{ following: [publicUser], ... }`
  - `GET /api/users/:id` → `{ user: {...publicUser(user), total_published, total_views, total_reactions, total_comments, follower_count, following_count, is_following}, interests, articles, page, limit, total, total_pages }`

- [x] **Step 1: Extend `publicUser`**

In `server/src/utils.js`, replace the `publicUser` return object so it includes the new social fields:

```js
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    bio: user.bio,
    website: user.website,
    github: user.github,
    twitter: user.twitter,
    google: user.google,
    linkedin: user.linkedin,
    created_at: user.created_at,
  };
}
```

- [x] **Step 2: Add validation schemas**

Append to the `schemas` object in `server/src/validation.js` (before the closing `};`):

```js
  profileUpdate: z.object({
    name: z.string().trim().min(2, 'Name must be between 2 and 80 characters').max(80, 'Name must be between 2 and 80 characters').optional(),
    bio: z.string().trim().max(500, 'Bio must be at most 500 characters').optional(),
    avatar: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.string().nullable().optional())
      .refine(
        (v) => v === null || v === undefined || /^\/uploads\/.+$/.test(v) || /^data:image\/.+$/.test(v) || /^https?:\/\/.+$/.test(v),
        'Avatar must be an uploaded image, data URI, or http(s) URL'
      ),
    website: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? '' : v), z.union([z.literal(''), z.string().trim().url('Website must be a valid URL').max(300)])),
    github: z.union([z.literal(''), z.string().trim().max(40, 'Username must be at most 40 characters').regex(/^[A-Za-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores')]),
    twitter: z.union([z.literal(''), z.string().trim().max(40, 'Username must be at most 40 characters').regex(/^@?[A-Za-z0-9._-]+$/, 'Twitter handle may only contain letters, numbers, dots, dashes and underscores')]),
    google: z.union([z.literal(''), z.string().trim().max(40, 'Username must be at most 40 characters').regex(/^[A-Za-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores')]),
    linkedin: z.union([z.literal(''), z.string().trim().max(40, 'Username must be at most 40 characters').regex(/^[A-Za-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores')]),
  }),

  interests: z.object({
    tag_ids: z.array(z.number().int().positive('Invalid tag')).max(5, 'Choose up to 5 interests'),
  }),
```

- [x] **Step 3: Create `server/src/routes/users.js`**

```js
import { Router } from 'express';
import { db } from '../db.js';
import { ApiError, paginate, publicUser, wrap } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, schemas } from '../validation.js';
import { serializeArticle } from './articles.js';

const router = Router();

router.get(
  '/me/interests',
  requireAuth,
  wrap((req, res) => {
    const interests = db
      .prepare(
        `SELECT t.id, t.name, t.slug FROM tags t
         JOIN user_interests ui ON ui.tag_id = t.id
         WHERE ui.user_id = ? ORDER BY t.name`
      )
      .all(req.user.id);
    return res.json({ interests });
  })
);

router.put(
  '/me/interests',
  requireAuth,
  validate(schemas.interests),
  wrap((req, res) => {
    const ids = [...new Set(req.body.tag_ids)];
    if (ids.length === 0) {
      db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(req.user.id);
    } else {
      const placeholders = ids.map(() => '?').join(', ');
      const found = db.prepare(`SELECT id FROM tags WHERE id IN (${placeholders})`).all(...ids);
      if (found.length !== ids.length) throw new ApiError(404, 'One or more tags do not exist');
      const del = db.prepare('DELETE FROM user_interests WHERE user_id = ?');
      const ins = db.prepare('INSERT INTO user_interests (user_id, tag_id) VALUES (?, ?)');
      db.transaction(() => {
        del.run(req.user.id);
        for (const id of ids) ins.run(req.user.id, id);
      })();
    }
    const interests = db
      .prepare(
        `SELECT t.id, t.name, t.slug FROM tags t
         JOIN user_interests ui ON ui.tag_id = t.id
         WHERE ui.user_id = ? ORDER BY t.name`
      )
      .all(req.user.id);
    return res.json({ interests });
  })
);

router.patch(
  '/me',
  requireAuth,
  validate(schemas.profileUpdate),
  wrap((req, res) => {
    const updates = {};
    for (const key of ['name', 'bio', 'avatar', 'website', 'github', 'twitter', 'google', 'linkedin']) {
      if (req.body[key] !== undefined) {
        let value = req.body[key] === '' ? null : req.body[key];
        if (key === 'twitter' && typeof value === 'string') value = value.replace(/^@/, '');
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length > 0) {
      const sets = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
      db.prepare(`UPDATE users SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run({
        ...updates,
        id: req.user.id,
      });
    }
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    return res.json({ user: publicUser(updated) });
  })
);

router.post(
  '/:id/follow',
  requireAuth,
  wrap((req, res) => {
    const target = Number(req.params.id);
    if (target === req.user.id) throw new ApiError(400, 'You cannot follow yourself');
    const exists = db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(target);
    if (!exists) throw new ApiError(404, 'User not found');
    db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target);
    const follower_count = db
      .prepare(
        `SELECT COUNT(*) AS c FROM follows f
         JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = ? AND u.active = 1`
      )
      .get(target).c;
    return res.json({ following: true, follower_count });
  })
);

router.delete(
  '/:id/follow',
  requireAuth,
  wrap((req, res) => {
    const target = Number(req.params.id);
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target);
    const follower_count = db
      .prepare(
        `SELECT COUNT(*) AS c FROM follows f
         JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = ? AND u.active = 1`
      )
      .get(target).c;
    return res.json({ following: false, follower_count });
  })
);

router.get(
  '/:id/followers',
  wrap((req, res) => {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    const { page, limit, offset } = paginate(req.query.page, 12);
    const total = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE following_id = ?').get(user.id).c;
    const rows = db
      .prepare(
        `SELECT u.* FROM users u
         JOIN follows f ON f.follower_id = u.id
         WHERE f.following_id = ? AND u.active = 1
         ORDER BY f.created_at DESC LIMIT ? OFFSET ?`
      )
      .all(user.id, limit, offset);
    return res.json({ followers: rows.map(publicUser), page, limit, total, total_pages: Math.ceil(total / limit) });
  })
);

router.get(
  '/:id/following',
  wrap((req, res) => {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    const { page, limit, offset } = paginate(req.query.page, 12);
    const total = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?').get(user.id).c;
    const rows = db
      .prepare(
        `SELECT u.* FROM users u
         JOIN follows f ON f.following_id = u.id
         WHERE f.follower_id = ? AND u.active = 1
         ORDER BY f.created_at DESC LIMIT ? OFFSET ?`
      )
      .all(user.id, limit, offset);
    return res.json({ following: rows.map(publicUser), page, limit, total, total_pages: Math.ceil(total / limit) });
  })
);

router.get(
  '/:id',
  wrap((req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');

    const stats = db
      .prepare(
        `SELECT COUNT(*) AS total_published,
                COALESCE(SUM(views_count), 0) AS total_views,
                COALESCE(SUM(reactions_count), 0) AS total_reactions,
                COALESCE(SUM(comments_count), 0) AS total_comments
         FROM articles WHERE user_id = ? AND status = 'published'`
      )
      .get(user.id);
    const follower_count = db
      .prepare(
        `SELECT COUNT(*) AS c FROM follows f
         JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = ? AND u.active = 1`
      )
      .get(user.id).c;
    const following_count = db
      .prepare(
        `SELECT COUNT(*) AS c FROM follows f
         JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = ? AND u.active = 1`
      )
      .get(user.id).c;
    const is_following =
      req.user &&
      Number(req.user.id) !== user.id &&
      !!db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, user.id);
    const interests = db
      .prepare(
        `SELECT t.id, t.name, t.slug FROM tags t
         JOIN user_interests ui ON ui.tag_id = t.id
         WHERE ui.user_id = ? ORDER BY t.name`
      )
      .all(user.id);

    const { page, limit, offset } = paginate(req.query.page, 12);
    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM articles WHERE user_id = ? AND status = 'published'`)
      .get(user.id).c;
    const rows = db
      .prepare(
        `SELECT * FROM articles WHERE user_id = ? AND status = 'published'
         ORDER BY published_at DESC LIMIT ? OFFSET ?`
      )
      .all(user.id, limit, offset);

    return res.json({
      user: {
        ...publicUser(user),
        ...stats,
        follower_count,
        following_count,
        is_following,
      },
      interests,
      articles: rows.map((a) => serializeArticle(a, req.user)),
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    });
  })
);

export default router;
```

- [x] **Step 4: Remove the old user endpoint from `catalog.js`**

In `server/src/routes/catalog.js`, delete the entire `router.get('/users/:id', ...)` block (the last route in the file, currently lines ~40-59). Leave `serializeArticle` imported only if still used (it is no longer used after deletion — remove it from the import too). The file should now contain only the `/categories` and `/tags` routes.

- [x] **Step 5: Mount the new router in `index.js`**

In `server/src/index.js`:
- Add `import userRoutes from './routes/users.js';` after the catalog import.
- Add `app.use('/api/users', userRoutes);` immediately before `app.use('/api', catalogRoutes);`.

- [x] **Step 6: Verify syntax and restart**

Run: `node --check server/src/routes/users.js && node --check server/src/routes/catalog.js && node --check server/src/utils.js && node --check server/src/validation.js && node --check server/src/index.js`
Expected: PASS (exit 0).

Restart the backend terminal, then run the API checks (a fresh user via the register endpoint with a unique email):

```bash
curl -s -c /tmp/prof.jar -H "Content-Type: application/json" \
  -d '{"name":"Plan Tester","email":"plan_'"$(date +%s)"'@readify.test","password":"Password123"}' \
  http://localhost:4000/api/auth/register
```

- [x] **Step 7: Verify the profile endpoints**

Run:
```bash
COOKIE=$(awk 'NF==7 && $6=="readify_token" {print $6"="$7}' /tmp/prof.jar)
# PATCH /me
curl -s -b "$COOKIE" -X PATCH -H "Content-Type: application/json" \
  -d '{"name":"Plan Tester 2","bio":"hello","website":"https://example.com","twitter":"@readify"}' \
  http://localhost:4000/api/users/me
# expected: {"user":{"id":..,"name":"Plan Tester 2",...,"website":"https://example.com","twitter":"readify",...}}
```
Expected: `website` = `https://example.com`, `twitter` = `readify` (leading `@` stripped), `name` updated.

Run (invalid website → 400):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIE" -X PATCH -H "Content-Type: application/json" \
  -d '{"website":"not-a-url"}' http://localhost:4000/api/users/me
```
Expected: `400`.

Run (self-follow → 400; get your own id from the PATCH response first, say `MYID`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIE" -X POST http://localhost:4000/api/users/MYID/follow
```
Expected: `400`.

Run (follow Alice, id 2 → 200, then GET /users/2 shows stats and is_following true):
```bash
curl -s -b "$COOKIE" -X POST http://localhost:4000/api/users/2/follow
# expected: {"following":true,"follower_count":1}
curl -s -b "$COOKIE" http://localhost:4000/api/users/2
# expected user.follower_count === 1, user.is_following === true, user.total_views > 0
curl -s -b "$COOKIE" -X DELETE http://localhost:4000/api/users/2/follow
# expected: {"following":false,"follower_count":0}
```
Also verify GET `/api/users/2/followers` returns `{followers: []}` and `total: 0`.

- [x] **Step 8: Verify interests endpoints**

Run (find the `javascript` tag id, e.g. via `curl -s http://localhost:4000/api/tags?limit=50`):
```bash
curl -s -b "$COOKIE" -X PUT -H "Content-Type: application/json" -d '{"tag_ids":[TAGID]}' http://localhost:4000/api/users/me/interests
# expected: {"interests":[{"id":TAGID,"name":"javascript",...}]}
curl -s -b "$COOKIE" http://localhost:4000/api/users/me/interests
# expected: same interest list
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIE" -X PUT -H "Content-Type: application/json" -d '{"tag_ids":[1,2,3,4,5,6]}' http://localhost:4000/api/users/me/interests
# expected: 400 (more than 5)
```

- [x] **Step 9: Commit**

```bash
git add server/src/routes/users.js server/src/routes/catalog.js server/src/utils.js server/src/validation.js server/src/index.js
git commit -m "feat(api): user profile, follow, stats and interests endpoints"
```

---

### Task 3: Backend article feeds — following and for-you

**Files:**
- Modify: `server/src/routes/articles.js`

**Interfaces:**
- Consumes: `requireAuth`, `db`, `paginate`, `serializeArticle` (all in the same file already).
- Produces:
  - `GET /api/articles/following` (auth) → `{ articles, page, limit, total, total_pages }`
  - `GET /api/articles/for-you` (auth) → `{ articles, has_interests }`

- [x] **Step 1: Add the two routes**

Insert the following two routes in `server/src/routes/articles.js` immediately after the closing of the `GET /mine` route (line ~339) and **before** the `GET /:id` route (line ~341):

```js
router.get(
  '/following',
  requireAuth,
  wrap((req, res) => {
    const { page, limit, offset } = paginate(req.query.page, 12);
    const from = `FROM articles a
      JOIN follows f ON f.following_id = a.user_id
      JOIN users u ON u.id = a.user_id AND u.active = 1
      WHERE f.follower_id = ? AND a.status = 'published'`;
    const total = db.prepare(`SELECT COUNT(*) AS c ${from}`).get(req.user.id).c;
    const rows = db
      .prepare(`SELECT a.* ${from} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`)
      .all(req.user.id, limit, offset);
    return res.json({
      articles: rows.map((a) => serializeArticle(a, req.user)),
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    });
  })
);

router.get(
  '/for-you',
  requireAuth,
  wrap((req, res) => {
    const has = db.prepare('SELECT COUNT(*) AS c FROM user_interests WHERE user_id = ?').get(req.user.id).c > 0;
    if (!has) return res.json({ articles: [], has_interests: false });
    const rows = db
      .prepare(
        `SELECT DISTINCT a.* FROM articles a
         JOIN article_tags at ON at.article_id = a.id
         JOIN user_interests ui ON ui.tag_id = at.tag_id
         JOIN users u ON u.id = a.user_id AND u.active = 1
         WHERE ui.user_id = ? AND a.status = 'published'
         ORDER BY a.published_at DESC LIMIT 6`
      )
      .all(req.user.id);
    return res.json({ articles: rows.map((a) => serializeArticle(a, req.user)), has_interests: true });
  })
);
```

- [x] **Step 2: Restart and verify**

Run: `node --check server/src/routes/articles.js`
Expected: PASS.

Restart the backend, then (using the cookie from Task 2, `$COOKIE`):

```bash
curl -s -b "$COOKIE" -X POST http://localhost:4000/api/users/2/follow >/dev/null   # follow Alice
curl -s -b "$COOKIE" "http://localhost:4000/api/articles/following"
# expected: articles list with at least one article authored by Alice Johnson
curl -s -b "$COOKIE" "http://localhost:4000/api/articles/for-you"
# expected (Task 2 set the javascript interest): has_interests true, articles.length > 0
curl -s -b "$COOKIE" -X DELETE http://localhost:4000/api/users/2/follow >/dev/null  # clean up
```

Expected: `/following` returns Alice's published articles; `/for-you` returns `has_interests: true` and ≥1 article (tag `javascript` has published articles).

- [x] **Step 3: Commit**

```bash
git add server/src/routes/articles.js
git commit -m "feat(api): following feed and for-you article endpoints"
```

---

### Task 4: My Profile page + route + nav link

**Files:**
- Create: `client/src/pages/MyProfilePage.jsx`
- Modify: `client/src/App.jsx` (route + import)
- Modify: `client/src/components/Navbar.jsx` (user menu link)

**Interfaces:**
- Consumes: `api` (`get/patch/put/upload`), `Avatar`, `useAuth` (`user`, `refresh`), `useToast`, icons `SaveIcon`, `UploadIcon`, `XIcon`; backend endpoints from Tasks 2-3.
- Produces: `client/src/pages/MyProfilePage.jsx` default-exported page; route `/profile` (RequireAuth); "My Profile" entry in the authenticated navbar user menu.

- [x] **Step 1: Create `client/src/pages/MyProfilePage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { SaveIcon, UploadIcon, XIcon } from '../components/Icons.jsx';

const SOCIAL_FIELDS = [
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com', hint: 'Full URL required' },
  { key: 'github', label: 'GitHub username', placeholder: 'octocat' },
  { key: 'twitter', label: 'X (Twitter) handle', placeholder: '@handle' },
  { key: 'google', label: 'Google Developers profile', placeholder: 'username' },
  { key: 'linkedin', label: 'LinkedIn username', placeholder: 'username' },
];

const MAX_INTERESTS = 5;

export default function MyProfilePage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [interestIds, setInterestIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="page-head">
        <h1>My profile</h1>
        <p className="sub">Make your author profile yours — this is what readers see on your public page.</p>
      </div>

      <div className="form-card" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 20 }}>
          <Avatar user={{ name: form.name, avatar: form.avatar }} size="lg" />
          <div className="stack" style={{ gap: 8 }}>
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
        </div>

        <div className="form-group">
          <label htmlFor="pf-name">Display name</label>
          <input id="pf-name" value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="pf-bio">Bio</label>
          <textarea id="pf-bio" rows={4} maxLength={500} placeholder="A sentence or two about you." value={form.bio} onChange={(e) => set('bio', e.target.value)} />
          <span className="small muted">{form.bio.length}/500</span>
        </div>

        <h3 style={{ margin: '22px 0 12px', fontSize: '1.1rem' }}>Social links</h3>
        {SOCIAL_FIELDS.map((s) => (
          <div className="form-group" key={s.key}>
            <label htmlFor={`pf-${s.key}`}>{s.label}</label>
            <input id={`pf-${s.key}`} placeholder={s.placeholder} value={form[s.key]} onChange={(e) => set(s.key, e.target.value)} />
            {s.hint && <span className="small muted">{s.hint}</span>}
          </div>
        ))}

        <h3 style={{ margin: '22px 0 12px', fontSize: '1.1rem' }}>
          Your interests <span className="muted small">({interestIds.length}/{MAX_INTERESTS})</span>
        </h3>
        <p className="small muted" style={{ marginBottom: 10 }}>
          Pick topics you care about — we'll use them to tailor a "For you" section on your home page.
        </p>
        {allTags.length === 0 ? (
          <p className="small muted">No tags available yet.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allTags.map((t) => (
              <button key={t.id} type="button"
                className={`chip ${interestIds.includes(t.id) ? 'active' : ''}`}
                onClick={() => toggleInterest(t.id)}>
                #{t.name}
              </button>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: 26, gap: 10 }}>
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

- [x] **Step 2: Add the route in `App.jsx`**

Add the import near the other page imports:
```jsx
import MyProfilePage from './pages/MyProfilePage.jsx';
```
Add a route (place it right after the `/saved` route, line ~62):
```jsx
      <Route
        path="/profile"
        element={
          <PublicLayout>
            <RequireAuth>
              <MyProfilePage />
            </RequireAuth>
          </PublicLayout>
        }
      />
```

- [x] **Step 3: Add the nav link in `Navbar.jsx`**

In the `user-menu-pop` div (line ~69), add a "My Profile" link before the "Public Profile" link (line ~85):
```jsx
                    <Link to="/profile" onClick={() => setMenuOpen(false)}>
                      <UserIcon /> My Profile
                    </Link>
```

- [x] **Step 4: Verify the client builds and the page loads**

Run: `cd /workspace/client && npx vite build`
Expected: build succeeds (exit 0).

Restart backend (already running latest). In a browser (or via the E2E suite later), log in as the Task 2 user and open `http://localhost:5173/profile` — the form renders with pre-filled name and a chip picker.

- [x] **Step 5: Commit**

```bash
git add client/src/pages/MyProfilePage.jsx client/src/App.jsx client/src/components/Navbar.jsx
git commit -m "feat(web): My Profile page with avatar, bio, social links and interests"
```

---

### Task 5: Author profile page upgrade

**Files:**
- Modify: `client/src/pages/AuthorProfilePage.jsx`

**Interfaces:**
- Consumes: `api`, `Avatar`, `ArticleCard`, `Pagination`, `formatDate`, `useAuth`, icons `EyeIcon`, `HeartIcon`, `CommentIcon`, `FileTextIcon`, `ClockIcon`, `GlobeIcon`, `XIcon`; the extended `GET /api/users/:id` (stats, `interests`, `is_following`); `POST`/`DELETE /api/users/:id/follow`; `GET /api/users/:id/followers` and `/following`.
- Produces: upgraded public author page with stats row, social links, follow/unfollow button + follower/following counts, a followers/following modal, interests chips, and an "Edit profile" button when viewing yourself.

- [x] **Step 1: Replace `client/src/pages/AuthorProfilePage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { ArticleCard } from '../components/ArticleCard.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { EyeIcon, HeartIcon, CommentIcon, FileTextIcon, ClockIcon, GlobeIcon, XIcon } from '../components/Icons.jsx';

function FollowersModal({ id, onClose }) {
  const [tab, setTab] = useState('followers');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const path = tab === 'followers' ? `/api/users/${id}/followers` : `/api/users/${id}/following`;
    api.get(path)
      .then((d) => setList(tab === 'followers' ? d.followers : d.following))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [tab, id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-actions" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="row" style={{ gap: 6 }}>
            <button className={`chip ${tab === 'followers' ? 'active' : ''}`} onClick={() => setTab('followers')}>Followers</button>
            <button className={`chip ${tab === 'following' ? 'active' : ''}`} onClick={() => setTab('following')}>Following</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {loading ? (
            <p className="muted small">Loading…</p>
          ) : list.length === 0 ? (
            <p className="muted small">No one here yet.</p>
          ) : (
            list.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <Avatar user={u} size="sm" />
                <Link to={`/authors/${u.id}`} onClick={onClose}>{u.name}</Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthorProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [author, setAuthor] = useState(null);
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    api.get(`/api/users/${id}?page=${page}`)
      .then((d) => {
        setAuthor({ ...d.user, interests: d.interests });
        setArticles(d.articles);
        setTotal(d.total);
        setTotalPages(d.total_pages);
        setFollowing(!!d.user.is_following);
      })
      .catch((e) => e.status === 404 && setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, page]);

  if (loading) {
    return <div className="container" style={{ padding: '60px 20px' }}><div className="skeleton" style={{ height: 200 }} /><div className="grid" style={{ marginTop: 24 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}</div></div>;
  }

  if (notFound || !author) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: 'center' }}>
        <h1>Author not found</h1>
        <div style={{ marginTop: 20 }}><a className="btn btn-primary" href="/">Back home</a></div>
      </div>
    );
  }

  const isSelf = user && Number(user.id) === Number(id);

  const toggleFollow = async () => {
    setFollowBusy(true);
    try {
      if (following) {
        const d = await api.del(`/api/users/${id}/follow`);
        setFollowing(false);
        setAuthor((a) => ({ ...a, follower_count: d.follower_count }));
      } else {
        const d = await api.post(`/api/users/${id}/follow`, {});
        setFollowing(true);
        setAuthor((a) => ({ ...a, follower_count: d.follower_count }));
      }
    } finally {
      setFollowBusy(false);
    }
  };

  const socialLinks = [];
  if (author.website) socialLinks.push({ label: author.website.replace(/^https?:\/\//, ''), href: author.website, key: 'website' });
  if (author.github) socialLinks.push({ label: 'GitHub', href: `https://github.com/${author.github}`, key: 'github' });
  if (author.twitter) socialLinks.push({ label: 'X', href: `https://x.com/${author.twitter}`, key: 'twitter' });
  if (author.google) socialLinks.push({ label: 'Google', href: `https://g.dev/${author.google}`, key: 'google' });
  if (author.linkedin) socialLinks.push({ label: 'LinkedIn', href: `https://linkedin.com/in/${author.linkedin}`, key: 'linkedin' });

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="form-card" style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Avatar user={author} size="lg" />
          <div>
            <h1 style={{ fontSize: '1.7rem' }}>{author.name}</h1>
            <p className="sub">{author.bio || 'Writes for Readify.'}</p>
            <p className="small muted" style={{ marginTop: 8 }}>Member since {formatDate(author.created_at)} · {total} published article{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 8 }}>
          {isSelf ? (
            <Link to="/profile" className="btn btn-outline btn-sm">Edit profile</Link>
          ) : user ? (
            <button className={`btn btn-sm ${following ? 'btn-outline' : 'btn-primary'}`} onClick={toggleFollow} disabled={followBusy}>
              {following ? 'Following' : 'Follow'}
            </button>
          ) : (
            <Link to="/login" className="btn btn-outline btn-sm">Log in to follow</Link>
          )}
          <button className="small muted" style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setModalOpen(true)}>
            {author.follower_count} followers · {author.following_count} following
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <div className="stat-chip"><EyeIcon /> {author.total_views} views</div>
        <div className="stat-chip"><HeartIcon /> {author.total_reactions} reactions</div>
        <div className="stat-chip"><CommentIcon /> {author.total_comments} comments</div>
        <div className="stat-chip"><FileTextIcon /> {author.total_published} published</div>
        <div className="stat-chip"><ClockIcon /> {formatDate(author.created_at)}</div>
      </div>

      {socialLinks.length > 0 && (
        <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {socialLinks.map((s) => (
            <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" className="tag-pill">
              <GlobeIcon /> {s.label}
            </a>
          ))}
        </div>
      )}

      {author.interests?.length > 0 && (
        <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <span className="small muted">Interests:</span>
          {author.interests.map((t) => (
            <Link key={t.id} to={`/discover?tag=${t.slug}`} className="tag-pill">#{t.name}</Link>
          ))}
        </div>
      )}

      <div className="section-head">
        <h2>Published articles</h2>
      </div>
      <div className="grid">
        {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {modalOpen && <FollowersModal id={id} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
```

Note: `author.interests` comes from the extended endpoint (`interests` at the top level of the response); the `.then` above stores it on the author object.

- [x] **Step 2: Verify the client builds**

Run: `cd /workspace/client && npx vite build`
Expected: build succeeds (exit 0).

Log in as the Task 2 user and open `http://localhost:5173/authors/2` — the page shows Alice's stats row, social links (empty for Alice), a Follow button (if logged in and not self), and the follower count.

- [x] **Step 3: Commit**

```bash
git add client/src/pages/AuthorProfilePage.jsx
git commit -m "feat(web): author profile stats, social links, follow and interests"
```

---

### Task 6: Discover Following tab + Home For-you section

**Files:**
- Modify: `client/src/pages/DiscoverPage.jsx`
- Modify: `client/src/pages/HomePage.jsx`

**Interfaces:**
- Consumes: `useAuth`, `api`, `ArticleCard`, `UsersIcon` (Discover); `api`, `ArticleCard`, `useAuth`, `Link` (Home); backend `/api/articles/following` and `/api/articles/for-you`.
- Produces: Discover "Following" tab (auth-only) with feed + empty state; Home "For you" section with matching articles or an interests prompt.

- [x] **Step 1: Update `DiscoverPage.jsx`**

Add `useAuth` to the imports:
```jsx
import { useAuth } from '../context/AuthContext.jsx';
import { UsersIcon } from '../components/Icons.jsx';
```

Add state and effect after the existing `const [loading, setLoading] = useState(true);`:
```jsx
  const { user } = useAuth();
  const [tab, setTab] = useState('all');
  const [followingArticles, setFollowingArticles] = useState([]);
  const [followingTotal, setFollowingTotal] = useState(0);
  const [followingLoading, setFollowingLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'following') return;
    setFollowingLoading(true);
    api.get('/api/articles/following')
      .then((d) => { setFollowingArticles(d.articles); setFollowingTotal(d.total); })
      .catch(() => setFollowingArticles([]))
      .finally(() => setFollowingLoading(false));
  }, [tab]);
```

Add a tab row right after the `page-head` block (after line ~73):
```jsx
      <div className="row" style={{ gap: 6, marginBottom: 18 }}>
        <button className={`chip ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All</button>
        {user && <button className={`chip ${tab === 'following' ? 'active' : ''}`} onClick={() => setTab('following')}>Following</button>}
      </div>
```

Wrap the existing search/filters/list/pagination (everything from the `SearchBar` line through the `<Pagination … />` line) in `{tab === 'all' ? ( <> …existing… </> ) : ( …following feed… )}`. The following feed block:
```jsx
      <div>
        <div className="row" style={{ margin: '0 0 18px' }}>
          <span className="small muted">{followingTotal} article{followingTotal !== 1 ? 's' : ''} from authors you follow</span>
        </div>
        {followingLoading ? (
          <div className="grid">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 320 }} />)}</div>
        ) : followingArticles.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><UsersIcon style={{ fontSize: '2.2rem' }} /></div>
            <h3>You aren't following any authors yet</h3>
            <p style={{ marginTop: 6 }}>Visit an author's profile and hit Follow to see their new articles here.</p>
          </div>
        ) : (
          <div className="grid">
            {followingArticles.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        )}
      </div>
```

- [x] **Step 2: Update `HomePage.jsx`**

Add state after the existing `const [loading, setLoading] = useState(true);`:
```jsx
  const [forYou, setForYou] = useState([]);
  const [hasInterests, setHasInterests] = useState(false);

  useEffect(() => {
    if (!user) { setForYou([]); setHasInterests(false); return; }
    api.get('/api/articles/for-you')
      .then((d) => { setForYou(d.articles); setHasInterests(d.has_interests); })
      .catch(() => { setForYou([]); setHasInterests(false); });
  }, [user]);
```

Insert a For-you block immediately after the existing "Ready to share what you know?" alert block (which ends around line ~70):
```jsx
      {user && (
        hasInterests ? (
          forYou.length > 0 && (
            <section className="container featured-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">For you</span>
                  <h2>Based on your interests</h2>
                  <p className="sub">Stories matching the topics you follow.</p>
                </div>
                <Link to="/profile" className="btn btn-outline btn-sm">Edit interests</Link>
              </div>
              <div className="grid">
                {forYou.map((a) => <ArticleCard key={a.id} article={a} />)}
              </div>
            </section>
          )
        ) : (
          <div className="container">
            <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Personalize your feed — pick topics you love and we'll surface them for you.</span>
              <Link to="/profile" className="btn btn-outline btn-sm">Choose interests</Link>
            </div>
          </div>
        )
      )}
```

- [x] **Step 3: Verify the client builds**

Run: `cd /workspace/client && npx vite build`
Expected: build succeeds (exit 0).

- [x] **Step 4: Commit**

```bash
git add client/src/pages/DiscoverPage.jsx client/src/pages/HomePage.jsx
git commit -m "feat(web): Discover following tab and home for-you section"
```

---

### Task 7: E2E regression suite + cleanup

**Files:**
- Modify: `/tmp/opencode/e2e/test.mjs` (append sections 24-30)
- Modify: `/tmp/opencode/e2e/cleanup.mjs` (clean up `prof_*` users)

**Interfaces:**
- Consumes: everything from Tasks 1-6. Seeded fixtures: Alice Johnson is user id 2; tag slug `javascript` has published articles.
- Produces: appended E2E assertions (each prints `PASS`/`FAIL`), extending the existing 44-test suite.

- [x] **Step 1: Extend `cleanup.mjs`**

In `/tmp/opencode/e2e/cleanup.mjs`:
- Extend the deactivation email pattern to also match `prof_*@readify.test` (e.g. add `'prof_'` to the prefix list).
- After deactivating users, also delete stale follow rows so follower counts stay correct across re-runs. Add a statement that deletes follows where either side is an inactive user, e.g. run against the API database via the script's existing connection:

```js
db.prepare(
  `DELETE FROM follows WHERE follower_id IN (SELECT id FROM users WHERE active = 0)
    OR following_id IN (SELECT id FROM users WHERE active = 0)`
).run();
```
(If `cleanup.mjs` has no direct DB access, add it: open `better-sqlite3` on `data/readify.db` the same way `server/src/db.js` does.)

- [x] **Step 2: Append E2E sections to `test.mjs`**

Append before the `// ---- Summary ----` block:

```js
// ---- 24. Profile: register fresh user and edit own profile ----
await page.context().clearCookies();
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
const profEmail = `prof_${Date.now()}@readify.test`;
await page.fill('#reg-name', 'Profile Tester');
await page.fill('#reg-email', profEmail);
await page.fill('#reg-password', 'Password123');
await page.fill('#reg-confirm', 'Password123');
await page.click('form button[type="submit"]');
await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/admin', { timeout: 15000 });

await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
await page.waitForSelector('#pf-name', { timeout: 15000 });
await page.fill('#pf-name', 'Profile Tester Updated');
await page.fill('#pf-bio', 'Automated profile bio.');
await page.fill('#pf-website', 'https://example.com');
await page.fill('#pf-twitter', 'readifytest');
await page.click('button:has-text("Save profile")');
await page.waitForTimeout(1500);
check('Profile edit persists in UI', (await page.textContent('body')).includes('Profile Tester Updated'));

const meData = await page.evaluate(async () => {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  return await res.json();
});
check('Profile saved to backend',
  meData.user?.website === 'https://example.com' && meData.user?.twitter === 'readifytest' && meData.user?.bio === 'Automated profile bio.',
  `w=${meData.user?.website} t=${meData.user?.twitter}`);
const myId = meData.user.id;

const invalidWebsite = await page.evaluate(async () => {
  const res = await fetch('/api/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ website: 'not-a-url' }),
    credentials: 'same-origin',
  });
  return res.status;
});
check('Invalid website rejected (400)', invalidWebsite === 400, `status ${invalidWebsite}`);

const selfFollow = await page.evaluate(async (id) => {
  const res = await fetch(`/api/users/${id}/follow`, { method: 'POST', credentials: 'same-origin' });
  return res.status;
}, myId);
check('Self-follow rejected (400)', selfFollow === 400, `status ${selfFollow}`);

// ---- 25. Avatar upload on profile page ----
const fs = await import('node:fs');
fs.writeFileSync('/tmp/opencode/avatar.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
await page.waitForSelector('#pf-name', { timeout: 15000 });
await page.setInputFiles('input[type="file"][accept="image/*"]', '/tmp/opencode/avatar.png');
await page.waitForSelector('.form-card img.avatar', { timeout: 15000 });
check('Avatar upload previews', true);
await page.click('button:has-text("Save profile")');
await page.waitForTimeout(1200);

// ---- 26. Author page stats + follow/unfollow ----
await page.goto(`${BASE}/authors/2`, { waitUntil: 'networkidle' });
await page.waitForSelector('button:has-text("Follow")', { timeout: 15000 });
const authorBody = await page.textContent('body');
check('Author page shows stats', authorBody.includes('Member since') && /0 followers/.test(authorBody));
await page.click('button:has-text("Follow")');
await page.waitForTimeout(1200);
const followedBody = await page.textContent('body');
check('Follow button toggles to Following', followedBody.includes('1 followers') && followedBody.includes('Following'));

// ---- 27. Following feed on Discover ----
await page.goto(`${BASE}/discover`, { waitUntil: 'networkidle' });
await page.click('button:has-text("Following")');
await page.waitForSelector('.article-card', { timeout: 15000 });
check('Following feed shows followed author articles', (await page.textContent('body')).includes('Alice Johnson'));

// ---- 28. Interests + For-you on Home ----
const tagsData = await page.evaluate(async () => {
  const res = await fetch('/api/tags?limit=50', { credentials: 'same-origin' });
  return await res.json();
});
const jsTag = tagsData.tags.find((t) => t.slug === 'javascript');
if (jsTag) {
  const putRes = await page.evaluate(async (id) => {
    const res = await fetch('/api/users/me/interests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_ids: [id] }),
      credentials: 'same-origin',
    });
    return res.status;
  }, jsTag.id);
  check('Interests set (PUT /me/interests)', putRes === 200, `status ${putRes}`);
  const forYou = await page.evaluate(async () => {
    const res = await fetch('/api/articles/for-you', { credentials: 'same-origin' });
    return await res.json();
  });
  check('For-you returns matching articles', forYou.has_interests === true && forYou.articles.length > 0, `${forYou.articles.length} articles`);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('Home shows For you section', (await page.textContent('body')).includes('Based on your interests'));
} else {
  check('For-you returns matching articles', false, 'javascript tag missing');
  check('Home shows For you section', false, 'skipped');
}

// ---- 29. More than 5 interests rejected ----
const sixIds = tagsData.tags.slice(0, 6).map((t) => t.id);
if (sixIds.length === 6) {
  const over = await page.evaluate(async (ids) => {
    const res = await fetch('/api/users/me/interests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_ids: ids }),
      credentials: 'same-origin',
    });
    return res.status;
  }, sixIds);
  check('More than 5 interests rejected (400)', over === 400, `status ${over}`);
} else {
  check('More than 5 interests rejected (400)', false, 'need >= 6 tags');
}

// ---- 30. Unfollow ----
await page.goto(`${BASE}/authors/2`, { waitUntil: 'networkidle' });
await page.waitForSelector('button:has-text("Following")', { timeout: 15000 });
await page.click('button:has-text("Following")');
await page.waitForTimeout(1200);
check('Unfollow works', /0 followers/.test((await page.textContent('body'))));
```

- [x] **Step 3: Restart backend, clean up, run the full suite**

Kill and restart the backend terminal (resets rate-limit counters), then:

Run: `cd /tmp/opencode/e2e && node cleanup.mjs`
Expected: deactivates leftover `user_*`, `del_*`, `editor_*`, `delete_*`, and now `prof_*` test users.

Run: `cd /tmp/opencode/e2e && node test.mjs`
Expected: `==== RESULT: 52 passed, 0 failed ====` (44 existing + 8 new from sections 24-30, accounting for conditional skips). If the count differs, every `FAIL` line must be investigated and fixed — do not silence checks.

Run: `cd /tmp/opencode/e2e && node sanitize_check.mjs`
Expected: `CHECK PASS` (editor sanitizer round-trip unchanged).

- [x] **Step 4: Clean up and commit**

Run: `cd /tmp/opencode/e2e && node cleanup.mjs`
Expected: leftover `prof_*` users deactivated; no articles to delete.

Commit any fix made during Step 3:
```bash
git add -A && git commit -m "test: add profile, follow, interests and feed E2E coverage"
```
(Only stage real fixes; if no fixes were needed, skip the commit.)
