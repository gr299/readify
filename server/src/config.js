import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT_DIR, '..', 'data');
export const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'readify.db');
export const JWT_SECRET_FILE = path.join(DATA_DIR, '.jwt-secret');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const PORT = Number(process.env.PORT) || 4000;
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
export const DB_URL = process.env.DATABASE_URL || '';
export const USE_SUPABASE =
  process.env.USE_SUPABASE === 'true' ||
  (process.env.USE_SUPABASE !== 'false' && Boolean(process.env.DATABASE_URL));

export function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) {
    return process.env.JWT_SECRET.trim();
  }
  try {
    if (fs.existsSync(JWT_SECRET_FILE)) {
      return fs.readFileSync(JWT_SECRET_FILE, 'utf8').trim();
    }
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(JWT_SECRET_FILE, secret, { mode: 0o600 });
    return secret;
  } catch {
    return crypto.randomBytes(48).toString('hex');
  }
}

export const JWT_SECRET = getJwtSecret();
export const JWT_EXPIRES_IN = '7d';
export const COOKIE_NAME = 'readify_token';

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
]);

export const ARTICLE_STATUSES = ['draft', 'pending', 'published', 'rejected', 'archived'];

// Hosts that are always permitted to reach the Admin Portal during development
// and in the sandbox preview environment. Production domains must be listed in
// the `domains` table by an administrator.
export function isDevelopmentHost(hostname) {
  const host = (hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  if (host.endsWith('.monkeycode-ai.live')) return true;
  if (host.endsWith('.monkeycode-ai.online')) return true;
  try {
    const clientHost = new URL(CLIENT_ORIGIN).hostname.toLowerCase().replace(/^www\./, '');
    if (host === clientHost) return true;
  } catch {}
  return false;
}
