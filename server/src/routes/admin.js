import { Router } from 'express';
import { db, getSetting, setSetting, USE_SUPABASE } from '../db.js';
import { ApiError, paginate, publicUser, slugify, trackActivity, wrap } from '../utils.js';
import { requireAdmin, requireAdminDomain } from '../middleware/auth.js';
import { serializeArticle } from './articles.js';

const router = Router();

// Temporarily disabled domain check for debugging
// router.use(wrap(requireAdminDomain));
router.use(requireAdmin);

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
  '/dashboard',
  wrap(async (_req, res) => {
    const total_articles = (await dbGet('SELECT COUNT(*) AS c FROM articles')).c;
    const published = (await dbGet("SELECT COUNT(*) AS c FROM articles WHERE status = 'published'")).c;
    const pending = (await dbGet("SELECT COUNT(*) AS c FROM articles WHERE status = 'pending'")).c;
    const drafts = (await dbGet("SELECT COUNT(*) AS c FROM articles WHERE status = 'draft'")).c;
    const rejected = (await dbGet("SELECT COUNT(*) AS c FROM articles WHERE status = 'rejected'")).c;
    const archived = (await dbGet("SELECT COUNT(*) AS c FROM articles WHERE status = 'archived'")).c;
    const total_users = (await dbGet('SELECT COUNT(*) AS c FROM users')).c;
    const total_comments = (await dbGet('SELECT COUNT(*) AS c FROM comments')).c;
    const total_reactions = (await dbGet('SELECT COUNT(*) AS c FROM reactions')).c;
    const total_views = (await dbGet('SELECT COUNT(*) AS c FROM article_views')).c;
    const total_bookmarks = (await dbGet('SELECT COUNT(*) AS c FROM bookmarks')).c;
    const total_domains = (await dbGet('SELECT COUNT(*) AS c FROM domains')).c;

    const recent_articles = (await dbAll('SELECT * FROM articles ORDER BY created_at DESC LIMIT 8'));
    const serializedArticles = await Promise.all(recent_articles.map((a) => serializeArticle(a, null)));
    const recent_users = (await dbAll('SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC LIMIT 8'));
    const recent_comments = await dbAll(
      `SELECT c.*, u.name AS user_name, a.title AS article_title FROM comments c
       JOIN users u ON u.id = c.user_id JOIN articles a ON a.id = c.article_id
       ORDER BY c.created_at DESC LIMIT 8`
    );

    return res.json({
      stats: {
        total_articles,
        published,
        pending,
        drafts,
        rejected,
        archived,
        total_users,
        total_comments,
        total_reactions,
        total_views,
        total_bookmarks,
        total_domains,
      },
      recent_articles: serializedArticles,
      recent_users: recent_users.map(publicUser),
      recent_comments,
    });
  })
);

router.get(
  '/articles',
  wrap(async (req, res) => {
    const { q, status, category, sort, author } = req.query;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit || 15);

    const where = [];
    const params = {};
    if (q) {
      params.q = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      where.push(
        `(a.title LIKE :q ESCAPE '\\' OR a.author LIKE :q ESCAPE '\\' OR u.name LIKE :q ESCAPE '\\')`
      );
    }
    if (status && status !== 'all') {
      params.status = status;
      where.push('a.status = :status');
    }
    if (category && category !== 'all') {
      params.category = category;
      where.push('a.category_id = :category');
    }
    if (author && author !== 'all') {
      params.author = author;
      where.push('a.author = :author');
    }
    if (req.query.featured === '1' || req.query.featured === 'true') {
      where.push('a.featured = 1');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderBy =
      sort === 'oldest'
        ? 'a.created_at ASC'
        : sort === 'updated'
        ? 'a.updated_at DESC'
        : 'a.created_at DESC';

    const total = (await dbGet(`SELECT COUNT(*) AS c FROM articles a LEFT JOIN users u ON u.id = a.user_id ${whereSql}`, params)).c;

    const rows = await dbAll(
      `SELECT a.* FROM articles a LEFT JOIN users u ON u.id = a.user_id
       ${whereSql} ORDER BY ${orderBy} LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset }
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
  '/users',
  wrap(async (req, res) => {
    const { q, role } = req.query;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit || 15);

    const where = [];
    const params = {};
    if (q) {
      params.q = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      where.push('(u.name LIKE :q ESCAPE \'\\\' OR u.email LIKE :q ESCAPE \'\\\')');
    }
    if (role && role !== 'all') {
      params.role = role;
      where.push('u.role = :role');
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = (await dbGet(`SELECT COUNT(*) AS c FROM users u ${whereSql}`, params)).c;

    const rows = await dbAll(
      `SELECT u.*,
        (SELECT COUNT(*) FROM articles a WHERE a.user_id = u.id) AS article_count,
        (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comment_count,
        (SELECT COUNT(*) FROM reactions r WHERE r.user_id = u.id) AS reaction_count
       FROM users u ${whereSql}
       ORDER BY u.created_at DESC LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset }
    );

    return res.json({
      users: rows.map((u) => ({ ...publicUser(u), active: u.active, article_count: u.article_count, comment_count: u.comment_count, reaction_count: u.reaction_count })),
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    });
  })
);

