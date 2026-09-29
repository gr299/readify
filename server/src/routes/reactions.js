import { Router } from 'express';
import { db, USE_SUPABASE } from '../db.js';
import { ApiError, wrap, trackActivity } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { reactionLimiter } from '../middleware/rateLimit.js';
import { validate, schemas } from '../validation.js';

const router = Router();
const REACTION_TYPES = ['like', 'love', 'fire', 'idea'];

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

async function getArticleOrFail(id) {
  const article = await dbGet('SELECT * FROM articles WHERE id = ?', id);
  if (!article) throw new ApiError(404, 'Article not found');
  return article;
}

async function recompute(articleId) {
  await dbRun(
    'UPDATE articles SET reactions_count = (SELECT COUNT(*) FROM reactions WHERE article_id = ?) WHERE id = ?',
    articleId, articleId
  );
}

router.get(
  '/articles/:articleId/reactions',
  wrap(async (req, res) => {
    const article = await getArticleOrFail(req.params.articleId);
    if (article.status !== 'published') {
      throw new ApiError(404, 'Article not found');
    }
    const rows = await dbAll(
      'SELECT type, COUNT(*) AS c FROM reactions WHERE article_id = ? GROUP BY type',
      article.id
    );
    const counts = { like: 0, love: 0, fire: 0, idea: 0, total: 0 };
    for (const r of rows) {
      counts[r.type] = r.c;
      counts.total += r.c;
    }
    let user_reaction = null;
    if (req.user) {
      const ur = await dbGet(
        'SELECT type FROM reactions WHERE article_id = ? AND user_id = ?',
        article.id, req.user.id
      );
      user_reaction = ur ? ur.type : null;
    }
    return res.json({ counts, user_reaction });
  })
);

router.post(
  '/articles/:articleId/reactions',
  requireAuth,
  reactionLimiter,
  validate(schemas.reaction),
  wrap(async (req, res) => {
    const article = await getArticleOrFail(req.params.articleId);
    if (article.status !== 'published') {
      throw new ApiError(403, 'Reactions are only allowed on published articles');
    }
    const type = req.body.type || 'like';
    if (!REACTION_TYPES.includes(type)) {
      throw new ApiError(400, 'Invalid reaction type');
    }
    const timestamp = USE_SUPABASE ? 'CURRENT_TIMESTAMP' : 'CURRENT_TIMESTAMP';
    await dbRun(
      `INSERT INTO reactions (article_id, user_id, type) VALUES (?, ?, ?)
       ON CONFLICT(article_id, user_id) DO UPDATE SET type = excluded.type, created_at = ${timestamp}`,
      article.id, req.user.id, type
    );
    await recompute(article.id);
    await trackActivity(req.user.id, 'reaction.upsert', 'reaction', article.id, { type });
    const counts = await dbAll(
      'SELECT type, COUNT(*) AS c FROM reactions WHERE article_id = ? GROUP BY type',
      article.id
    );
    const summary = { like: 0, love: 0, fire: 0, idea: 0, total: 0 };
    for (const r of counts) summary[r.type] = r.c, (summary.total += r.c);
    return res.json({ counts: summary, user_reaction: type });
  })
);

router.delete(
  '/articles/:articleId/reactions',
  requireAuth,
  reactionLimiter,
  wrap(async (req, res) => {
    const article = await getArticleOrFail(req.params.articleId);
    await dbRun('DELETE FROM reactions WHERE article_id = ? AND user_id = ?', article.id, req.user.id);
    await recompute(article.id);
    await trackActivity(req.user.id, 'reaction.removed', 'reaction', article.id);
    return res.json({ ok: true });
  })
);

export default router;
