import { Router } from 'express';
import { db, USE_SUPABASE } from '../db.js';
import { ApiError, paginate, publicUser, wrap, trackActivity } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { commentLimiter } from '../middleware/rateLimit.js';
import { validate, schemas } from '../validation.js';
import { syncTagCounts } from './articles.js';

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

async function getArticleOrFail(id) {
  const article = await dbGet('SELECT * FROM articles WHERE id = ?', id);
  if (!article) throw new ApiError(404, 'Article not found');
  return article;
}

function canComment(article, user) {
  return article.status === 'published' || user.role === 'admin' || article.user_id === user.id;
}

async function serializeComment(row, currentUser) {
  const author = await dbGet('SELECT id, name, email, role, avatar FROM users WHERE id = ?', row.user_id);
  const isMine = currentUser ? currentUser.id === row.user_id : false;
  const isAdmin = currentUser ? currentUser.role === 'admin' : false;
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    edited_at: row.edited_at,
    article_id: row.article_id,
    author: publicUser(author),
    permissions: { can_edit: isMine, can_delete: isMine || isAdmin },
  };
}

router.get(
  '/articles/:articleId/comments',
  wrap(async (req, res) => {
    const article = await getArticleOrFail(req.params.articleId);
    if (article.status !== 'published' && !(req.user && (req.user.role === 'admin' || article.user_id === req.user.id))) {
      throw new ApiError(404, 'Article not found');
    }
    const { page, limit, offset } = paginate(req.query.page, 20);
    const total = (await dbGet('SELECT COUNT(*) AS c FROM comments WHERE article_id = ?', article.id)).c;
    const rows = await dbAll(
      `SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`,
      article.id, limit, offset
    );
    const comments = await Promise.all(rows.map((r) => serializeComment(r, req.user)));
    return res.json({
      comments,
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    });
  })
);

router.post(
  '/articles/:articleId/comments',
  requireAuth,
  commentLimiter,
  validate(schemas.comment),
  wrap(async (req, res) => {
    const article = await getArticleOrFail(req.params.articleId);
    if (!canComment(article, req.user)) {
      throw new ApiError(403, 'Comments are only allowed on published articles');
    }
    const content = req.body.content.trim();
    const info = await dbRun(
      'INSERT INTO comments (article_id, user_id, content) VALUES (?, ?, ?)',
      article.id, req.user.id, content
    );
    const row = await dbGet('SELECT * FROM comments WHERE id = ?', info.lastInsertRowid);
    await syncTagCounts(article.id);
    await trackActivity(req.user.id, 'comment.created', 'comment', Number(info.lastInsertRowid), { article_id: article.id });
    const comment = await serializeComment(row, req.user);
    return res.status(201).json({ comment });
  })
);

router.put(
  '/comment/:id',
  requireAuth,
  commentLimiter,
  validate(schemas.comment),
  wrap(async (req, res) => {
    const row = await dbGet('SELECT * FROM comments WHERE id = ?', req.params.id);
    if (!row) throw new ApiError(404, 'Comment not found');
    const isMine = row.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isMine && !isAdmin) {
      throw new ApiError(403, 'You can only edit your own comments');
    }
    const content = req.body.content.trim();
    const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";
    await dbRun(`UPDATE comments SET content = ?, edited_at = ${nowFunc} WHERE id = ?`, content, row.id);
    const updated = await dbGet('SELECT * FROM comments WHERE id = ?', row.id);
    await trackActivity(req.user.id, 'comment.updated', 'comment', row.id);
    const comment = await serializeComment(updated, req.user);
    return res.json({ comment });
  })
);

router.delete(
  '/comment/:id',
  requireAuth,
  wrap(async (req, res) => {
    const row = await dbGet('SELECT * FROM comments WHERE id = ?', req.params.id);
    if (!row) throw new ApiError(404, 'Comment not found');
    const isMine = row.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isMine && !isAdmin) {
      throw new ApiError(403, 'You can only delete your own comments');
    }
    await dbRun('DELETE FROM comments WHERE id = ?', row.id);
    await syncTagCounts(row.article_id);
    await trackActivity(req.user.id, 'comment.deleted', 'comment', row.id);
    return res.json({ ok: true });
  })
);

export default router;
