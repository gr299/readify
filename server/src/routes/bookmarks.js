import { Router } from 'express';
import { db, USE_SUPABASE } from '../db.js';
import { ApiError, paginate, wrap } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
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

router.post(
  '/articles/:articleId/bookmark',
  requireAuth,
  wrap(async (req, res) => {
    const article = await dbGet('SELECT * FROM articles WHERE id = ?', req.params.articleId);
    if (!article) throw new ApiError(404, 'Article not found');
    if (article.status !== 'published') throw new ApiError(403, 'Only published articles can be bookmarked');

    const existing = await dbGet(
      'SELECT id FROM bookmarks WHERE article_id = ? AND user_id = ?',
      article.id, req.user.id
    );
    let bookmarked;
    if (existing) {
      await dbRun('DELETE FROM bookmarks WHERE id = ?', existing.id);
      bookmarked = false;
    } else {
      await dbRun('INSERT INTO bookmarks (article_id, user_id) VALUES (?, ?)', article.id, req.user.id);
      bookmarked = true;
    }
    return res.json({ bookmarked });
  })
);

router.get(
  '/me/bookmarks',
  requireAuth,
  wrap(async (req, res) => {
    const { page, limit, offset } = paginate(req.query.page, 12);
    const total = (await dbGet('SELECT COUNT(*) AS c FROM bookmarks WHERE user_id = ?', req.user.id)).c;
    const rows = await dbAll(
      `SELECT a.* FROM bookmarks b JOIN articles a ON a.id = b.article_id
       WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
      req.user.id, limit, offset
    );
    const articles = await Promise.all(rows.map((a) => serializeArticle(a, req.user)));
    return res.json({
      articles,
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    });
  })
);

router.get(
  '/me/activities',
  requireAuth,
  wrap(async (req, res) => {
    const limit = Math.min(30, parseInt(req.query.limit, 10) || 15);
    const rows = await dbAll(
      `SELECT a.*,
        (SELECT title FROM articles WHERE id = a.entity_id) AS entity_title
       FROM activities a WHERE a.user_id = ?
       ORDER BY a.created_at DESC LIMIT ?`,
      req.user.id, limit
    );
    return res.json({ activities: rows });
  })
);

export default router;
