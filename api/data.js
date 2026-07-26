import { authorized } from './_auth.js';
import { withRetry } from './_redis.js';

const KEY = 'household-budget-v1';

export default async function handler(req, res) {
  if (!authorized(req)) { res.status(401).json({ error: 'unauthorized' }); return; }

  if (!process.env.REDIS_URL) {
    res.status(200).json({ value: null, error: 'no_database',
      message: 'לא נמצא חיבור למסד נתונים.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const value = await withRetry(c => c.get(KEY), 'get');
      res.status(200).json({ value: value || null });
      return;
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      await withRetry(c => c.set(KEY, body), 'set');
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('[data] failed:', err && err.message);
    res.status(500).json({ error: 'request_failed', message: String(err && err.message || err) });
  }
}
