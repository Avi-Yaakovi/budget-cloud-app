import Redis from 'ioredis';

/* One client per warm lambda instead of one per request.
   Opening a fresh TCP connection on every call exhausts the
   connection budget on hosted Redis and shows up as sporadic 500s. */
let client = null;

export function redis() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (client && ['ready', 'connect', 'connecting', 'reconnecting'].includes(client.status)) return client;
  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    connectTimeout: 8000,
    keepAlive: 10000,
    retryStrategy: t => (t > 4 ? null : Math.min(t * 200, 1500))
  });
  client.on('error', e => console.error('[redis]', e && e.message));
  return client;
}

export async function withRetry(fn, label) {
  let last;
  for (let i = 0; i < 2; i++) {
    try {
      const c = redis();
      if (!c) throw new Error('REDIS_URL missing');
      return await fn(c);
    } catch (e) {
      last = e;
      console.error('[redis] ' + label + ' attempt ' + (i + 1) + ' failed: ' + (e && e.message));
      client = null;                       // force a fresh client on retry
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw last;
}
