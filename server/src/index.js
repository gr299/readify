import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { PORT, UPLOAD_DIR, CLIENT_ORIGIN } from './config.js';
import { attachUser } from './middleware/auth.js';
import { csrfProtection } from './middleware/security.js';
import { generalLimiter, adminLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './utils.js';
import authRoutes from './routes/auth.js';
import articleRoutes from './routes/articles.js';
import commentRoutes from './routes/comments.js';
import reactionRoutes from './routes/reactions.js';
import bookmarkRoutes from './routes/bookmarks.js';
import catalogRoutes from './routes/catalog.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import uploadRoutes from './routes/uploads.js';
import adminRoutes from './routes/admin.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", CLIENT_ORIGIN],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Origin', CLIENT_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.use(csrfProtection);

app.use('/api', generalLimiter);
app.use('/api/admin', adminLimiter);

app.use(attachUser);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'readify' }));

app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api', commentRoutes);
app.use('/api', reactionRoutes);
app.use('/api', bookmarkRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', catalogRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRoutes);

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: true }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[readify] API server listening on http://0.0.0.0:${PORT}`);
});
