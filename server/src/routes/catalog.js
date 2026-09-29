import { Router } from 'express';
import { db, USE_SUPABASE } from '../db.js';
import { paginate, wrap } from '../utils.js';

const router = Router();

// Helper to handle both sync (SQLite) and async (Supabase) database calls
async function dbAll(query, ...params) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(query);
    return await stmt.all(...params);
  }
  return db.prepare(query).all(...params);
}

router.get(
  '/categories',
  wrap(async (_req, res) => {
    const rows = await dbAll(
      `SELECT c.id, c.name, c.slug, COUNT(a.id) AS article_count
       FROM categories c
       LEFT JOIN articles a ON a.category_id = c.id AND a.status = 'published'
       GROUP BY c.id ORDER BY c.name`
    );
    return res.json({ categories: rows });
  })
);

router.get(
  '/tags',
  wrap(async (req, res) => {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 30);
    const rows = await dbAll(
      `SELECT t.id, t.name, t.slug, COUNT(at.article_id) AS article_count
       FROM tags t
       JOIN article_tags at ON at.tag_id = t.id
       JOIN articles a ON a.id = at.article_id AND a.status = 'published'
       GROUP BY t.id ORDER BY article_count DESC, t.name LIMIT ?`,
      limit
    );
    return res.json({ tags: rows });
  })
);

export default router;
