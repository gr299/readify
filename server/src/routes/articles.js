import { Router } from 'express';
import { db, ftsEnabled, USE_SUPABASE } from '../db.js';
import { ApiError, sanitizeContent, readingTime, slugify, paginate, publicUser, wrap, trackActivity } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, schemas } from '../validation.js';

const router = Router();

const TRANSITIONS = {
  draft: new Set(['pending', 'published']),
  pending: new Set(['draft', 'published', 'rejected']),
  rejected: new Set(['draft', 'pending']),
  published: new Set(['archived']),
  archived: new Set(['published']),
};

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

async function getUserByArticle(article) {
  return await dbGet('SELECT * FROM users WHERE id = ?', article.user_id);
}

export async function serializeArticle(article, currentUser = null) {
  if (!article) return null;
  const user = await getUserByArticle(article);
  const category = article.category_id
    ? await dbGet('SELECT id, name, slug FROM categories WHERE id = ?', article.category_id)
    : null;
  const tags = await dbAll(
    `SELECT t.id, t.name, t.slug FROM tags t
     JOIN article_tags at ON at.tag_id = t.id
     WHERE at.article_id = ? ORDER BY t.name`,
    article.id
  );
  const reactionRows = await dbAll(
    'SELECT type, COUNT(*) AS c FROM reactions WHERE article_id = ? GROUP BY type',
    article.id
  );
  const reaction_counts = {};
  let total = 0;
  for (const r of reactionRows) {
    reaction_counts[r.type] = r.c;
    total += r.c;
  }

  let user_reaction = null;
  let bookmarked = false;
  if (currentUser) {
    const ur = await dbGet(
      'SELECT type FROM reactions WHERE article_id = ? AND user_id = ?',
      article.id, currentUser.id
    );
    user_reaction = ur ? ur.type : null;
    bookmarked = !!(await dbGet(
      'SELECT id FROM bookmarks WHERE article_id = ? AND user_id = ?',
      article.id, currentUser.id
    ));
  }

  const isOwner = currentUser ? currentUser.id === article.user_id : false;
  const isAdmin = currentUser ? currentUser.role === 'admin' : false;

  return {
    id: article.id,
    title: article.title,
    author: user ? publicUser(user) : { id: article.user_id, name: article.author || 'Unknown' },
    author_display: article.author || (user ? user.name : 'Unknown'),
    category,
    summary: article.summary,
    content: article.content,
    cover_image: article.cover_image,
    tags,
    status: article.status,
    featured: !!article.featured,
    rejection_reason: article.rejection_reason,
    views_count: article.views_count,
    reactions_count: total,
    reaction_counts,
    user_reaction,
    bookmarked,
    reading_time: readingTime(article.content),
    comments_count: article.comments_count,
    created_at: article.created_at,
    updated_at: article.updated_at,
    published_at: article.published_at,
    permissions: {
      can_edit: isAdmin || isOwner,
      can_delete: isAdmin || isOwner,
      can_submit: isOwner && (article.status === 'draft' || article.status === 'rejected'),
      can_publish: isAdmin,
      can_reject: isAdmin,
      can_archive: isAdmin,
    },
  };
}

async function getArticleOrFail(id) {
  const article = await dbGet('SELECT * FROM articles WHERE id = ?', id);
  if (!article) throw new ApiError(404, 'Article not found');
  return article;
}

function canViewArticle(article, currentUser) {
  if (article.status === 'published') return true;
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  return article.user_id === currentUser.id;
}

async function syncTagCounts(articleId) {
  await dbRun(
    'UPDATE articles SET reactions_count = (SELECT COUNT(*) FROM reactions WHERE article_id = ?) WHERE id = ?',
    articleId, articleId
  );
  await dbRun(
    'UPDATE articles SET comments_count = (SELECT COUNT(*) FROM comments WHERE article_id = ?) WHERE id = ?',
    articleId, articleId
  );
}