router.patch(
  '/users/:id',
  wrap(async (req, res) => {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    if (Number(req.params.id) === req.user.id && (req.body.active === false || req.body.role !== 'admin')) {
      throw new ApiError(400, 'You cannot change your own account status or role');
    }

    const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";

    if (req.body.role !== undefined) {
      if (!['admin', 'user'].includes(req.body.role)) {
        throw new ApiError(400, 'Invalid role');
      }
      const admins = (await dbGet("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1")).c;
      if (user.role === 'admin' && req.body.role !== 'admin' && admins <= 1) {
        throw new ApiError(400, 'At least one active administrator is required');
      }
      await dbRun(`UPDATE users SET role = ?, updated_at = ${nowFunc} WHERE id = ?`, req.body.role, user.id);
      await trackActivity(req.user.id, 'user.role_changed', 'user', user.id, { role: req.body.role });
    }

    if (req.body.active !== undefined) {
      const active = req.body.active ? 1 : 0;
      const admins = (await dbGet("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1")).c;
      if (user.role === 'admin' && !active && admins <= 1) {
        throw new ApiError(400, 'At least one active administrator is required');
      }
      await dbRun(`UPDATE users SET active = ?, updated_at = ${nowFunc} WHERE id = ?`, active, user.id);
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (name.length < 2 || name.length > 60) {
        throw new ApiError(400, 'Name must be between 2 and 60 characters');
      }
      await dbRun(`UPDATE users SET name = ?, updated_at = ${nowFunc} WHERE id = ?`, name, user.id);
    }

    if (req.body.bio !== undefined) {
      const bio = String(req.body.bio || '').trim().slice(0, 500);
      await dbRun(`UPDATE users SET bio = ?, updated_at = ${nowFunc} WHERE id = ?`, bio, user.id);
    }

    const updated = await dbGet('SELECT * FROM users WHERE id = ?', user.id);
    return res.json({ user: { ...publicUser(updated), active: updated.active } });
  })
);

router.delete(
  '/users/:id',
  wrap(async (req, res) => {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    if (Number(req.params.id) === req.user.id) {
      throw new ApiError(400, 'You cannot delete your own account');
    }
    if (user.role === 'admin') {
      const admins = (await dbGet("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1")).c;
      if (admins <= 1) {
        throw new ApiError(400, 'At least one active administrator is required');
      }
    }
    await dbRun('DELETE FROM users WHERE id = ?', user.id);
    await trackActivity(req.user.id, 'user.deleted', 'user', user.id, { name: user.name });
    return res.json({ ok: true });
  })
);

