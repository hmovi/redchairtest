// Vercel serverless function: sends the website contact form to hello@redchairmarketing.ca via Resend.
// Required env var (Vercel > Project > Settings > Environment Variables): RESEND_API_KEY
// Optional env vars: CONTACT_TO (default hello@redchairmarketing.ca), CONTACT_FROM
//   (default "Red Chair Marketing <hello@redchairmarketing.ca>", the domain must be verified in Resend).

const TO = process.env.CONTACT_TO || 'hello@redchairmarketing.ca';
const FROM = process.env.CONTACT_FROM || 'Red Chair Marketing <hello@redchairmarketing.ca>';

const oneLine = (v, max) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const multi = (v, max) => String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // Only accept submissions that come from this site.
  const origin = req.headers.origin || '';
  if (origin) {
    let host = '';
    try { host = new URL(origin).hostname; } catch (e) { /* ignore */ }
    const okHost = host === 'redchairmarketing.ca' || host === 'www.redchairmarketing.ca' ||
      host.endsWith('.vercel.app') || host === 'localhost';
    if (!okHost) return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // Honeypot: real visitors never fill this in. Pretend success so bots move on.
  if (body.website) return res.status(200).json({ ok: true });

  const name = oneLine(body.name, 120);
  const email = oneLine(body.email, 200);
  const service = oneLine(body.service, 120);
  const message = multi(body.message, 5000);
  const page = oneLine(body.page, 300);

  if (!name) return res.status(400).json({ ok: false, error: 'name_required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'email_invalid' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: 'not_configured' });

  const subject = `Website inquiry: ${service || 'General'} (${name})`;
  const text = `Name: ${name}\nEmail: ${email}\nService: ${service || '-'}\nPage: ${page || '-'}\n\n${message || '(no message)'}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1F1B1A">
    <h2 style="margin:0 0 12px;color:#B33C3A">New website inquiry</h2>
    <p style="margin:0"><b>Name:</b> ${esc(name)}</p>
    <p style="margin:0"><b>Email:</b> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
    <p style="margin:0"><b>Service:</b> ${esc(service || '-')}</p>
    <p style="margin:0 0 14px"><b>Page:</b> ${esc(page || '-')}</p>
    <div style="white-space:pre-wrap;border-left:3px solid #B33C3A;padding-left:12px">${esc(message || '(no message)')}</div>
  </div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject, text, html }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('Resend error', r.status, detail.slice(0, 300));
      return res.status(502).json({ ok: false, error: 'send_failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact function error', err);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
};
