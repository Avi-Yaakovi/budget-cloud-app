import { authorized } from './_auth.js';
import { withRetry } from './_redis.js';

const KEY = 'household-budget-v1';
const MAX_BYTES = 4 * 1024 * 1024;

/* The client refuses to write before a successful read, but nothing stopped a
   malformed request from replacing the whole key with junk. Everything below
   is a last line of defence around the only destructive operation we have. */
function reject(body) {
  if (typeof body !== 'string' || !body) return 'empty_body';
  if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) return 'too_large';
  let p;
  try { p = JSON.parse(body); } catch (e) { return 'not_json'; }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'not_an_object';
  if (!Array.isArray(p.transactions)) return 'missing_transactions';
  if (!Array.isArray(p.deleted)) return 'missing_deleted';
  return null;
}

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
      const bad = reject(body);
      if (bad) {
        console.error('[data] refused write:', bad);
        res.status(400).json({ error: 'invalid_payload', reason: bad });
        return;
      }
      /* Clearing every transaction is legitimate only when the client also sends
         the matching tombstones — that is what the in-app reset produces. */
      const next = JSON.parse(body);
      if (!next.transactions.length) {
        const cur = await withRetry(c => c.get(KEY), 'get-guard');
        let had = 0;
        try { had = (JSON.parse(cur || '{}').transactions || []).length; } catch (e) {}
        if (had && !next.deleted.length) {
          console.error('[data] refused write: would clear ' + had + ' transactions with no tombstones');
          res.status(409).json({ error: 'refused_wipe', had });
          return;
        }
      }
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
