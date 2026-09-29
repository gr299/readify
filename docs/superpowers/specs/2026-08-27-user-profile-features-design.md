# User Profile Features — Design

Date: 2026-08-27
Status: Approved design (pending implementation plan)

## Overview

Add five user-profile capabilities to Readify:

1. Editable own profile (name, bio, avatar, social links)
2. Public profile stats on the author page
3. Follow system — core follow/unfollow + follower/following counts + a "Following" feed on Discover
4. Social links — website, GitHub, X/Twitter, Google, LinkedIn
5. Personalized interests — a "For you" section on Home built from the user's chosen tags

The platform already has: `users` table (name, email, password_hash, role, avatar, bio, active, created_at, updated_at), a public author page at `/author/:id` backed by `GET /api/users/:id` (catalog.js), `publicUser()` in utils.js, avatar as a data-URI stored in the DB, an existing image upload route (`POST /api/uploads/images`), JWT httpOnly cookie auth (`attachUser`/`requireAuth`), and zod validation.

## Goals

- Users can edit their own profile from a dedicated page.
- Public author pages show meaningful stats and social links.
- Users can follow authors and see a feed of followed authors' published articles on Discover.
- Users pick favorite tags; Home shows a "For you" section.
- All behavior is backend-enforced and reuses existing auth/middleware/validation patterns.

## Non-goals

- Follower counts / author-name badges on article cards or in list views.
- User editing of email, password, or role.
- Private profiles / public-profile visibility toggles.
- Notifications for new follows.

## Data Model

### users — new columns (nullable TEXT)

- `website`
- `github`
- `twitter`
- `google`
- `linkedin`

Applied with the existing idempotent migration pattern: check `PRAGMA table_info(users)` for the column, `ALTER TABLE users ADD COLUMN` if missing (same approach as the `featured` column).

### New table: follows

```
follows (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id   INTEGER NOT NULL,
  following_id  INTEGER NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (follower_id, following_id)
)
```

Indexes: `follows(follower_id)`, `follows(following_id)`.

### New table: user_interests

```
user_interests (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL,
  tag_id   INTEGER NOT NULL,
  UNIQUE (user_id, tag_id)
)
```

Index: `user_interests(user_id)`.

### publicUser extension

Add `website`, `github`, `twitter`, `google`, `linkedin` to `publicUser()`. Follower/following counts are NOT part of `publicUser` (computed per-endpoint to avoid N+1 in lists).

## API

New route modules: `server/src/routes/users.js` (mounted at `/api/users`, hosting `GET /:id`, the new follow routes, `PATCH /me`, and `PUT /me/interests`); `server/src/routes/articles.js` gains `GET /following` and `GET /for-you`. `GET /users/:id` moves from catalog.js into users.js. All routes use `wrap()` and the existing `ApiError` pattern.

### PATCH /api/users/me (requireAuth)

Update own profile.

Body (zod):
- `name`: string, 1–80 chars
- `bio`: string, 0–500 chars
- `avatar`: string, optional — empty, or one of `/uploads/<filename>`, `data:image/*` data URI, or `http(s)://` URL; max length ~2 MB string
- `website`: string, optional — empty or absolute `http(s)://` URL
- `github`, `twitter`, `google`, `linkedin`: string, optional — empty or username matching `[A-Za-z0-9._-]{1,40}` (leading `@` on twitter is stripped)

Response: `{ user: publicUser(updated) }`. Sets `updated_at = CURRENT_TIMESTAMP`.

### GET /api/users/:id (public, attachUser)

Extended response, in addition to the existing `articles`/`page`/`total`/`total_pages`:

- `user`: `publicUser(user)` plus:
  - `total_published` — count of published articles
  - `total_views` — SUM of views over published articles
  - `total_reactions` — COUNT of reactions received on published articles
  - `total_comments` — COUNT of comments on published articles
  - `follower_count`
  - `following_count`
  - `is_following` — bool; `false` when unauthenticated
- `interests`: `[{id, name, slug}]` — the author's interest tags

### POST /api/users/:id/follow (requireAuth)

- 400 "You cannot follow yourself" when target is self
- 404 when target missing or `active = 0`
- Idempotent via `INSERT OR IGNORE`
- Response: `{ following: true, follower_count }`

### DELETE /api/users/:id/follow (requireAuth)

- Idempotent delete of the caller's follow
- Response: `{ following: false, follower_count }`

### GET /api/users/:id/followers (public)

Active users following the target, paginated (limit 12). Each entry is `publicUser`.

### GET /api/users/:id/following (public)

Active users the target follows, paginated (limit 12). Each entry is `publicUser`.

### GET /api/articles/following (requireAuth)

Published articles authored by active users the caller follows.

- `ORDER BY published_at DESC`, paginated (limit 12)
- Response: `{ articles, total, page, total_pages }`

