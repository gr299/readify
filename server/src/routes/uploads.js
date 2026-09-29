import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, USE_SUPABASE } from '../db.js';
import { UPLOAD_DIR } from '../config.js';
import { ApiError, wrap } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadImages, uploadSingleImage } from '../middleware/upload.js';

const router = Router();

// Helper to handle both sync (SQLite) and async (Supabase) database calls
async function dbGet(query, ...params) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(query);
    return await stmt.get(...params);
  }
  return db.prepare(query).get(...params);
}

function urlsFrom(req, field) {
  const files = req.files || [];
  if (field) {
    const f = req[field];
    if (f && f.filename) {
      return [{ url: `/uploads/${f.filename}`, name: f.originalname }];
    }
    return [];
  }
  return files.map((f) => ({ url: `/uploads/${f.filename}`, name: f.originalname }));
}

router.post(
  '/images',
  requireAuth,
  uploadLimiter,
  (req, res, next) => {
    uploadImages(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(413, 'Each image must be 5 MB or smaller'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new ApiError(400, 'You can upload at most 12 images at once'));
        }
        return next(err instanceof ApiError ? err : new ApiError(400, err.message));
      }
      return next();
    });
  },
  wrap((req, res) => {
    const urls = urlsFrom(req);
    if (urls.length === 0) {
      throw new ApiError(400, 'No image provided (multipart field "images" or "image")');
    }
    return res.status(201).json({ images: urls });
  })
);

router.post(
  '/image',
  requireAuth,
  uploadLimiter,
  (req, res, next) => {
    uploadSingleImage(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(413, 'Image must be 5 MB or smaller'));
        }
        return next(err instanceof ApiError ? err : new ApiError(400, err.message));
      }
      return next();
    });
  },
  wrap((req, res) => {
    const urls = urlsFrom(req, 'file');
    if (urls.length === 0) {
      throw new ApiError(400, 'No image provided (multipart field "image")');
    }
    return res.status(201).json({ images: urls });
  })
);

router.delete(
  '/image',
  requireAuth,
  uploadLimiter,
  wrap(async (req, res) => {
    const filename = String(req.body.filename || '').replace(/^.*[\\/]/, '');
    if (!/^[a-z0-9._-]+$/i.test(filename)) {
      throw new ApiError(400, 'Invalid filename');
    }
    const urlPath = `/uploads/${filename}`;
    const used = (await dbGet(
      `SELECT COUNT(*) AS c FROM articles WHERE cover_image = ? OR content LIKE ?`,
      urlPath, `%${urlPath}%`
    )).c;
    if (used === 0) {
      const abs = path.join(UPLOAD_DIR, filename);
      if (abs.startsWith(UPLOAD_DIR + path.sep)) {
        fs.rmSync(abs, { force: true });
      }
    }
    return res.json({ ok: true });
  })
);

export default router;