export async function setArticleTags(articleId, tagNames) {
  await dbRun('DELETE FROM article_tags WHERE article_id = ?', articleId);
  const tagIdInsert = db.prepare('INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)');
  const findTag = db.prepare('SELECT id FROM tags WHERE slug = ?');
  const link = db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)');

  const seen = new Set();
  for (const raw of tagNames || []) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().replace(/^#/, '').slice(0, 40);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    const slug = slugify(tag);
    if (!slug) continue;
    if (USE_SUPABASE) {
      await tagIdInsert.run(tag, slug);
    } else {
      tagIdInsert.run(tag, slug);
    }
    const row = USE_SUPABASE ? await findTag.get(slug) : findTag.get(slug);
    if (row) {
      if (USE_SUPABASE) {
        await link.run(articleId, row.id);
      } else {
        link.run(articleId, row.id);
      }
    }
  }
}

async function validateArticleBody(body, { partial = false } = {}) {
  const data = {};

  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length < 3 || title.length > 200) {
      throw new ApiError(400, 'Title must be between 3 and 200 characters');
    }
    data.title = title;
  } else if (!partial) {
    throw new ApiError(400, 'Title is required');
  }

  if (body.author !== undefined) {
    const author = typeof body.author === 'string' ? body.author.trim() : '';
    if (author && author.length > 120) throw new ApiError(400, 'Author name is too long');
    data.author = author || null;
  }

  if (body.category_id !== undefined && body.category_id !== null && body.category_id !== '') {
    const cid = Number(body.category_id);
    if (!(await dbGet('SELECT id FROM categories WHERE id = ?', cid))) {
      throw new ApiError(400, 'Unknown category');
    }
    data.category_id = cid;
  } else if (body.category_id !== undefined) {
    data.category_id = null;
  }

  if (body.summary !== undefined) {
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    if (summary.length > 500) throw new ApiError(400, 'Summary must be at most 500 characters');
    data.summary = summary || null;
  }

  if (body.content !== undefined) {
    if (typeof body.content !== 'string') throw new ApiError(400, 'Article content must be text');
    if (body.content.length > 500000) throw new ApiError(400, 'Article content is too large');
    data.content = sanitizeContent(body.content);
  } else if (!partial) {
    data.content = '';
  }

  if (body.cover_image !== undefined && body.cover_image !== null && body.cover_image !== '') {
    const url = String(body.cover_image).trim();
    if (!/^\/uploads\/.+$/.test(url) && !/^https?:\/\/.+$/.test(url)) {
      throw new ApiError(400, 'Cover image must be an uploaded image or an http(s) URL');
    }
    data.cover_image = url;
  } else if (body.cover_image !== undefined) {
    data.cover_image = null;
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw new ApiError(400, 'Tags must be an array');
    data.tags = body.tags.slice(0, 12).map((t) => String(t).slice(0, 40));
  }

  if (body.status !== undefined) {
    if (!['draft', 'pending', 'published', 'rejected', 'archived'].includes(body.status)) {
      throw new ApiError(400, 'Invalid status');
    }
    data.status = body.status;
  }

  return data;
}

