import { CLIENT_ORIGIN, isDevelopmentHost } from '../config.js';
import { ApiError } from '../utils.js';

const STATE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originAllowed(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (isDevelopmentHost(url.hostname)) return true;
    const cleanOrigin = origin.replace(/\/+$/, '');
    const cleanClientOrigin = CLIENT_ORIGIN.replace(/\/+$/, '');
    return cleanOrigin === cleanClientOrigin;
  } catch {
    return false;
  }
}

// CSRF defense-in-depth. SameSite=Lax cookies already block cross-site POSTs;
// this additionally rejects state-changing requests that carry a foreign
// Origin header. Requests without an Origin header (curl, same-site GETs,
// native clients) are unaffected.
export function csrfProtection(req, res, next) {
  if (!STATE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !originAllowed(origin)) {
    return next(new ApiError(403, 'Cross-origin request rejected'));
  }
  return next();
}
