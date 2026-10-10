// Netlify Function: forwards contact-form messages to Telegram.
// Env vars (set in the Netlify dashboard — never commit them):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
//
// Accepts JSON:
//   { name, email, subject?, message, website? }   <- contact form (website = honeypot)
//   { text, mood? }                                 <- legacy anonymous message (still supported)
//
// Responds { success: true } ONLY after Telegram has accepted the message.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_BODY_BYTES = 8000;

const json = (statusCode, payload, extra = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  body: JSON.stringify(payload),
});

// Telegram HTML parse mode: only these three characters need escaping.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

exports.handler = async function (event) {
  // Read env at call time (keeps the function testable and picks up dashboard changes).
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' });

  if (!TOKEN || !CHAT_ID) {
    // Details stay in the server log; visitors get a generic message.
    console.error('send-message: TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID are not configured.');
    return json(503, { error: 'Messaging is temporarily unavailable.' });
  }

  if (!event.body || Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return json(413, { error: 'The request is empty or too large.' });
  }

  let data;
  try { data = JSON.parse(event.body); } catch (_) { return json(400, { error: 'Invalid request.' }); }
  if (!data || typeof data !== 'object') return json(400, { error: 'Invalid request.' });

  // Honeypot: real visitors never see or fill this field. Pretend success, send nothing.
  if (data.website) return json(200, { success: true });

  const isLegacy = typeof data.text === 'string' && data.message === undefined;
  const message = clip(isLegacy ? data.text : data.message, 1200);
  const name = clip(data.name, 80);
  const email = clip(data.email, 120);
  const subject = clip(data.subject, 120);
  const mood = clip(data.mood, 20);

  if (!isLegacy) {
    if (!name) return json(400, { error: 'Please tell me your name.', field: 'name' });
    if (!EMAIL_RE.test(email)) return json(400, { error: 'Please enter a valid email address.', field: 'email' });
  }
  if (message.length < 10) return json(400, { error: 'Please write at least 10 characters.', field: 'message' });
  if (message.length > 1000) return json(400, { error: 'Please keep the message under 1000 characters.', field: 'message' });

  const headers = event.headers || {};
  const ip = headers['x-nf-client-connection-ip'] || headers['client-ip'] || (headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
  const ua = clip(headers['user-agent'] || 'unknown', 90);
  const time = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', hour12: false });

  const lines = isLegacy
    ? ['<b>Anonymous message</b>', '', esc(message), '', `Mood: ${esc(mood || 'n/a')}`]
    : [
        '<b>New message from the portfolio</b>', '',
        `<b>From:</b> ${esc(name)}`,
        `<b>Email:</b> ${esc(email)}`,
        subject ? `<b>Subject:</b> ${esc(subject)}` : null,
        '', esc(message),
      ].filter((l) => l !== null);
  lines.push('', `<i>${esc(time)} · ${esc(ip)} · ${esc(ua)}</i>`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: ctrl.signal,
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.ok) {
      console.error('send-message: Telegram rejected the message:', res.status, result && result.description);
      return json(502, { error: 'The message could not be delivered right now.' });
    }
    return json(200, { success: true });
  } catch (err) {
    console.error('send-message: delivery failed:', err && err.name, err && err.message);
    return json(502, { error: 'The message could not be delivered right now.' });
  } finally {
    clearTimeout(timer);
  }
};