// Builds an FTS5 MATCH expression from a user search term. Tokens are split on
// whitespace/punctuation, lowercased, and quoted so FTS operators and special
// characters in the input cannot break out of the query. Returns null when the
// term is empty or FTS is unavailable (callers fall back to LIKE).
function buildFtsMatch(term) {
  if (!ftsEnabled) return null;
  const tokens = String(term || '')
    .toLowerCase()
    .split(/[\s,;:.!?()"']+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"`).join(' AND ');
}

function buildListQuery({ q, category, tag, author, sort, featured, page, limit }) {
  const where = [];
  const params = {};

  where.push('a.status = :status');
  params.status = 'published';

  if (q) {
    const ftsMatch = buildFtsMatch(q);
    if (ftsMatch) {
      where.push('a.id IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH :fts)');
      params.fts = ftsMatch;
    } else {
      const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      where.push(
        `(a.title LIKE :q ESCAPE '\\' OR a.summary LIKE :q ESCAPE '\\'
          OR a.content LIKE :q ESCAPE '\\' OR a.author LIKE :q ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM categories c WHERE c.id = a.category_id AND c.name LIKE :q ESCAPE '\\')
          OR EXISTS (SELECT 1 FROM article_tags at JOIN tags t ON t.id = at.tag_id
                     WHERE at.article_id = a.id AND t.name LIKE :q ESCAPE '\\'))`
      );
      params.q = like;
    }
  }

  if (category) {
    where.push('EXISTS (SELECT 1 FROM categories c WHERE c.id = a.category_id AND c.slug = :category)');
    params.category = category;
  }

  if (tag) {
    where.push('EXISTS (SELECT 1 FROM article_tags at JOIN tags t ON t.id = at.tag_id WHERE at.article_id = a.id AND t.slug = :tag)');
    params.tag = tag;
  }

  if (author) {
    where.push('a.author = :author');
    params.author = author;
  }

  if (String(featured) === '1' || String(featured) === 'true') {
    where.push('a.featured = 1');
  }

  const orderBy =
    sort === 'most-viewed'
      ? 'a.views_count DESC'
      : sort === 'most-reacted'
      ? 'a.reactions_count DESC'
      : sort === 'oldest'
      ? 'a.published_at ASC'
      : 'a.published_at DESC';

  return { where: where.join(' AND '), params, orderBy };
}

router.get(
  '/',
  wrap(async (req, res) => {
    const { q, category, tag, author, sort, featured } = req.query;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { where, params, orderBy } = buildListQuery({ q, category, tag, author, sort, featured });

    const countRow = await dbGet(`SELECT COUNT(*) AS c FROM articles a WHERE ${where}`, params);
    const total = countRow.c;

    const rows = await dbAll(
      `SELECT a.* FROM articles a WHERE ${where}
       ORDER BY ${orderBy} LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset }
    );

    const articles = await Promise.all(rows.map((a) => serializeArticle(a, req.user)));
    return res.json({ articles, page, limit, total, total_pages: Math.ceil(total / limit) });
  })
);

router.get(
  '/feed',
  wrap(async (req, res) => {
    const rows = await dbAll(
      `SELECT * FROM articles WHERE status = 'published'
       ORDER BY published_at DESC LIMIT 8`
    );
    const articles = await Promise.all(rows.map((a) => serializeArticle(a, req.user)));
    return res.json({ articles });
  })
);

