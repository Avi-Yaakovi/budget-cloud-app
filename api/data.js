import Redis from 'ioredis';

const KEY = 'household-budget-v1';

function checkAuth(req, res){
  const code = process.env.APP_CODE;
  if(!code) return true;
  if(req.headers['x-app-code'] !== code){
    res.status(401).json({ error:'unauthorized' });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if(!checkAuth(req, res)) return;
  const connStr = process.env.REDIS_URL;

  if (!connStr) {
    res.status(200).json({
      value: null,
      error: 'no_database',
      message: 'לא נמצא חיבור למסד נתונים. יש לחבר מסד KV/Redis לפרויקט הזה בדאשבורד של Vercel ולפרוס מחדש.'
    });
    return;
  }

  const redis = new Redis(connStr, { maxRetriesPerRequest: 2, lazyConnect: true });

  try {
    await redis.connect();

    if (req.method === 'GET') {
      const value = await redis.get(KEY);
      res.status(200).json({ value: value || null });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      await redis.set(KEY, body);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    res.status(500).json({ error: 'request_failed', message: String(err) });
  } finally {
    redis.disconnect();
  }
}
