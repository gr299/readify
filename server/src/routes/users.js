import { Router } from 'express';
import { db, USE_SUPABASE } from '../db.js';
import { ApiError, paginate, publicUser, wrap } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, schemas } from '../validation.js';
import { serializeArticle } from './articles.js';

const router = Router();

// Helper to handle both sync (SQLite) and async (Supabase) database calls
async function dbGet(query, ...params) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(query);
    return await stmt.get(...params);
  }
  return db.prepare(query).get(...params);
}

async function dbRun(query, ...params) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(query);
    return await stmt.run(...params);
  }
  return db.prepare(query).run(...params);
}

async function dbAll(query, ...params) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(query);
    return await stmt.all(...params);
  }
  return db.prepare(query).all(...params);
}

router.get(
  '/me/interests',
  requireAuth,
  wrap(async (req, res) => {
    const interests = await dbAll(
      `SELECT t.id, t.name, t.slug FROM tags t
       JOIN user_interests ui ON ui.tag_id = t.id
       WHERE ui.user_id = ? ORDER BY t.name`,
      req.user.id
    );
    return res.json({ interests });
  })
);

router.put(
  '/me/interests',
  requireAuth,
  validate(schemas.interests),
  wrap(async (req, res) => {
    const ids = [...new Set(req.body.tag_ids)];
    if (ids.length === 0) {
      await dbRun('DELETE FROM user_interests WHERE user_id = ?', req.user.id);
    } else {
      const placeholders = ids.map(() => '?').join(', ');
      const found = await dbAll(`SELECT id FROM tags WHERE id IN (${placeholders})`, ...ids);
      if (found.length !== ids.length) throw new ApiError(404, 'One or more tags do not exist');
      await dbRun('DELETE FROM user_interests WHERE user_id = ?', req.user.id);
      for (const id of ids) {
        await dbRun('INSERT INTO user_interests (user_id, tag_id) VALUES (?, ?)', req.user.id, id);
      }
    }
    const interests = await dbAll(
      `SELECT t.id, t.name, t.slug FROM tags t
       JOIN user_interests ui ON ui.tag_id = t.id
       WHERE ui.user_id = ? ORDER BY t.name`,
      req.user.id
    );
    return res.json({ interests });
  })
);

router.patch(
  '/me',
  requireAuth,
  validate(schemas.profileUpdate),
  wrap(async (req, res) => {
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
      const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";
      await dbRun(`UPDATE users SET ${sets}, updated_at = ${nowFunc} WHERE id = @id`, {
        ...updates,
        id: req.user.id,
      });
    }
    const updated = await dbGet('SELECT * FROM users WHERE id = ?', req.user.id);
    return res.json({ user: publicUser(updated) });
  })
);

router.post(
  '/:id/follow',
  requireAuth,
  wrap(async (req, res) => {
    const target = Number(req.params.id);
    if (target === req.user.id) throw new ApiError(400, 'You cannot follow yourself');
    const exists = await dbGet('SELECT id FROM users WHERE id = ? AND active = 1', target);
    if (!exists) throw new ApiError(404, 'User not found');
    await dbRun('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)', req.user.id, target);
    const follower_count = (await dbGet(
      `SELECT COUNT(*) AS c FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ? AND u.active = 1`,
      target
    )).c;
    return res.json({ following: true, follower_count });
  })
);

router.delete(
  '/:id/follow',
  requireAuth,
  wrap(async (req, res) => {
    const target = Number(req.params.id);
    await dbRun('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', req.user.id, target);
    const follower_count = (await dbGet(
      `SELECT COUNT(*) AS c FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ? AND u.active = 1`,
      target
    )).c;
    return res.json({ following: false, follower_count });
  })
);

router.get(
  '/:id/followers',
  wrap(async (req, res) => {
    const user = await dbGet('SELECT id FROM users WHERE id = ?', req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    const { page, limit, offset } = paginate(req.query.page, 12);
    const total = (await dbGet(
      `SELECT COUNT(*) AS c FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ? AND u.active = 1`,
      user.id
    )).c;
    const rows = await dbAll(
      `SELECT u.* FROM users u
       JOIN follows f ON f.follower_id = u.id
       WHERE f.following_id = ? AND u.active = 1
       ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
      user.id, limit, offset
    );
    return res.json({ followers: rows.map(publicUser), page, limit, total, total_pages: Math.ceil(total / limit) });
  })
);

router.get(
  '/:id/following',
  wrap(async (req, res) => {
    const user = await dbGet('SELECT id FROM users WHERE id = ?', req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    const { page, limit, offset } = paginate(req.query.page, 12);
    const total = (await dbGet(
      `SELECT COUNT(*) AS c FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ? AND u.active = 1`,
      user.id
    )).c;
    const rows = await dbAll(
      `SELECT u.* FROM users u
       JOIN follows f ON f.following_id = u.id
       WHERE f.follower_id = ? AND u.active = 1
       ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
      user.id, limit, offset
    );
    return res.json({ following: rows.map(publicUser), page, limit, total, total_pages: Math.ceil(total / limit) });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', req.params.id);
    if (!user) throw new ApiError(404, 'User not found');

    const stats = await dbGet(
      `SELECT COUNT(*) AS total_published,
              COALESCE(SUM(views_count), 0) AS total_views,
              COALESCE(SUM(reactions_count), 0) AS total_reactions,
              COALESCE(SUM(comments_count), 0) AS total_comments
       FROM articles WHERE user_id = ? AND status = 'published'`,
      user.id
    );
    const follower_count = (await dbGet(
      `SELECT COUNT(*) AS c FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ? AND u.active = 1`,
      user.id
    )).c;
    const following_count = (await dbGet(
      `SELECT COUNT(*) AS c FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ? AND u.active = 1`,
      user.id
    )).c;
    const is_following =
      req.user &&
      Number(req.user.id) !== user.id &&
      !!(await dbGet('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', req.user.id, user.id));
    const interests = await dbAll(
      `SELECT t.id, t.name, t.slug FROM tags t
       JOIN user_interests ui ON ui.tag_id = t.id
       WHERE ui.user_id = ? ORDER BY t.name`,
      user.id
    );

    const { page, limit, offset } = paginate(req.query.page, 12);
    const total = (await dbGet(`SELECT COUNT(*) AS c FROM articles WHERE user_id = ? AND status = 'published'`, user.id)).c;
    const rows = await dbAll(
      `SELECT * FROM articles WHERE user_id = ? AND status = 'published'
       ORDER BY published_at DESC LIMIT ? OFFSET ?`,
      user.id, limit, offset
    );

    const articles = await Promise.all(rows.map((a) => serializeArticle(a, req.user)));

    return res.json({
      user: {
        ...publicUser(user),
        ...stats,
        follower_count,
        following_count,
        is_following,
      },
      interests,
      articles,
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    });
  })
);

export default router;
