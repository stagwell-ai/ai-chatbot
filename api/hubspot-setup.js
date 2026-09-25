/* ═══════════════════════════════════════════════════════════════════════════
   /api/hubspot-setup — the one-time schema setup, for an admin with no
   terminal. It does exactly what scripts/hubspot-setup.mjs does (both call
   ensureProperties in api/_lib/leads/setup.js): create the "Stagwell AI
   discovery" property group and the 22 contact properties, and repair any
   that are already there in the wrong shape.

   WHY THIS EXISTS. The properties must exist BEFORE the first live lead, or
   HubSpot rejects the whole contact for naming fields it does not know and
   the lead reaches nobody. The person who owns the HubSpot account is not
   necessarily someone who runs npm.

   WHO MAY CALL IT. Whoever can produce the HubSpot key that is already in
   this project's environment — so, whoever could do all of this by hand in
   HubSpot anyway. The key is compared to HUBSPOT_ACCESS_TOKEN in constant
   time, over SHA-256 so the comparison cannot leak its length. It must be
   POSTed in a header or a JSON body, never a query string: a URL would end up
   in a browser's history, a referrer and Vercel's request log. Nothing here
   ever returns or logs the key.

   It is safe to leave in place — it can only bring the portal's schema to the
   state this repo defines, and it is bounded hard by the rate limiter — but
   once the setup is done and green, deleting this file and its page costs
   nothing either.
   ═══════════════════════════════════════════════════════════════════════════ */
import { createHash, timingSafeEqual } from 'node:crypto';
import { ensureProperties } from './_lib/leads/setup.js';
import { describeForm } from './_lib/leads/form-probe.js';
import { limited } from './_lib/ratelimit.js';

const env = k => (process.env[k] || '').trim();
const digest = s => createHash('sha256').update(String(s), 'utf8').digest();

function sameKey(given, real) {
  if (!given || !real) return false;
  return timingSafeEqual(digest(given), digest(real));
}

function offered(req, body) {
  const h = String((req.headers && req.headers.authorization) || '');
  const bearer = h.replace(/^Bearer\s+/i, '').trim();
  if (bearer && bearer !== h.trim()) return bearer;
  return String((body && body.key) || '').trim();
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-robots-tag', 'noindex');

  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    res.status(405).json({ ok: false, error: 'method_not_allowed', help: 'Open /hubspot-setup and use the form.' });
    return;
  }
  /* a guessing machine gets five tries every ten minutes and no more */
  if (limited(req, res, 5, 600000)) return;

  const real = env('HUBSPOT_ACCESS_TOKEN');
  if (!real) {
    res.status(503).json({ ok: false, error: 'not_configured', help: 'HUBSPOT_ACCESS_TOKEN is not set on this deployment. Add it in Vercel → Settings → Environment Variables, redeploy, then try again.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  if (!sameKey(offered(req, body), real)) {
    res.status(401).json({ ok: false, error: 'unauthorized', help: 'That is not the key this deployment is using. Copy it again from HubSpot → Development → Keys → Service keys, or check that Vercel has the same one.' });
    return;
  }

  /* Same door, second question: what is actually on the HubSpot form we post
     to. Read-only, writes nothing, and needs no key of its own — only the
     right to ask, which the check above already established. */
  if (String(body.action || '') === 'form') {
    const f = await describeForm({ portalId: env('HUBSPOT_PORTAL_ID'), guid: env('HUBSPOT_FORM_GUID') });
    res.status(f.ok ? 200 : 502).json(Object.assign({ action: 'form', current: env('HUBSPOT_FORM_FIELD_MAP') || null }, f));
    return;
  }

  const r = await ensureProperties({ token: real });
  res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    error: r.error || null,
    help: r.help || null,
    group: r.group,
    tally: r.tally,
    reach: r.reach || null,
    reachHelp: r.reachHelp || null,
    properties: r.properties
  });
}

/* 24 round trips to HubSpot, four at a time — comfortably inside a minute,
   nowhere near the platform's 10-second default */
export const config = { maxDuration: 60 };
