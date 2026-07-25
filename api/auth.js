import { OAuth2Client } from 'google-auth-library';
import Redis from 'ioredis';
import { signSession, readSession, authorized, sessionSecret, COOKIE, MAXAGE } from './_auth.js';

const ALLOW_KEY = 'household-budget-allowed';

async function withRedis(fn) {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const r = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  try { await r.connect(); return await fn(r); }
  finally { try { r.disconnect(); } catch (e) {} }
}

async function getAllowList() {
  const fromEnv = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  let stored = [];
  try {
    const raw = await withRedis(r => r.get(ALLOW_KEY));
    if (raw) stored = JSON.parse(raw).map(s => String(s).trim().toLowerCase()).filter(Boolean);
  } catch (e) {}
  return Array.from(new Set(fromEnv.concat(stored)));
}

const CLIENT_ID = '461926098122-3ra07fpcd15te4gt4a5b0ij4d5g5ct7m.apps.googleusercontent.com';

export default async function handler(req, res) {
  const secret = sessionSecret();

  if (req.method === 'GET') {
    const s = secret ? readSession(req, secret) : null;
    const list = await getAllowList();
    res.status(200).json({
      google: !!(secret && list.length),
      clientId: CLIENT_ID,
      codeFallback: !!process.env.APP_CODE,
      signedInAs: s ? s.email : null,
      allowed: authorized(req) ? list : undefined
    });
    return;
  }

  /* manage the allow-list — only for someone already authenticated */
  if (req.method === 'PUT') {
    if (!authorized(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
    let body = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) {}
    const list = Array.isArray(body.allowed)
      ? Array.from(new Set(body.allowed.map(x => String(x).trim().toLowerCase()).filter(x => x.indexOf('@') > 0))).slice(0, 20)
      : [];
    try {
      await withRedis(r => r.set(ALLOW_KEY, JSON.stringify(list)));
      res.status(200).json({ ok: true, allowed: list });
    } catch (e) { res.status(500).json({ error: 'save_failed', message: String(e) }); }
    return;
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const list = await getAllowList();
  if (!secret || !list.length) {
    res.status(200).json({ error: 'not_configured',
      message: 'עוד לא הוגדרו כתובות מייל מורשות. היכנסו עם קוד הגישה, ובלשונית "עוד" הוסיפו את המיילים.' });
    return;
  }

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) {}
  if (!body.credential) { res.status(400).json({ error: 'missing_credential' }); return; }

  try {
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: body.credential, audience: CLIENT_ID });
    const p = ticket.getPayload();
    const email = String(p.email || '').toLowerCase();
    if (!p.email_verified || list.indexOf(email) === -1) {
      res.status(403).json({ error: 'not_allowed',
        message: 'החשבון ' + (email || '') + ' אינו מורשה לגשת לאפליקציה.' });
      return;
    }
    const token = signSession({ email, exp: Date.now() + MAXAGE * 1000 }, secret);
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAXAGE}`);
    res.status(200).json({ ok: true, email, name: p.name || '' });
  } catch (e) {
    res.status(401).json({ error: 'invalid_token', message: 'אימות מול Google נכשל.' });
  }
}