router.get(
  '/comments',
  wrap(async (req, res) => {
    const { q } = req.query;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit || 20);
    const where = [];
    const params = {};
    if (q) {
      params.q = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      where.push(
        "(c.content LIKE :q ESCAPE '\\' OR u.name LIKE :q ESCAPE '\\' OR a.title LIKE :q ESCAPE '\\')"
      );
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (await dbGet(`SELECT COUNT(*) AS c FROM comments c ${whereSql}`, params)).c;
    const rows = await dbAll(
      `SELECT c.id, c.content, c.created_at, c.edited_at, c.article_id, c.user_id,
         u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar,
         a.title AS article_title
       FROM comments c
       JOIN users u ON u.id = c.user_id
       JOIN articles a ON a.id = c.article_id
       ${whereSql} ORDER BY c.created_at DESC LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset }
    );
    return res.json({ comments: rows, page, limit, total, total_pages: Math.ceil(total / limit) });
  })
);

router.delete(
  '/comments/:id',
  wrap(async (req, res) => {
    const row = await dbGet('SELECT * FROM comments WHERE id = ?', req.params.id);
    if (!row) throw new ApiError(404, 'Comment not found');
    await dbRun('DELETE FROM comments WHERE id = ?', row.id);
    await dbRun(
      'UPDATE articles SET comments_count = (SELECT COUNT(*) FROM comments WHERE article_id = ?) WHERE id = ?',
      row.article_id, row.article_id
    );
    await trackActivity(req.user.id, 'comment.deleted', 'comment', row.id, { article_id: row.article_id });
    return res.json({ ok: true });
  })
);

router.get(
  '/reactions',
  wrap(async (req, res) => {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit || 20);
    const total = (await dbGet('SELECT COUNT(*) AS c FROM reactions')).c;
    const rows = await dbAll(
      `SELECT r.id, r.type, r.created_at, r.article_id, r.user_id,
         u.name AS user_name, u.email AS user_email,
         a.title AS article_title
       FROM reactions r
       JOIN users u ON u.id = r.user_id
       JOIN articles a ON a.id = r.article_id
       ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      limit, offset
    );
    const by_type = await dbAll('SELECT type, COUNT(*) AS c FROM reactions GROUP BY type');
    const per_article = await dbAll(
      `SELECT r.article_id, a.title AS article_title, a.status,
         r.type, COUNT(*) AS c
       FROM reactions r JOIN articles a ON a.id = r.article_id
       GROUP BY r.article_id, r.type ORDER BY r.article_id DESC`
    );
    const agg = new Map();
    for (const row of per_article) {
      if (!agg.has(row.article_id)) {
        agg.set(row.article_id, {
          article_id: row.article_id,
          article_title: row.article_title,
          status: row.status,
          types: {},
          total: 0,
        });
      }
      const entry = agg.get(row.article_id);
      entry.types[row.type] = row.c;
      entry.total += row.c;
    }
    const articles_summary = Array.from(agg.values())
      .sort((x, y) => y.total - x.total)
      .slice(0, 20);
    return res.json({
      reactions: rows,
      by_type,
      articles_summary,
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    });
  })
);

router.get(
  '/settings',
  wrap(async (_req, res) => {
    const defaults = {
      site_name: 'Readify',
      site_tagline: 'Read, write, and share great stories.',
      allow_registration: '1',
      articles_per_page: '12',
      require_review_before_publish: '1',
    };
    const settings = {};
    for (const [k, d] of Object.entries(defaults)) {
      settings[k] = await getSetting(k, d);
    }
    return res.json({ settings });
  })
);

router.put(
  '/settings',
  wrap(async (req, res) => {
    const allowed = [
      'site_name',
      'site_tagline',
      'allow_registration',
      'articles_per_page',
      'require_review_before_publish',
    ];
    const settings = req.body.settings || {};
    const changed = [];
    for (const key of allowed) {
      if (settings[key] !== undefined) {
        await setSetting(key, String(settings[key]));
        changed.push(key);
      }
    }
    if (changed.length) {
      await trackActivity(req.user.id, 'settings.updated', 'settings', null, { keys: changed });
    }
    const out = {};
    for (const key of allowed) out[key] = await getSetting(key);
    return res.json({ settings: out });
  })
);

router.get(
  '/domains',
  wrap(async (_req, res) => {
    const rows = await dbAll('SELECT * FROM domains ORDER BY host');
    return res.json({ domains: rows });
  })
);

router.post(
  '/domains',
  wrap(async (req, res) => {
    const host = String(req.body.host || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    const label = String(req.body.label || '').trim().slice(0, 80) || null;
    if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
      throw new ApiError(400, 'A valid domain is required (e.g. admin.readify-domain-1.com)');
    }
    await dbRun(
      'INSERT INTO domains (host, label) VALUES (?, ?) ON CONFLICT(host) DO UPDATE SET is_active = 1, label = excluded.label',
      host, label
    );
    const row = await dbGet('SELECT * FROM domains WHERE host = ?', host);
    return res.status(201).json({ domain: row });
  })
);

router.patch(
  '/domains/:id',
  wrap(async (req, res) => {
    const domain = await dbGet('SELECT * FROM domains WHERE id = ?', req.params.id);
    if (!domain) throw new ApiError(404, 'Domain not found');
    const updates = [];
    const params = { id: domain.id };
    if (req.body.label !== undefined) {
      updates.push('label = :label');
      params.label = String(req.body.label).slice(0, 80) || null;
    }
    if (req.body.is_active !== undefined) {
      updates.push('is_active = :is_active');
      params.is_active = req.body.is_active ? 1 : 0;
    }
    if (updates.length) {
      await dbRun(`UPDATE domains SET ${updates.join(', ')} WHERE id = :id`, params);
    }
    return res.json({ domain: await dbGet('SELECT * FROM domains WHERE id = ?', domain.id) });
  })
);

