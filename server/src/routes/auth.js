import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, USE_SUPABASE } from '../db.js';
import { COOKIE_NAME } from '../config.js';
import { ApiError, avatarDataUri, publicUser, wrap, trackActivity } from '../utils.js';
import { attachUser, signToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate, schemas } from '../validation.js';

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

const isProduction = process.env.NODE_ENV === 'production' || USE_SUPABASE;

function setAuthCookie(res, user) {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

router.post(
  '/register',
  authLimiter,
  validate(schemas.register),
  wrap(async (req, res) => {
    const { name, email, password } = req.body;

    const existing = await dbGet('SELECT id FROM users WHERE email = ?', email);
    if (existing) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userCount = (await dbGet('SELECT COUNT(*) AS c FROM users')).c;
    // First account on a fresh install becomes the administrator.
    const role = userCount === 0 ? 'admin' : 'user';
    const info = await dbRun(
      'INSERT INTO users (name, email, password_hash, role, avatar) VALUES (?, ?, ?, ?, ?)',
      name, email, passwordHash, role, avatarDataUri(name)
    );

    const user = await dbGet('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
    await trackActivity(user.id, 'account.created', 'user', user.id);
    setAuthCookie(res, user);
    return res.status(201).json({ user: publicUser(user) });
  })
);

router.post(
  '/login',
  authLimiter,
  validate(schemas.login),
  wrap(async (req, res) => {
    const { email, password } = req.body;

    const user = await dbGet('SELECT * FROM users WHERE email = ? AND active = 1', email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new ApiError(401, 'Invalid email or password');
    }

    await trackActivity(user.id, 'auth.login', 'user', user.id);
    setAuthCookie(res, user);
    return res.json({ user: publicUser(user) });
  })
);

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
  });
  return res.json({ ok: true });
});

router.get(
  '/me',
  attachUser,
  wrap((req, res) => {
    if (!req.user) {
      return res.json({ user: null });
    }
    return res.json({ user: publicUser(req.user) });
  })
);

export default router;
