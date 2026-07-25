import { authorized } from './_auth.js';

export default async function handler(req, res) {
  if (!authorized(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const msg = 'הצ\'אט עדיין לא מחובר: צרו מפתח ב-console.anthropic.com, הוסיפו אותו כמשתנה סביבה בשם ANTHROPIC_API_KEY בהגדרות הפרויקט ב-Vercel, ופרסו מחדש.';
    res.status(200).json({ error: 'no_api_key', message: msg, content: [{ type: 'text', text: msg }] });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: body.messages || []
      })
    });
    const data = await r.json();
    if (data.type === 'error') {
      const msg = 'שגיאה מהשירות: ' + (data.error && data.error.message ? data.error.message : 'לא ידועה');
      res.status(200).json({ error: 'api_error', message: msg, content: [{ type: 'text', text: msg }] });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'request_failed', message: String(err) });
  }
}