router.delete(
  '/domains/:id',
  wrap(async (req, res) => {
    const domain = await dbGet('SELECT * FROM domains WHERE id = ?', req.params.id);
    if (!domain) throw new ApiError(404, 'Domain not found');
    await dbRun('DELETE FROM domains WHERE id = ?', domain.id);
    return res.json({ ok: true });
  })
);

router.get(
  '/categories',
  wrap(async (_req, res) => {
    const rows = await dbAll(
      `SELECT c.id, c.name, c.slug, c.created_at,
        (SELECT COUNT(*) FROM articles a WHERE a.category_id = c.id) AS article_count,
        (SELECT COUNT(*) FROM articles a WHERE a.category_id = c.id AND a.status = 'published') AS published_count
       FROM categories c ORDER BY c.name`
    );
    return res.json({ categories: rows });
  })
);

router.post(
  '/categories',
  wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 60) {
      throw new ApiError(400, 'Category name must be between 2 and 60 characters');
    }
    const slug = slugify(name);
    if (!slug) throw new ApiError(400, 'Category name must include at least one letter or number');
    const existing = await dbGet('SELECT id FROM categories WHERE slug = ? OR name = ?', slug, name);
    if (existing) throw new ApiError(409, 'A category with that name already exists');
    const info = await dbRun('INSERT INTO categories (name, slug) VALUES (?, ?)', name, slug);
    await trackActivity(req.user.id, 'category.created', 'category', Number(info.lastInsertRowid), { name });
    const category = await dbGet('SELECT * FROM categories WHERE id = ?', info.lastInsertRowid);
    return res.status(201).json({ category });
  })
);

router.patch(
  '/categories/:id',
  wrap(async (req, res) => {
    const category = await dbGet('SELECT * FROM categories WHERE id = ?', req.params.id);
    if (!category) throw new ApiError(404, 'Category not found');
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 60) {
      throw new ApiError(400, 'Category name must be between 2 and 60 characters');
    }
    const slug = slugify(name);
    const clash = await dbGet('SELECT id FROM categories WHERE (slug = ? OR name = ?) AND id != ?', slug, name, category.id);
    if (clash) throw new ApiError(409, 'A category with that name already exists');
    await dbRun('UPDATE categories SET name = ?, slug = ? WHERE id = ?', name, slug, category.id);
    await trackActivity(req.user.id, 'category.updated', 'category', category.id, { name });
    const updated = await dbGet('SELECT * FROM categories WHERE id = ?', category.id);
    return res.json({ category: updated });
  })
);

router.delete(
  '/categories/:id',
  wrap(async (req, res) => {
    const category = await dbGet('SELECT * FROM categories WHERE id = ?', req.params.id);
    if (!category) throw new ApiError(404, 'Category not found');
    const usage = (await dbGet('SELECT COUNT(*) AS c FROM articles WHERE category_id = ?', category.id)).c;
    if (usage > 0) {
      const reassignTo = Number(req.body.reassign_to || req.query.reassign_to || 0);
      if (!reassignTo || reassignTo === category.id) {
        throw new ApiError(
          400,
          `Category is used by ${usage} article(s). Choose a replacement category to reassign them first.`
        );
      }
      const target = await dbGet('SELECT id FROM categories WHERE id = ?', reassignTo);
      if (!target) throw new ApiError(400, 'Replacement category does not exist');
      await dbRun('UPDATE articles SET category_id = ? WHERE category_id = ?', reassignTo, category.id);
    }
    await dbRun('DELETE FROM categories WHERE id = ?', category.id);
    await trackActivity(req.user.id, 'category.deleted', 'category', category.id, { name: category.name });
    return res.json({ ok: true });
  })
);

router.get(
  '/tags',
  wrap(async (req, res) => {
    const { q } = req.query;
    const rows = q
      ? await dbAll(
          `SELECT t.id, t.name, t.slug, t.created_at,
            (SELECT COUNT(*) FROM article_tags at WHERE at.tag_id = t.id) AS article_count
           FROM tags t WHERE t.name LIKE ? ORDER BY t.name LIMIT 100`,
          `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`
        )
      : await dbAll(
          `SELECT t.id, t.name, t.slug, t.created_at,
            (SELECT COUNT(*) FROM article_tags at WHERE at.tag_id = t.id) AS article_count
           FROM tags t ORDER BY article_count DESC, t.name LIMIT 200`
        );
    return res.json({ tags: rows });
  })
);

