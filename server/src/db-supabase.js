import postgres from 'postgres';
import { DB_URL } from './config.js';

const sql = postgres(DB_URL, {
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const db = {
  prepare: (query) => ({
    get: async (...params) => {
      const rows = await sql.unsafe(query, params);
      return rows[0];
    },
    all: async (...params) => {
      return await sql.unsafe(query, params);
    },
    run: async (...params) => {
      const rows = await sql.unsafe(query, params);
      return { lastInsertRowid: rows[0]?.id };
    },
  }),
  exec: async (query) => await sql.unsafe(query),
  pragma: () => {}, // No-op for PostgreSQL
};

export async function getSetting(key, fallback = null) {
  const result = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return result[0] ? result[0].value : fallback;
}

export async function setSetting(key, value) {
  await sql`INSERT INTO settings (key, value) VALUES (${key}, ${String(value)}) ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
}

export const ftsEnabled = true; // PostgreSQL has full-text search
