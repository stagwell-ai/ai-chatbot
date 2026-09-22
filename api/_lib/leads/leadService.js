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
import { upsertContact, hubspotMode, redactForLog, createNote, createTask, escapeHtml, announceScopeHelp } from './hubspot.js';
import { toHubSpotProperties } from './properties.js';
import { salesSummary } from './schema.js';
import RECOMMEND from '../../../next/recommend.js';

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

/* ── WHAT THE NOTE AND THE TASK SAY ──────────────────────────────────────────
   Written for whoever picks the phone up, in the order they need it: what was
   asked for, who asked, what they ticked, and where they were standing. The
   summary is the same sentence the contact record carries, so the two cannot
   disagree. */
function announceText(lead, data, summary) {
  const d = lead.discovery || {};
  const a = lead.attribution || {};
  /* the catalog is reached through recommend.js, which already knows the
     shape of solutions.json — salesSummary names products the same way */
  const name = id => (RECOMMEND.productById(id, data) || {}).name || id;
  const rows = [];
  rows.push(['Asked for', d.contactRequest || 'a conversation']);
  rows.push(['Name', lead.name || [lead.firstname, lead.lastname].filter(Boolean).join(' ') || '—']);
  rows.push(['Email', lead.email]);
  if (lead.phone) rows.push(['Phone', lead.phone]);
  if (lead.company) rows.push(['Company', lead.company + (d.website ? ' · ' + d.website : '')]);
  if (d.roleText) rows.push(['Role', d.roleText]);
  const want = (d.productsRequested || []).map(name);
  if (want.length) rows.push(['Wants to hear about', want.join(', ')]);
  if (d.primary) rows.push(['We recommended', name(d.primary)]);
  rows.push(['Came from', (lead.source || 'the Stagwell AI site') + (a.landingPage ? ' · ' + a.landingPage : '')]);

  const html = '<p><strong>New lead from the Stagwell AI site</strong></p>' +
    '<p>' + rows.map(r => escapeHtml(r[0]) + ': ' + escapeHtml(r[1])).join('<br>') + '</p>' +
    '<p>' + escapeHtml(summary) + '</p>';

  const subject = 'Stagwell AI: ' + (d.contactRequest === 'call' ? 'call back ' : 'follow up with ')
    + (lead.name || lead.email) + (lead.company ? ' (' + lead.company + ')' : '');

  /* a task body is plain text, not HTML */
  const body = rows.map(r => r[0] + ': ' + r[1]).join('\n') + '\n\n' + summary;
  return { html, subject, body };
}

/* Best effort, always. A note that fails is a note that fails; the lead is
   already in the CRM and the visitor has already been told so. */
async function announce(id, lead, data, summary, opts) {
  const o = opts || {};
  const out = [];
  const on = k => env(k).toLowerCase() !== 'false';
  if (!id || String(id).indexOf('mock-') === 0) return out;
  const t = announceText(lead, data, summary);

  if (on('HUBSPOT_NOTE_ENABLED')) {
    const r = await createNote(id, t.html, o.fetch);
    if (!r.ok) console.error('[hubspot] the lead landed but the timeline note did not:', r.error, announceScopeHelp(r.status) || '');
    out.push(Object.assign({ destination: 'hubspot-note' }, r));
  }
  if (on('HUBSPOT_TASK_ENABLED')) {
    const r = await createTask(id, { subject: t.subject, body: t.body, ownerId: env('HUBSPOT_OWNER_ID') }, o.fetch);
    if (!r.ok) console.error('[hubspot] the lead landed but no task was raised:', r.error, announceScopeHelp(r.status) || '');
    out.push(Object.assign({ destination: 'hubspot-task' }, r));
  }
  return out;
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
    /* and then say so out loud, where HubSpot will show it */
    if (r.ok && r.mode !== 'mock') {
      (await announce(r.id, lead, data, summary, o)).forEach(x => results.push(x));
    }
  }
  const w = await webhook(lead, summary, o.fetch);
  if (w) results.push(w);

  /* A note or a task is not a delivery: the contact is. Only destinations
     that actually CARRY the lead count, or a failed upsert whose note somehow
     succeeded would report the lead as delivered. */
  const carriers = results.filter(r => r.destination === 'hubspot' || r.destination === 'webhook');
  const delivered = carriers.some(r => r.ok && r.mode !== 'mock');
  const mocked = carriers.some(r => r.ok && r.mode === 'mock');
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
