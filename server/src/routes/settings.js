import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, USE_SUPABASE } from '../db.js';
import { CLIENT_ORIGIN, COOKIE_NAME } from '../config.js';
import { ApiError, wrap, trackActivity } from '../utils.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { settingsLimiter } from '../middleware/rateLimit.js';
import { validate, schemas } from '../validation.js';
import { sendVerificationLink } from '../mailer.js';

const router = Router();
router.use(settingsLimiter);

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
  '/password',
  requireAuth,
  validate(schemas.passwordChange),
  wrap(async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!(await bcrypt.compare(current_password, req.user.password_hash))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    if (new_password === current_password) {
      throw new ApiError(400, 'New password must be different');
    }
    const passwordHash = await bcrypt.hash(new_password, 12);
    const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";
    await dbRun(
      `UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ${nowFunc} WHERE id = ?`,
      passwordHash, req.user.id
    );
    const user = await dbGet('SELECT * FROM users WHERE id = ?', req.user.id);
    await trackActivity(req.user.id, 'account.password_changed', 'user', user.id);
    setAuthCookie(res, user);
    return res.json({ message: 'Password updated' });
  })
);

router.post(
  '/email',
  requireAuth,
  validate(schemas.emailChange),
  wrap(async (req, res) => {
    const { new_email, password } = req.body;
    if (!(await bcrypt.compare(password, req.user.password_hash))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    if (new_email === req.user.email) {
      throw new ApiError(400, 'New email must be different from your current email');
    }
    const taken = await dbGet('SELECT id FROM users WHERE email = ?', new_email);
    if (taken) {
      throw new ApiError(409, 'An account with this email already exists');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const link = `${CLIENT_ORIGIN}/verify-email?token=${token}`;
    let dev = true;
    try {
      ({ dev } = await sendVerificationLink(new_email, link));
    } catch {
      throw new ApiError(502, 'Could not send verification email');
    }
    const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";
    await dbRun(
      `UPDATE users SET pending_email = ?, email_verify_token = ?, email_verify_expires = ?, updated_at = ${nowFunc} WHERE id = ?`,
      new_email, token, new Date(Date.now() + 3600e3).toISOString(), req.user.id
    );
    await trackActivity(req.user.id, 'account.email_change_requested', 'user', req.user.id);
    if (dev) {
      return res.json({
        dev: true,
        verification_link: link,
        message: `Verification link sent to ${new_email} (dev mode)`,
      });
    }
    return res.json({ message: `Verification link sent to ${new_email}` });
  })
);

router.post(
  '/email/verify',
  validate(schemas.emailVerify),
  wrap(async (req, res) => {
    const { token } = req.body;
    const user = await dbGet(
      'SELECT * FROM users WHERE email_verify_token = ? AND email_verify_expires > ?',
      token, new Date().toISOString()
    );
    if (!user || !user.pending_email) {
      throw new ApiError(400, 'Invalid or expired verification link');
    }
    const taken = await dbGet('SELECT id FROM users WHERE email = ?', user.pending_email);
    if (taken) {
      throw new ApiError(409, 'An account with this email already exists');
    }
    const newEmail = user.pending_email;
    const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";
    await dbRun(
      `UPDATE users SET email = ?, pending_email = NULL, email_verify_token = NULL, email_verify_expires = NULL, updated_at = ${nowFunc} WHERE id = ?`,
      newEmail, user.id
    );
    await trackActivity(user.id, 'account.email_changed', 'user', user.id);
    return res.json({ email: newEmail });
  })
);

router.delete(
  '/account',
  requireAuth,
  validate(schemas.accountDelete),
  wrap(async (req, res) => {
    const { password } = req.body;
    if (!(await bcrypt.compare(password, req.user.password_hash))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    if (req.user.role === 'admin') {
      const admins = (await dbGet("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1")).c;
      if (admins <= 1) {
        throw new ApiError(400, 'At least one active administrator is required');
      }
    }
    const nowFunc = USE_SUPABASE ? "NOW()" : "datetime('now')";
    await dbRun(`UPDATE users SET active = 0, updated_at = ${nowFunc} WHERE id = ?`, req.user.id);
    await trackActivity(req.user.id, 'account.deactivated', 'user', req.user.id);
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      path: '/',
    });
    return res.json({ ok: true });
  })
);

export default router;
