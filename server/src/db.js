import Database from 'better-sqlite3';
import { DB_PATH, USE_SUPABASE } from './config.js';
import { db as supabaseDb, ftsEnabled as supabaseFtsEnabled, getSetting as supabaseGetSetting, setSetting as supabaseSetSetting } from './db-supabase.js';

export let db, ftsEnabled;
export { USE_SUPABASE };

if (USE_SUPABASE) {
  db = supabaseDb;
  ftsEnabled = supabaseFtsEnabled;
} else {
  const sqliteDb = new Database(DB_PATH);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  db = sqliteDb;

  sqliteDb.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  avatar        TEXT,
  bio           TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  author           TEXT,
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  summary          TEXT,
  content          TEXT NOT NULL DEFAULT '',
  cover_image      TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','pending','published','rejected','archived')),
  rejection_reason TEXT,
  views_count      INTEGER NOT NULL DEFAULT 0,
  reactions_count  INTEGER NOT NULL DEFAULT 0,
  comments_count   INTEGER NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at     DATETIME
);

CREATE INDEX IF NOT EXISTS idx_articles_status     ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_user       ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_category   ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_published  ON articles(published_at) WHERE status = 'published';
`);

  const articleCols = sqliteDb.prepare(`PRAGMA table_info(articles)`).all().map((c) => c.name);
  if (!articleCols.includes('featured')) {
    sqliteDb.exec(`ALTER TABLE articles ADD COLUMN featured INTEGER NOT NULL DEFAULT 0`);
  }
  if (!articleCols.includes('featured_at')) {
    sqliteDb.exec(`ALTER TABLE articles ADD COLUMN featured_at DATETIME`);
  }
  sqliteDb.exec(`CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(featured) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_article_tags_article ON article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag_id);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  edited_at   DATETIME,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

CREATE TABLE IF NOT EXISTS reactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (article_id, user_id, type)
);
CREATE INDEX IF NOT EXISTS idx_reactions_article ON reactions(article_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_user_article ON reactions(article_id, user_id);

CREATE TABLE IF NOT EXISTS bookmarks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (article_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_article ON bookmarks(article_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);

CREATE TABLE IF NOT EXISTS article_views (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_hash    TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_article_views_article ON article_views(article_id);
CREATE INDEX IF NOT EXISTS idx_article_views_user ON article_views(user_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  host      TEXT NOT NULL UNIQUE,
  label     TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INTEGER,
  meta        TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);`);

  const userCols = sqliteDb.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
  for (const col of ['website', 'github', 'twitter', 'google', 'linkedin']) {
    if (!userCols.includes(col)) {
      sqliteDb.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
    }
  }

  for (const [col, decl] of [
    ['pending_email', 'TEXT'],
    ['email_verify_token', 'TEXT'],
    ['email_verify_expires', 'DATETIME'],
    ['token_version', 'INTEGER NOT NULL DEFAULT 0'],
  ]) {
    if (!userCols.includes(col)) {
      sqliteDb.exec(`ALTER TABLE users ADD COLUMN ${col} ${decl}`);
    }
  }

  const commentCols = sqliteDb.prepare(`PRAGMA table_info(comments)`).all().map((c) => c.name);
  if (!commentCols.includes('edited_at')) {
    sqliteDb.exec(`ALTER TABLE comments ADD COLUMN edited_at DATETIME`);
  }

  const domainCols = sqliteDb.prepare(`PRAGMA table_info(domains)`).all().map((c) => c.name);
  if (!domainCols.includes('is_active')) {
    sqliteDb.exec(`ALTER TABLE domains ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`);
  }

  sqliteDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_user_article ON reactions(article_id, user_id)`);

  sqliteDb.exec(`
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

  ftsEnabled = false;
  try {
    sqliteDb.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
         title, summary, content, author,
         content='articles',
         tokenize='unicode61'
       );`
    );
    ftsEnabled = true;
  } catch (err) {
    console.warn('[readify] FTS5 unavailable, article search will use LIKE: ' + err.message);
  }

  if (ftsEnabled) {
    const hasTriggers =
      sqliteDb
        .prepare(`SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'articles_fts_%'`)
        .get().c > 0;
    if (!hasTriggers) {
      sqliteDb.exec(`
        CREATE TRIGGER articles_fts_ai AFTER INSERT ON articles BEGIN
          INSERT INTO articles_fts(rowid, title, summary, content, author)
          VALUES (new.id, new.title, new.summary, new.content, new.author);
        END;
        CREATE TRIGGER articles_fts_ad AFTER DELETE ON articles BEGIN
          INSERT INTO articles_fts(articles_fts, rowid, title, summary, content, author)
          VALUES ('delete', old.id, old.title, old.summary, old.content, old.author);
        END;
        CREATE TRIGGER articles_fts_au AFTER UPDATE ON articles BEGIN
          INSERT INTO articles_fts(articles_fts, rowid, title, summary, content, author)
          VALUES ('delete', old.id, old.title, old.summary, old.content, old.author);
          INSERT INTO articles_fts(rowid, title, summary, content, author)
          VALUES (new.id, new.title, new.summary, new.content, new.author);
        END;
      `);
      sqliteDb.exec(
        `INSERT INTO articles_fts(rowid, title, summary, content, author)
         SELECT id, title, summary, content, author FROM articles;`
      );
    }
  }
}

export async function getSetting(key, fallback = null) {
  if (USE_SUPABASE) {
    return await supabaseGetSetting(key, fallback);
  }
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  if (USE_SUPABASE) {
    await supabaseSetSetting(key, value);
  } else {
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, String(value));
  }
}
