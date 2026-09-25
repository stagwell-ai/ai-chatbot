/* ═══════════════════════════════════════════════════════════════════════════
   /api/callback — "Call my phone" (client, 2026-09-15).

   The widget on the page asks for a phone number first and only then for a
   name and a work email. This takes that, checks it, turns the country and
   the number into ONE E.164 string, mints a session id, and forwards the
   lead to the automation webhook.

   Why it is a function and not a fetch from the page: the webhook URL is a
   write endpoint. In the browser it would be readable by anyone viewing
   source and postable by anyone at all. It lives in CALLBACK_WEBHOOK_URL on
   the server and never reaches the client — the reply carries the session id
   and nothing else.

   THE COUNTRY CODE IS NOT OPTIONAL. A national number with no country is
   useless to whoever places the call, so a body without a dial code is a 400
   rather than a lead nobody can ring.

   Body: { first_name, last_name, email, dial_code, national_number, page? }
         (phone: "+41763284000" is also accepted whole, in place of the pair)
   Reply: { ok, session_id, delivered }
   Forwarded: { session_id, email, first_name, last_name, phone, meta{…} }
   ═══════════════════════════════════════════════════════════════════════════ */
import { limited } from './_lib/ratelimit.js';

/* the dial codes the widget offers; a number is only as good as its country */
const DIAL_CODES = new Set(['1', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45',
  '46', '47', '48', '49', '52', '55', '56', '57', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86',
  '90', '91', '234', '351', '353', '358', '380', '420', '852', '886', '966', '971', '972', '974']);

const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 120);
const EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/* a session id in the shape the automation already expects: a number */
export function newSessionId(now, rnd) {
  const t = typeof now === 'number' ? now : Date.now();
  const r = typeof rnd === 'number' ? rnd : Math.random();
  return Number(String(t).slice(-8) + String(Math.floor(r * 900) + 100));
}

/* country + number → one E.164 string, or an error naming the field */
export function toE164(dialCode, nationalNumber, whole) {
  const w = String(whole == null ? '' : whole).trim();
  if (!dialCode && w) {
    /* a whole number was pasted: it must carry its country itself */
    if (!/^\+/.test(w)) return { ok: false, error: 'country_required', field: 'dial_code' };
    const digits = w.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return { ok: false, error: 'bad_phone', field: 'phone' };
    return { ok: true, phone: '+' + digits, dial: null };
  }
  const dial = String(dialCode == null ? '' : dialCode).replace(/\D/g, '');
  if (!dial) return { ok: false, error: 'country_required', field: 'dial_code' };
  if (!DIAL_CODES.has(dial)) return { ok: false, error: 'unknown_country', field: 'dial_code' };
  const nat = String(nationalNumber == null ? '' : nationalNumber).replace(/\D/g, '').replace(/^0+/, '');
  if (nat.length < 6 || nat.length > 14) return { ok: false, error: 'bad_phone', field: 'national_number' };
  const phone = '+' + dial + nat;
  if (phone.replace(/\D/g, '').length > 15) return { ok: false, error: 'bad_phone', field: 'national_number' };
  return { ok: true, phone, dial };
}

/* pure: body in, either a 400 reason or the payload the webhook receives */
export function buildCallback(body, opts) {
  const b = body && typeof body === 'object' ? body : {};
  const o = opts || {};
  const first_name = clean(b.first_name, 80);
  const last_name = clean(b.last_name, 80);
  const email = clean(b.email, 160).toLowerCase();
  if (!first_name) return { ok: false, status: 400, error: 'first_name_required', field: 'first_name' };
  if (!last_name) return { ok: false, status: 400, error: 'last_name_required', field: 'last_name' };
  if (!EMAIL.test(email)) return { ok: false, status: 400, error: 'bad_email', field: 'email' };
  const p = toE164(b.dial_code, b.national_number, b.phone);
  if (!p.ok) return { ok: false, status: 400, error: p.error, field: p.field };
  const session_id = o.sessionId || newSessionId();
  return {
    ok: true,
    session_id,
    /* exactly the five fields the automation maps, then our own context
       under meta so the mapping never has to change */
    payload: {
      session_id,
      email,
      first_name,
      last_name,
      phone: p.phone,
      meta: {
        source: 'stagwell-ai-site',
        request: 'call_my_phone',
        dial_code: p.dial,
        page: clean(b.page, 200) || null,
        consent: 'ai_voice_call_and_recording',
        requested_at: new Date(o.now || Date.now()).toISOString()
      }
    }
  };
}

export async function forward(payload, env, fetchImpl) {
  const e = env || process.env;
  const url = e.CALLBACK_WEBHOOK_URL || '';
  if (!url) return { delivered: false, reason: 'no_webhook_configured' };
  const f = fetchImpl || fetch;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await f(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal
    });
    clearTimeout(t);
    return { delivered: r.ok, reason: r.ok ? null : 'webhook_http_' + r.status };
  } catch (err) {
    clearTimeout(t);
    return { delivered: false, reason: err && err.name === 'AbortError' ? 'webhook_timeout' : 'webhook_network' };
  }
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  /* a phone call costs real money and rings a real person: six an hour per
     address, so nobody runs the queue up from a script */
  if (limited(req, res, 6, 3600000)) return;

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const built = buildCallback(body || {});
  if (!built.ok) { res.status(built.status).json({ ok: false, error: built.error, field: built.field || null }); return; }

  const out = await forward(built.payload, process.env);
  if (!out.delivered) {
    try { console.warn('[callback] not delivered:', out.reason); } catch (e) {}
  }
  /* the visitor is told the truth: a lead we could not hand on is not an "ok" */
  res.status(out.delivered ? 200 : 502).json({ ok: out.delivered, session_id: built.session_id, delivered: out.delivered });
}
