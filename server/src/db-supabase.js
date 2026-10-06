import postgres from 'postgres';
import { DB_URL, USE_SUPABASE } from './config.js';

// Ensure BigInts are correctly serialized to JSON across Express endpoints
BigInt.prototype.toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};

const sql = DB_URL
  ? postgres(DB_URL, {
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connection: {
        application_name: 'readify-api',
      },
      max: 10, // Maximum number of connections
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
      onnotice: (notice) => console.log('[postgres] notice:', notice.message),
      types: {
        bigint: {
          to: 20,
          from: [20],
          parse: (x) => {
            const n = Number(x);
            return Number.isSafeInteger(n) ? n : x;
          },
          serialize: (x) => x.toString(),
        },
      },
    })
  : null;

// Only test connection on startup if Supabase is enabled and DB_URL is set
if (USE_SUPABASE && sql) {
  sql`SELECT 1`
    .then(() => {
      console.log('[postgres] Database connection successful');
    })
    .catch((err) => {
      console.error('[postgres] Database connection failed:', err.message);
    });
}

export function normalizeQueryAndParams(query, params = []) {
  let statement = query;
  let values = params;

  // Unwrap single array parameter if passed as stmt.all([1, 2])
  if (values.length === 1 && Array.isArray(values[0])) {
    values = values[0];
  }

  // Handle named parameters object: stmt.all({ q: 'test', limit: 10 })
  if (
    values.length === 1 &&
    typeof values[0] === 'object' &&
    values[0] !== null &&
    !Array.isArray(values[0]) &&
    !(values[0] instanceof Date) &&
    !(values[0] instanceof Buffer)
  ) {
    const paramObj = values[0];
    const keyToIndex = new Map();
    const ordered = [];
    statement = statement.replace(/(?<!:):([a-zA-Z0-9_]+)|@([a-zA-Z0-9_]+)/g, (_match, p1, p2) => {
      const key = p1 || p2;
      if (!keyToIndex.has(key)) {
        ordered.push(paramObj[key] !== undefined ? paramObj[key] : null);
        keyToIndex.set(key, ordered.length);
      }
      return `$${keyToIndex.get(key)}`;
    });
    values = ordered;
  } else {
    // Positional ? parameters
    let idx = 0;
    statement = statement.replace(/\?/g, () => `$${++idx}`);
  }

  // Convert SQLite INSERT OR IGNORE INTO to PostgreSQL ON CONFLICT DO NOTHING
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(statement)) {
    statement = statement.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO').replace(/;\s*$/, '');
    if (!/\bON\s+CONFLICT\b/i.test(statement)) {
      statement += ' ON CONFLICT DO NOTHING';
    }
  }

  // SQLite date helper conversions
  statement = statement.replace(/datetime\('now',\s*'-?(\d+)\s+days?'\)/gi, "NOW() - INTERVAL '$1 days'");
  statement = statement.replace(/datetime\('now'\)/gi, 'NOW()');

  return { statement, values };
}

export function normalizeQuery(query) {
  return normalizeQueryAndParams(query, []).statement;
}

export const db = {
  prepare: (query) => ({
    get: async (...params) => {
      if (!sql) throw new Error('Database connection is not initialized');
      const { statement, values } = normalizeQueryAndParams(query, params);
      const rows = await sql.unsafe(statement, values);
      return rows[0];
    },
    all: async (...params) => {
      if (!sql) throw new Error('Database connection is not initialized');
      const { statement, values } = normalizeQueryAndParams(query, params);
      return await sql.unsafe(statement, values);
    },
    run: async (...params) => {
      if (!sql) throw new Error('Database connection is not initialized');
      let { statement, values } = normalizeQueryAndParams(query, params);
      if (/^\s*INSERT\b/i.test(statement) && !/\bRETURNING\b/i.test(statement)) {
        statement = `${statement.replace(/;\s*$/, '')} RETURNING *`;
      }
      const rows = await sql.unsafe(statement, values);
      return { lastInsertRowid: rows[0]?.id };
    },
  }),
  exec: async (query) => {
    if (!sql) throw new Error('Database connection is not initialized');
    const { statement, values } = normalizeQueryAndParams(query, []);
    return await sql.unsafe(statement, values);
  },
  pragma: () => {}, // No-op for PostgreSQL
};

export async function getSetting(key, fallback = null) {
  if (!sql) return fallback;
  const result = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return result[0] ? result[0].value : fallback;
}

export async function setSetting(key, value) {
  if (!sql) return;
  await sql`INSERT INTO settings (key, value) VALUES (${key}, ${String(value)}) ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
}

export const ftsEnabled = true; // PostgreSQL has full-text search