router.get(
  '/mine',
  requireAuth,
  wrap(async (req, res) => {
    const { status } = req.query;
    const { page, limit, offset } = paginate(req.query.page, 12);
    const where = ['user_id = :uid'];
    const params = { uid: req.user.id };
    if (status && status !== 'all') {
      where.push('status = :status');
      params.status = status;
    }
    const whereSql = where.join(' AND ');
    const total = (await dbGet(`SELECT COUNT(*) AS c FROM articles WHERE ${whereSql}`, params)).c;
    const rows = await dbAll(
      `SELECT * FROM articles WHERE ${whereSql}
       ORDER BY updated_at DESC LIMIT :limit OFFSET :offset`,
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
  '/following',
  requireAuth,
  wrap(async (req, res) => {
    const { page, limit, offset } = paginate(req.query.page, 12);
    const from = `FROM articles a
      JOIN follows f ON f.following_id = a.user_id
      JOIN users u ON u.id = a.user_id AND u.active = 1
      WHERE f.follower_id = ? AND a.status = 'published'`;
    const total = (await dbGet(`SELECT COUNT(*) AS c ${from}`, req.user.id)).c;
    const rows = await dbAll(
      `SELECT a.* ${from} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`,
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
  '/for-you',
  requireAuth,
  wrap(async (req, res) => {
    const has = (await dbGet('SELECT COUNT(*) AS c FROM user_interests WHERE user_id = ?', req.user.id)).c > 0;
    if (!has) return res.json({ articles: [], has_interests: false });
    const rows = await dbAll(
      `SELECT DISTINCT a.* FROM articles a
       JOIN article_tags at ON at.article_id = a.id
       JOIN user_interests ui ON ui.tag_id = at.tag_id
       JOIN users u ON u.id = a.user_id AND u.active = 1
       WHERE ui.user_id = ? AND a.status = 'published'
       ORDER BY a.published_at DESC LIMIT 6`,
      req.user.id
    );
    const articles = await Promise.all(rows.map((a) => serializeArticle(a, req.user)));
    return res.json({ articles, has_interests: true });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const article = await getArticleOrFail(req.params.id);
    if (!canViewArticle(article, req.user)) {
      throw new ApiError(404, 'Article not found');
    }

    if (article.status === 'published') {
      const ipHash =
        req.user && req.user.id
          ? null
          : (req.ip || 'unknown');
      const dateCheck = USE_SUPABASE ? "created_at > NOW() - INTERVAL '1 day'" : "created_at > datetime('now', '-1 day')";
      const existing = req.user
        ? await dbGet(
          `SELECT id FROM article_views
           WHERE article_id = ? AND user_id = ? AND ${dateCheck}`,
          article.id, req.user.id
        )
        : await dbGet(
          `SELECT id FROM article_views
           WHERE article_id = ? AND ip_hash = ? AND ${dateCheck}`,
          article.id, ipHash
        );
      if (!existing) {
        await dbRun(
          'INSERT INTO article_views (article_id, user_id, ip_hash) VALUES (?, ?, ?)',
          article.id, req.user ? req.user.id : null, req.user ? null : ipHash
        );
        await dbRun('UPDATE articles SET views_count = views_count + 1 WHERE id = ?', article.id);
        article.views_count += 1;
      }
    }

    const serializedArticle = await serializeArticle(article, req.user);
    return res.json({ article: serializedArticle });
  })
);

router.post(
  '/',
  requireAuth,
  validate(schemas.articleCreate),
  wrap(async (req, res) => {
    const data = await validateArticleBody(req.body);
    if (data.status === 'published' && req.user.role !== 'admin') {
      delete data.status;
    }
    const status = data.status === 'pending' ? 'pending' : 'draft';

    const info = await dbRun(
      `INSERT INTO articles (user_id, title, author, category_id, summary, content, cover_image, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user.id,
      data.title,
      data.author || req.user.name,
      data.category_id ?? null,
      data.summary ?? null,
      data.content ?? '',
      data.cover_image ?? null,
      status
    );
    const articleId = Number(info.lastInsertRowid);
    await setArticleTags(articleId, data.tags || []);
    const article = await getArticleOrFail(articleId);
    await trackActivity(req.user.id, 'article.created', 'article', articleId, { status });
    const serializedArticle = await serializeArticle(article, req.user);
    return res.status(201).json({ article: serializedArticle });
  })
);

router.put(
  '/:id',
  requireAuth,
  validate(schemas.articleUpdate),
  wrap(async (req, res) => {
    const article = await getArticleOrFail(req.params.id);
    const isAdmin = req.user.role === 'admin';
    const isOwner = article.user_id === req.user.id;

    if (!isAdmin && !isOwner) {
      throw new ApiError(403, 'You can only edit your own articles');
    }

    const data = await validateArticleBody(req.body, { partial: true });

    // Admin-only fields: featured flag and an explicit publication date.
    const adminData = {};
    if (isAdmin) {
      if (req.body.featured !== undefined) {
        adminData.featured = req.body.featured ? 1 : 0;
      }
      if (req.body.published_at !== undefined && req.body.published_at !== null && req.body.published_at !== '') {
        const ts = new Date(req.body.published_at).getTime();
        if (!Number.isFinite(ts)) throw new ApiError(400, 'Invalid publication date');
        adminData.published_at = new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
      } else if (req.body.published_at === null) {
        adminData.published_at =
          data.status === 'published' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
      }
    }

    const sets = [];
    const params = {};
    for (const key of ['title', 'author', 'summary', 'content', 'cover_image', 'category_id', 'status', 'rejection_reason']) {
      if (data[key] !== undefined) {
        sets.push(`${key} = :${key}`);
        params[key] = data[key] ?? null;
      }
    }
    for (const key of Object.keys(adminData)) {
      sets.push(`${key} = :${key}`);
      params[key] = adminData[key];
    }
    if (data.status === 'published' && !isAdmin) {
      throw new ApiError(403, 'Only administrators can publish articles');
    }
    const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";
    sets.push(`updated_at = ${nowFunc}`);
    if (data.status === 'published' && !article.published_at && adminData.published_at === undefined) {
      sets.push(`published_at = ${nowFunc}`);
    }
    params.id = article.id;

    await dbRun(`UPDATE articles SET ${sets.join(', ')} WHERE id = :id`, params);
    if (data.tags !== undefined) {
      await setArticleTags(article.id, data.tags);
    }

    const updated = await getArticleOrFail(article.id);
    await trackActivity(req.user.id, 'article.updated', 'article', article.id);
    const serializedArticle = await serializeArticle(updated, req.user);
    return res.json({ article: serializedArticle });
  })
);

router.patch(
  '/:id/status',
  requireAuth,
  validate(schemas.articleStatus),
  wrap(async (req, res) => {
    const article = await getArticleOrFail(req.params.id);
    const isAdmin = req.user.role === 'admin';
    const isOwner = article.user_id === req.user.id;
    if (!isAdmin && !isOwner) {
      throw new ApiError(403, 'Not allowed to change this article status');
    }

    const next = req.body.status;
    if (!TRANSITIONS[article.status] || !TRANSITIONS[article.status].has(next)) {
      throw new ApiError(
        400,
        `Cannot change status from "${article.status}" to "${next}"`
      );
    }

    const adminOnly = new Set(['published', 'rejected', 'archived']);
    if (adminOnly.has(next) && !isAdmin) {
      throw new ApiError(403, 'Only administrators can perform this status change');
    }

    let rejection_reason = article.rejection_reason;
    if (next === 'rejected') {
      rejection_reason =
        typeof req.body.rejection_reason === 'string'
          ? req.body.rejection_reason.trim().slice(0, 500) || null
          : null;
    } else if (next === 'pending') {
      rejection_reason = null;
    }

    const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";
    const publishedAtCase = USE_SUPABASE 
      ? `CASE WHEN $1 = 'published' AND published_at IS NULL THEN NOW() ELSE published_at END`
      : `CASE WHEN ? = 'published' AND published_at IS NULL THEN datetime('now') ELSE published_at END`;
    
    await dbRun(
      `UPDATE articles SET status = ?, rejection_reason = ?, updated_at = ${nowFunc},
        published_at = ${publishedAtCase}
       WHERE id = ?`,
      next, rejection_reason, next, article.id
    );

    await trackActivity(req.user.id, `article.${next}`, 'article', article.id);
    const updated = await getArticleOrFail(article.id);
    const serializedArticle = await serializeArticle(updated, req.user);
    return res.json({ article: serializedArticle });
  })
);

router.delete(
  '/:id',
  requireAuth,
  wrap(async (req, res) => {
    const article = await getArticleOrFail(req.params.id);
    const isAdmin = req.user.role === 'admin';
    const isOwner = article.user_id === req.user.id;

    if (!isAdmin && !isOwner) {
      throw new ApiError(403, 'You can only delete your own articles');
    }

    await dbRun('DELETE FROM articles WHERE id = ?', article.id);
    await trackActivity(req.user.id, 'article.deleted', 'article', article.id, { title: article.title });
    return res.json({ ok: true });
  })
);

export { syncTagCounts };
export default router;
