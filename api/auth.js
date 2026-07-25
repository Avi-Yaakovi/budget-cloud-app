import { OAuth2Client } from 'google-auth-library';
import { signSession, readSession, COOKIE, MAXAGE } from './_auth.js';

const CLIENT_ID = '461926098122-3ra07fpcd15te4gt4a5b0ij4d5g5ct7m.apps.googleusercontent.com';

export default async function handler(req, res) {
  const secret = process.env.SESSION_SECRET;
  const allow = process.env.ALLOWED_EMAILS;

  if (req.method === 'GET') {
    const s = secret ? readSession(req, secret) : null;
    res.status(200).json({
      google: !!(secret && allow),
      clientId: CLIENT_ID,
      codeFallback: !!process.env.APP_CODE,
      signedInAs: s ? s.email : null
    });
    return;
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  if (!secret || !allow) {
    res.status(200).json({ error: 'not_configured',
      message: 'התחברות עם Google עוד לא הוגדרה. חסרים משתני הסביבה ALLOWED_EMAILS ו-SESSION_SECRET.' });
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
    const list = allow.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
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
