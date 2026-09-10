/* ═══════════════════════════════════════════════════════════════════════════
   /api/lead — where the homepage contact form goes (brief §28, §35, §36).

   The browser POSTs { lead:{name,email,phone,company?}, discovery:{…}, page, ts }
   (kimi-flow.js). This validates and normalises every field, RECOMPUTES the
   recommendation from the structured signals with the same deterministic
   engine the page ran (a client cannot claim a product the signals do not
   support), builds the sales summary, and hands the lead to the lead service:
   HubSpot (live with HUBSPOT_ACCESS_TOKEN, MOCK without — "just fake hubspot
   for now", client 2026-09-10) and, if configured, the LEAD_WEBHOOK_URL of
   the earlier build.

   The recommendation is never held hostage to a CRM: any accepted lead is a
   200, with delivered:true|false so the client can offer a retry when nothing
   took it. Only a malformed lead is a 400; only a rate limit is a 429.

   Config (Vercel environment variables): see .env.example.
   ═══════════════════════════════════════════════════════════════════════════ */
import SOLUTIONS from '../data/solutions.json' with { type: 'json' };
import GOALS from '../data/goals.json' with { type: 'json' };
import TAXONOMY from '../data/taxonomy.json' with { type: 'json' };
import SCORING from '../data/scoring.json' with { type: 'json' };
import { validateLeadBody } from './_lib/leads/schema.js';
import { submitLead } from './_lib/leads/leadService.js';
import { limited } from './_lib/ratelimit.js';

const DATA = { solutions: SOLUTIONS, goals: GOALS, taxonomy: TAXONOMY, scoring: SCORING };

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  if (limited(req, res, 10, 60000)) return;          /* ten leads a minute per address is plenty */

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const v = validateLeadBody(body, DATA);
  if (!v.ok) { res.status(400).json({ ok: false, error: v.error, field: v.field || null }); return; }

  const out = await submitLead(v.lead, DATA);
  res.status(200).json({
    ok: true,
    delivered: out.delivered,
    mode: out.mode,
    destination: out.destination,
    action: out.action,
    retryable: out.retryable,
    recommendation: { primary: v.lead.discovery.primary, secondary: v.lead.discovery.secondary, confidence: v.lead.discovery.confidence && v.lead.discovery.confidence.level }
  });
}
