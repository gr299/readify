import jwt from 'jsonwebtoken';
import { db, USE_SUPABASE } from '../db.js';
import { JWT_SECRET, COOKIE_NAME, isDevelopmentHost } from '../config.js';
import { ApiError } from '../utils.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, v: user.token_version ?? 0 }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

// Helper to handle both sync (SQLite) and async (Supabase) database calls
async function dbGet(query, ...params) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(query);
    return await stmt.get(...params);
  }
  return db.prepare(query).get(...params);
}

export async function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await dbGet('SELECT * FROM users WHERE id = ? AND active = 1', payload.sub);
    if (!user || (payload.v ?? 0) !== (user.token_version ?? 0)) {
      req.user = null;
      return next();
    }
    req.user = user;
    req.token = token;
    return next();
  } catch {
    req.user = null;
    return next();
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  return next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }
  if (req.user.role !== 'admin') {
    return next(new ApiError(403, 'Admin access required'));
  }
  return next();
}

export function requireAdminDomain(req, _res, next) {
  const hostname = (req.hostname || '').toLowerCase().replace(/^www\./, '');

  if (isDevelopmentHost(hostname)) {
    return next();
  }

  const row = db.prepare('SELECT id FROM domains WHERE host = ? AND is_active = 1').get(hostname);
  if (!row) {
    return next(
      new ApiError(403, 'This domain is not authorized to access the Admin Portal')
    );
  }
  return next();
}
