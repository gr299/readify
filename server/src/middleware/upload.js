import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { UPLOAD_DIR, MAX_UPLOAD_SIZE, ALLOWED_IMAGE_TYPES } from '../config.js';
import { ApiError } from '../utils.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 8);
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext || '.img'}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new ApiError(400, 'Only image files are allowed (jpeg, png, gif, webp, svg, avif)'));
    }
    return cb(null, true);
  },
});

export const uploadImages = upload.array('images', 12);
export const uploadSingleImage = upload.single('image');
