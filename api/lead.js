/* ═══════════════════════════════════════════════════════════════════════════
   /api/lead — where the homepage contact form goes.

   The hero agent (next/hero-agent.js) asks for name, email and phone once its
   questions are done, so a Stagwell AI specialist can call. The browser POSTs
   that here; this forwards it, as JSON, to wherever LEAD_WEBHOOK_URL points
   (a HubSpot form endpoint, a Zapier/Make hook, a Slack incoming webhook —
   anything that takes a JSON POST).

   With no LEAD_WEBHOOK_URL configured the lead is NOT stored anywhere: the
   handler answers 202 {delivered:false} so the visitor still sees their
   confirmation and the demo console still shows the capture events, and the
   Vercel function log records that a lead arrived with nowhere to go. Set
   the variable before this form is put in front of real prospects.

   Config (Vercel environment variables):
     LEAD_WEBHOOK_URL   required for delivery; https:// only
     LEAD_WEBHOOK_AUTH  optional; sent verbatim as the Authorization header
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX = 400;   /* a field longer than this is not a name, an email or a phone */

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max || MAX) : '') || null;
const list = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.slice(0, 64)).slice(0, 8) : []);

const EMAIL_RE = /^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const lead = {
    name: str(body.name, 120),
    email: str(body.email, 200),
    phone: str(body.phone, 60),
    company: str(body.company, 160),
    website: str(body.website, 160),
    role: str(body.role, 40),
    size: str(body.size, 40),
    timing: str(body.timing, 40),
    problems: list(body.problems),
    route: str(body.route, 40),
    product: str(body.product, 160),
    page: str(body.page, 300),
    submittedAt: str(body.ts, 40),
    receivedAt: new Date().toISOString(),
    source: 'stagwell-ai · homepage agent'
  };

  if (!lead.name || !lead.email || !EMAIL_RE.test(lead.email)) {
    res.status(400).json({ ok: false, error: 'name_and_email_required' });
    return;
  }

  const url = process.env.LEAD_WEBHOOK_URL || '';
  if (!/^https:\/\//i.test(url)) {
    /* nowhere to send it — say so in the log, never to the visitor as a failure */
    console.warn('[lead] received but LEAD_WEBHOOK_URL is not configured; not stored', { domain: lead.email.split('@')[1], product: lead.product });
    res.status(202).json({ ok: true, delivered: false, reason: 'not_configured' });
    return;
  }

  const headers = { 'content-type': 'application/json' };
  if (process.env.LEAD_WEBHOOK_AUTH) headers.authorization = process.env.LEAD_WEBHOOK_AUTH;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(lead), signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) {
      console.error('[lead] webhook answered', r.status);
      res.status(502).json({ ok: false, delivered: false, error: 'webhook_' + r.status });
      return;
    }
    res.status(200).json({ ok: true, delivered: true });
  } catch (e) {
    console.error('[lead] webhook failed', e && e.message);
    res.status(502).json({ ok: false, delivered: false, error: 'webhook_unreachable' });
  }
}