### GET /api/articles/for-you (requireAuth)

Published articles matching at least one of the caller's interest tags.

- `ORDER BY published_at DESC`, deduplicated, limit 6
- Response: `{ articles, has_interests }` (`has_interests` is `false` when the caller has no interests, so the frontend can show a prompt)

### PUT /api/users/me/interests (requireAuth)

- Body: `{ tag_ids: number[] }` — max 5, deduplicated, each tag must exist (404 otherwise)
- Replaces the caller's entire interest set in a transaction
- Response: `{ interests: [{id, name, slug}] }`

### Social link construction

- website → the validated URL itself
- github → `https://github.com/<username>`
- twitter → `https://x.com/<username>`
- google → `https://g.dev/<username>`
- linkedin → `https://linkedin.com/in/<username>`

Username charset validation prevents URL-injection. Social fields are never rendered as HTML; always in `href` with validated values.

## Frontend

### MyProfilePage (`/profile`, RequireAuth)

- Avatar: current avatar preview (reuse `Avatar` component), "Upload photo" file input → `POST /api/uploads/images` (multipart) → store the returned `/uploads/<filename>`; allow clearing.
- Fields: name, bio, website, github, twitter, google, linkedin.
- Interests: chip picker from `GET /api/tags?limit=50`, toggle selection, max 5, saved via `PUT /api/users/me/interests`.
- Save button → `PATCH /api/users/me`; success/error toast via existing ToastContext.
- "View my public profile" link → `/author/:id`.
- Added as "My Profile" entry in the authenticated nav user menu.

### AuthorProfilePage upgrade

- Stats row: views, reactions, comments, published articles, member-since (reuse existing icons).
- Social links row: icons + validated `href` for each present field.
- Follow button: self → "Edit profile" link; authenticated → "Follow"/"Following" toggle calling the follow endpoints; unauthenticated → "Log in to follow" link. Show follower/following counts; a lightweight modal lists followers and following (tabs) from the two list endpoints.
- Top interests chips row.

### DiscoverPage

- Tabs: All | Following (auth-only). "Following" tab → `GET /api/articles/following`; it is a simple feed list (no search/sort/category/tag filters). Empty state: "You aren't following any authors yet".
- Existing search/sort/category/tag behavior for the All tab is unchanged.

### HomePage

- "For you" section when authenticated:
  - `has_interests` → horizontal grid of up to 6 matching articles (reuse `ArticleCard`).
  - no interests → small prompt card linking to `/profile`.
- Placed below the hero, above the latest-articles grid. Not rendered for unauthenticated users.

## Edge Cases & Rules

- Self-follow → 400.
- Followers/following lists exclude `active = 0` users.
- Following feed only includes published articles by active authors.
- Admin user deletion (soft delete: `active = 0`) also removes that user's `follows` rows (both directions) and `user_interests` rows, so lists and feeds stay clean.
- Interests: max 5, deduplicated, must exist; replace-set is transactional.
- Avatar: scheme validated; length bounded; empty allowed (falls back to initials avatar).
- `is_following` is per-requester; unauthenticated → `false`.
- General rate limiter already applies to all `/api` routes, including the new ones.

## Error Handling

- zod validation failures → 400 with field messages (existing pattern).
- 404 for missing user or tag.
- All handlers wrapped with `wrap()`; errors flow to the existing errorHandler.

## Testing (E2E additions)

1. Profile edit persists: register user → PATCH name/bio/website → `GET /api/users/:id` reflects; author page shows bio and website link.
2. Social validation: non-URL website → 400; invalid username chars → 400.
3. Avatar via the uploads endpoint.
4. Follow flow: user A follows author B → `follower_count` 1; author page `is_following` true; unfollow → 0.
5. Self-follow → 400.
6. Following feed: author B publishes an article → appears in A's `/api/articles/following`; author C (not followed) excluded.
7. For-you: set interest tag X → Home for-you returns a matching article; a non-matching article is excluded; no interests → `has_interests` false.
8. Interests limit: a 6th tag → 400.
9. Inactive user excluded from followers list.

## Migration / Data

- `ALTER TABLE users` adds 5 nullable columns via the idempotent PRAGMA-check pattern.
- `CREATE TABLE IF NOT EXISTS follows` and `user_interests` with indexes.
- No seed changes.

## Implementation Notes

- Move `GET /users/:id` from catalog.js into the new users.js router (mounted at `/api/users`), then extend it; keep the response shape compatible (additive fields only) so existing pages keep working.
- `publicUser()` is used by `GET /api/auth/me`; extending it with social fields is safe and gives the client the new fields on login/me.
- Follow buttons/feed must be tested against the soft-delete rule (admin deactivates a user → they disappear from followers/following/feed).
