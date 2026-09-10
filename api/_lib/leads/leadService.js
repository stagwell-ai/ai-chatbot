/* ═══════════════════════════════════════════════════════════════════════════
   LEAD SERVICE — the one thing the UI's submitLead() reaches (brief §35–§36).

     submitLead(lead, data, opts) → { ok, delivered, destination, mode, results[] }

   Destinations, all optional, all server-side:
     hubspot   the CRM contact upsert (live with a token, MOCK without one)
     webhook   LEAD_WEBHOOK_URL — the earlier build's JSON POST, kept as a
               second destination so anything already wired keeps receiving
   A visitor's lead is never lost silently: if every destination fails the
   full payload is written to the function log (contact redacted to its
   domain, discovery intact) with a LEAD_UNDELIVERED marker so it can be
   replayed, and the response says delivered:false so the client can offer a
   retry. The recommendation is shown regardless (brief §36).
   ═══════════════════════════════════════════════════════════════════════════ */
import { upsertContact, hubspotMode, redactForLog } from './hubspot.js';
import { toHubSpotProperties } from './properties.js';
import { salesSummary } from './schema.js';

const env = k => (process.env[k] || '').trim();

async function webhook(lead, summary, fetchImpl) {
  const url = env('LEAD_WEBHOOK_URL');
  if (!/^https:\/\//i.test(url)) return null;
  const headers = { 'content-type': 'application/json' };
  if (env('LEAD_WEBHOOK_AUTH')) headers.authorization = env('LEAD_WEBHOOK_AUTH');
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const r = await (fetchImpl || fetch)(url, { method: 'POST', headers, body: JSON.stringify(Object.assign({}, lead, { summary })), signal: ac.signal });
    clearTimeout(t);
    return { destination: 'webhook', ok: r.ok, status: r.status, retryable: r.status === 429 || r.status >= 500 };
  } catch (e) {
    return { destination: 'webhook', ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network', retryable: true };
  }
}

export async function submitLead(lead, data, opts) {
  const o = opts || {};
  const summary = salesSummary(lead, data);
  const results = [];

  const hubspotOn = env('KIMI_HUBSPOT_ENABLED').toLowerCase() !== 'false';
  if (hubspotOn) {
    const props = toHubSpotProperties(lead, summary);
    const r = await upsertContact(props, { fetch: o.fetch, mode: o.hubspotMode });
    results.push(Object.assign({ destination: 'hubspot' }, r));
  }
  const w = await webhook(lead, summary, o.fetch);
  if (w) results.push(w);

  const delivered = results.some(r => r.ok && r.mode !== 'mock');
  const mocked = results.some(r => r.ok && r.mode === 'mock');
  const primary = results.find(r => r.destination === 'hubspot') || results[0] || null;

  if (!delivered && !mocked) {
    console.error('LEAD_UNDELIVERED', JSON.stringify({ lead: redactLead(lead), summary, results }));
  } else if (!delivered && mocked) {
    console.log('[lead] mock delivery only — set HUBSPOT_ACCESS_TOKEN or LEAD_WEBHOOK_URL before launch', JSON.stringify({ domain: lead.email.split('@')[1], primary: lead.discovery && lead.discovery.primary }));
  }

  return {
    ok: true,
    delivered,
    mode: hubspotOn ? hubspotMode() : 'off',
    destination: primary ? primary.destination + (primary.mode === 'mock' ? '-mock' : '') : null,
    hubspotId: primary && primary.destination === 'hubspot' && primary.ok ? primary.id : null,
    action: primary && primary.action || null,
    retryable: !delivered && !mocked && results.some(r => r.retryable),
    summary,
    results: results.map(r => ({ destination: r.destination, ok: !!r.ok, mode: r.mode || null, action: r.action || null, error: r.error || null }))
  };
}

export function redactLead(lead) {
  const l = JSON.parse(JSON.stringify(lead));
  l.email = '@' + String(l.email || '').split('@')[1];
  l.phone = l.phone ? '[phone]' : null;
  l.name = '[name]'; l.firstname = null; l.lastname = null;
  return l;
}

export { redactForLog };
