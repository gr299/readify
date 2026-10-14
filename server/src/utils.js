import crypto from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { db, USE_SUPABASE } from './db.js';

export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function readingTime(content) {
  const text = (content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text.length === 0 ? 0 : text.split(' ').length;
  return Math.max(1, Math.round(words / 200));
}

const AVATAR_COLORS = [
  '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
  '#03a9f4', '#009688', '#4caf50', '#ff9800', '#795548',
  '#f44336', '#607d8b', '#ff5722', '#8bc34a', '#00bcd4',
];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarDataUri(name) {
  const initials = (name || 'U')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const bg = colorFor(name || 'U');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="${bg}"/><text x="48" y="48" dy="0.36em" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const SANITIZE_OPTIONS = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'b', 'em', 'i', 'u',
    's', 'strike', 'del', 'mark', 'small', 'sub', 'sup', 'ul', 'ol', 'li', 'a', 'img',
    'blockquote', 'pre', 'code', 'font', 'div', 'span', 'hr', 'table', 'thead', 'tbody',
    'tr', 'th', 'td', 'figure', 'figcaption',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'name'],
    img: ['src', 'alt', 'title', 'width', 'height', 'style'],
    div: ['style', 'contenteditable'],
    span: ['style'],
    p: ['style'],
    code: ['class'],
    pre: ['class'],
    th: ['align', 'style'],
    td: ['align', 'style'],
    '*': ['style', 'data-object', 'data-id'],
  },
  allowedClasses: {
    div: [/^doc-[a-z0-9-]+$/],
    span: [/^doc-[a-z0-9-]+$/],
  },
  allowedStyles: {
    '*': {
      'position': [/^(absolute|relative)$/],
      'left': [/^-?[\d.]+px$/],
      'top': [/^-?[\d.]+px$/],
      'right': [/^-?[\d.]+px$/],
      'bottom': [/^-?[\d.]+px$/],
      'width': [/^[\d.]+(px|%)$/],
      'height': [/^[\d.]+(px|%)$/],
      'min-width': [/^[\d.]+px$/],
      'min-height': [/^[\d.]+px$/],
      'max-width': [/^[\d.]+(px|%)$/],
      'max-height': [/^[\d.]+(px|%)$/],
      'transform': [/^rotate\([-.\d]+deg\)$/],
      'line-height': [/^[\d.]+(px|em|%)?$/],
      'margin': [/^-?[\d.]+px$/],
      'margin-top': [/^-?[\d.]+px$/],
      'margin-bottom': [/^-?[\d.]+px$/],
      'margin-left': [/^-?[\d.]+px$/],
      'margin-right': [/^-?[\d.]+px$/],
      'padding': [/^[\d.]+px$/],
      'padding-top': [/^[\d.]+px$/],
      'padding-bottom': [/^[\d.]+px$/],
      'padding-left': [/^[\d.]+px$/],
      'padding-right': [/^[\d.]+px$/],
      'color': [/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgba?\(/],
      'background-color': [/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgba?\(/, /^transparent$/],
      'font-family': [/^[a-zA-Z0-9 ,'"-]+$/],
      'font-size': [/^[\d.]+px$/],
      'font-style': [/^(italic|normal)$/],
      'font-weight': [/^(bold|normal|[4-9]00)$/],
      'text-decoration': [/^(underline|line-through|none|underline line-through)$/],
      'text-align': [/^(left|center|right|justify)$/],
      'vertical-align': [/^(top|middle|bottom|baseline)$/],
      'display': [/^(block|inline|inline-block|flex)$/],
      'float': [/^(left|right|none)$/],
      'object-fit': [/^(contain|cover|fill)$/],
      'border-radius': [/^[\d.]+px$/],
      'box-sizing': [/^border-box$/],
      'z-index': [/^\d+$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
    a: ['http', 'https', 'mailto'],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
};

export function sanitizeContent(html) {
  return sanitizeHtml(html || '', SANITIZE_OPTIONS);
}

export function extractImageSrcs(html) {
  const srcs = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html || '')) !== null) {
    srcs.push(m[1]);
  }
  return srcs;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    bio: user.bio,
    website: user.website,
    github: user.github,
    twitter: user.twitter,
    google: user.google,
    linkedin: user.linkedin,
    created_at: user.created_at,
  };
}

export function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 16);
}

export function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  return { page: p, limit: l, offset: (p - 1) * l };
}

export function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  console.error('[readify] unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

export async function trackActivity(userId, action, entityType, entityId, meta) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(
      'INSERT INTO activities (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)'
    );
    await stmt.run(userId, action, entityType, entityId, meta ? JSON.stringify(meta) : null);
  } else {
    db.prepare(
      'INSERT INTO activities (user_id, action, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, action, entityType, entityId, meta ? JSON.stringify(meta) : null);
  }
}
