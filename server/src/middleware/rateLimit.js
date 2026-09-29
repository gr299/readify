import rateLimit from 'express-rate-limit';

function limiter({ windowMs, limit, message, standardHeaders = true, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { error: message },
  });
}

// General API: 600 requests per 15 minutes per IP.
export const generalLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests, please slow down.',
});

// Login / registration: 20 attempts per 15 minutes per IP.
export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many authentication attempts. Please try again later.',
});

// Settings: 30 requests per 15 minutes per IP.
export const settingsLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many attempts. Please try again later.',
});

// Comments: 30 posts per 10 minutes per IP (spam control).
export const commentLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: 'You are posting comments too quickly. Please slow down.',
});

// Reactions: 60 changes per 10 minutes per IP.
export const reactionLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  message: 'You are reacting too quickly. Please slow down.',
});

// Uploads: 40 uploads per hour per IP.
export const uploadLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  message: 'Upload limit reached. Please try again later.',
});

// Admin API: 600 requests per 15 minutes per IP.
export const adminLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests, please slow down.',
});