router.post(
  '/tags',
  wrap(async (req, res) => {
    const name = String(req.body.name || '').trim().replace(/^#/, '').slice(0, 40);
    if (!name) throw new ApiError(400, 'A tag name is required');
    const slug = slugify(name);
    if (!slug) throw new ApiError(400, 'Tag name must include at least one letter or number');
    const existing = await dbGet('SELECT id FROM tags WHERE slug = ? OR name = ?', slug, name);
    if (existing) throw new ApiError(409, 'A tag with that name already exists');
    const info = await dbRun('INSERT INTO tags (name, slug) VALUES (?, ?)', name, slug);
    await trackActivity(req.user.id, 'tag.created', 'tag', Number(info.lastInsertRowid), { name });
    const tag = await dbGet('SELECT * FROM tags WHERE id = ?', info.lastInsertRowid);
    return res.status(201).json({ tag });
  })
);

router.patch(
  '/tags/:id',
  wrap(async (req, res) => {
    const tag = await dbGet('SELECT * FROM tags WHERE id = ?', req.params.id);
    if (!tag) throw new ApiError(404, 'Tag not found');
    const name = String(req.body.name || '').trim().replace(/^#/, '').slice(0, 40);
    if (!name) throw new ApiError(400, 'A tag name is required');
    const slug = slugify(name);
    const clash = await dbGet('SELECT id FROM tags WHERE (slug = ? OR name = ?) AND id != ?', slug, name, tag.id);
    if (clash) throw new ApiError(409, 'A tag with that name already exists');
    await dbRun('UPDATE tags SET name = ?, slug = ? WHERE id = ?', name, slug, tag.id);
    await trackActivity(req.user.id, 'tag.updated', 'tag', tag.id, { name });
    const updated = await dbGet('SELECT * FROM tags WHERE id = ?', tag.id);
    return res.json({ tag: updated });
  })
);

router.delete(
  '/tags/:id',
  wrap(async (req, res) => {
    const tag = await dbGet('SELECT * FROM tags WHERE id = ?', req.params.id);
    if (!tag) throw new ApiError(404, 'Tag not found');
    await dbRun('DELETE FROM article_tags WHERE tag_id = ?', tag.id);
    await dbRun('DELETE FROM tags WHERE id = ?', tag.id);
    await trackActivity(req.user.id, 'tag.deleted', 'tag', tag.id, { name: tag.name });
    return res.json({ ok: true });
  })
);

router.get(
  '/featured',
  wrap(async (req, res) => {
    const rows = await dbAll(
      `SELECT * FROM articles WHERE status = 'published' AND featured = 1
       ORDER BY published_at DESC LIMIT 30`
    );
    const articles = await Promise.all(rows.map((a) => serializeArticle(a, req.user)));
    return res.json({ articles });
  })
);

router.post(
  '/articles/:id/featured',
  wrap(async (req, res) => {
    const article = await dbGet('SELECT * FROM articles WHERE id = ?', req.params.id);
    if (!article) throw new ApiError(404, 'Article not found');
    if (article.status !== 'published') {
      throw new ApiError(400, 'Only published articles can be featured');
    }
    const featured = req.body.featured ? 1 : 0;
    const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";
    const featuredAtCase = USE_SUPABASE 
      ? `CASE WHEN $1 = 1 THEN NOW() ELSE featured_at END`
      : `CASE WHEN ? = 1 THEN datetime('now') ELSE featured_at END`;
    await dbRun(
      `UPDATE articles SET featured = ?, updated_at = ${nowFunc},
        featured_at = ${featuredAtCase}
       WHERE id = ?`,
      featured, featured, article.id
    );
    await trackActivity(req.user.id, featured ? 'article.featured' : 'article.unfeatured', 'article', article.id);
    const updated = await dbGet('SELECT * FROM articles WHERE id = ?', article.id);
    const serializedArticle = await serializeArticle(updated, req.user);
    return res.json({ article: serializedArticle });
  })
);

router.get(
  '/analytics',
  wrap(async (_req, res) => {
    const total_views = (await dbGet('SELECT COUNT(*) AS c FROM article_views')).c;
    const total_users = (await dbGet('SELECT COUNT(*) AS c FROM users')).c;
    const total_articles = (await dbGet('SELECT COUNT(*) AS c FROM articles')).c;
    const published = (await dbGet("SELECT COUNT(*) AS c FROM articles WHERE status = 'published'")).c;
    const featured = (await dbGet("SELECT COUNT(*) AS c FROM articles WHERE status = 'published' AND featured = 1")).c;
    const total_comments = (await dbGet('SELECT COUNT(*) AS c FROM comments')).c;
    const total_reactions = (await dbGet('SELECT COUNT(*) AS c FROM reactions')).c;
    const total_bookmarks = (await dbGet('SELECT COUNT(*) AS c FROM bookmarks')).c;
    
    const dateFunc = USE_SUPABASE ? "NOW() - INTERVAL '30 days'" : "datetime('now', '-30 days')";
    const new_users_30d = (await dbGet(`SELECT COUNT(*) AS c FROM users WHERE created_at >= ${dateFunc}`)).c;
    const new_articles_30d = (await dbGet(`SELECT COUNT(*) AS c FROM articles WHERE created_at >= ${dateFunc}`)).c;
    const new_views_30d = (await dbGet(`SELECT COUNT(*) AS c FROM article_views WHERE created_at >= ${dateFunc}`)).c;

    const status_breakdown = (await dbAll('SELECT status, COUNT(*) AS c FROM articles GROUP BY status'))
      .reduce((acc, r) => ({ ...acc, [r.status]: r.c }), {});

    const most_viewed = await dbAll(
      `SELECT id, title, author, status, views_count, reactions_count, comments_count,
         published_at, featured
       FROM articles WHERE status = 'published' ORDER BY views_count DESC LIMIT 8`
    );

    const most_reacted = await dbAll(
      `SELECT id, title, author, status, views_count, reactions_count, comments_count,
         published_at, featured
       FROM articles WHERE status = 'published' ORDER BY reactions_count DESC LIMIT 8`
    );

    const most_commented = await dbAll(
      `SELECT id, title, author, status, views_count, reactions_count, comments_count,
         published_at, featured
       FROM articles WHERE status = 'published' ORDER BY comments_count DESC LIMIT 8`
    );

    const active_authors = (await dbAll(
      `SELECT u.id, u.name, u.email, u.avatar,
         (SELECT COUNT(*) FROM articles a WHERE a.user_id = u.id AND a.status = 'published') AS published_articles,
         (SELECT COUNT(*) FROM articles a WHERE a.user_id = u.id) AS total_articles,
         (SELECT SUM(a.views_count) FROM articles a WHERE a.user_id = u.id) AS total_views
       FROM users u
       ORDER BY published_articles DESC, total_views DESC LIMIT 8`
    )).map((a) => ({ ...a, total_views: a.total_views || 0 }));

    const published_over_time = USE_SUPABASE
      ? (await dbAll(
          `SELECT TO_CHAR(published_at, 'YYYY-MM') AS period, COUNT(*) AS c
           FROM articles WHERE status = 'published' AND published_at IS NOT NULL
           GROUP BY period ORDER BY period DESC LIMIT 8`
        )).reverse()
      : (await dbAll(
          `SELECT strftime('%Y-%m', published_at) AS period, COUNT(*) AS c
           FROM articles WHERE status = 'published' AND published_at IS NOT NULL
           GROUP BY period ORDER BY period DESC LIMIT 8`
        )).reverse();

    const views_over_time = USE_SUPABASE
      ? await dbAll(
          `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS c
           FROM article_views WHERE created_at >= NOW() - INTERVAL '13 days'
           GROUP BY day ORDER BY day`
        )
      : await dbAll(
          `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS c
           FROM article_views WHERE created_at >= datetime('now', '-13 days')
           GROUP BY day ORDER BY day`
        );

    const reactions_by_type = await dbAll('SELECT type, COUNT(*) AS c FROM reactions GROUP BY type');

    return res.json({
      totals: {
        total_views,
        total_users,
        total_articles,
        published,
        featured,
        total_comments,
        total_reactions,
        total_bookmarks,
        new_users_30d,
        new_articles_30d,
        new_views_30d,
      },
      status_breakdown,
      reactions_by_type,
      most_viewed,
      most_reacted,
      most_commented,
      active_authors,
      published_over_time,
      views_over_time,
    });
  })
);

router.get(
  '/activities',
  wrap(async (req, res) => {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 25);
    const rows = await dbAll(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.meta, a.created_at,
         u.name AS user_name, u.avatar AS user_avatar
       FROM activities a JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC LIMIT ?`,
      limit
    );
    return res.json({ activities: rows });
  })
);

export default router;
