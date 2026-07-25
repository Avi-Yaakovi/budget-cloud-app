import crypto from 'crypto';

export const COOKIE = 'bh_session';

/* No SESSION_SECRET env var needed: derive a stable key from REDIS_URL,
   which is already configured, already secret, and never leaves the server. */
export function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const base = process.env.REDIS_URL;
  if (!base) return null;
  return crypto.createHash('sha256').update('bh-session|' + base).digest('hex');
}
export const MAXAGE = 60 * 60 * 24 * 30; // 30 days

export function signSession(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + mac;
}

export function readSession(req, secret) {
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!hit) return null;
  const token = hit.slice(COOKIE.length + 1);
  const i = token.indexOf('.');
  if (i < 1) return null;
  const body = token.slice(0, i), mac = token.slice(i + 1);
  const expect = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expect);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || Date.now() > p.exp) return null;
    return p;
  } catch (e) { return null; }
}

/* A request is allowed if it carries a valid Google session cookie,
   or the shared access code, or if no protection is configured at all. */
export function authorized(req) {
  const secret = sessionSecret();
  if (secret && readSession(req, secret)) return true;
  const code = process.env.APP_CODE;
  if (code && req.headers['x-app-code'] === code) return true;
  return false;
}
