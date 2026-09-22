/* ═══════════════════════════════════════════════════════════════════════════
   HUBSPOT SCHEMA SETUP — creates the "Stagwell AI discovery" property group
   and the contact properties the site writes (brief §30–§32: never create
   property definitions during ordinary lead submission). One admin action,
   run twice from two places and identical in both:

     scripts/hubspot-setup.mjs   a terminal, for whoever has one
     api/hubspot-setup.js        the /hubspot-setup page, for whoever does not

   They share this file so the two can never drift apart.

   RECONCILE, DON'T JUST SKIP. A property that already exists may be the WRONG
   property: the HubSpot MCP connector silently rewrites groupName to
   'custom_information' and collapses fieldType 'textarea' to 'text', so two of
   ours were created flat and ungrouped before we noticed (2026-09-22). What is
   already there is compared against the definition and PATCHed back into
   shape, which is also what makes this safe to run after someone has edited a
   property by hand. Labels and descriptions are left alone — those are a
   human's to change, and a person who renames a label means it.

     ensureProperties({ token, fetch?, baseUrl?, dry? })
       → { ok, error?, help?, group, properties:[{name,state,detail}], tally }

   state is one of: created · fixed · ok · failed   (dry: 'would-create')
   ═══════════════════════════════════════════════════════════════════════════ */
import { PROPERTIES, GROUP } from './properties.js';

export const SCOPE_HELP =
  'The key is missing a scope. It needs crm.schemas.contacts.write to create these ' +
  'properties, and crm.objects.contacts.read + .write to write leads afterwards. ' +
  'HubSpot → Development → Keys → Service keys → your key → Scopes.';

const DESCRIPTION = 'Written by the Stagwell AI website discovery conversation.';

/* HubSpot's own limits are generous (100 requests / 10s); four at a time turns
   24 round trips into six, which is the difference between a function that
   finishes and one that hits the platform's wall clock. */
const LANES = 4;

export async function ensureProperties(opts) {
  const o = opts || {};
  const token = String(o.token || '').trim();
  const base = String(o.baseUrl || process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com').replace(/\/+$/, '');
  const f = o.fetch || fetch;
  const timeoutMs = o.timeoutMs || 10000;

  const empty = { group: null, properties: [], tally: { created: 0, fixed: 0, ok: 0, failed: 0 } };

  if (o.dry) {
    return Object.assign({ ok: true, dry: true }, empty, {
      group: { state: 'would-create', name: GROUP.name, label: GROUP.label },
      properties: PROPERTIES.map(p => ({ name: p.name, state: 'would-create', detail: p.type + '/' + p.fieldType }))
    });
  }
  if (!token) return Object.assign({ ok: false, error: 'no_token', help: 'No HubSpot key was given.' }, empty);

  async function api(path, init) {
    const ac = new AbortController();
    const bail = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await f(base + path, Object.assign({}, init, {
        signal: ac.signal,
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }
      }));
      const text = await r.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { status: r.status, ok: r.ok, data, text: text.slice(0, 300) };
    } catch (e) {
      return { status: 0, ok: false, data: null, text: e && e.name === 'AbortError' ? 'timeout' : 'network error' };
    } finally { clearTimeout(bail); }
  }

  /* One cheap read first. A key that cannot do the job fails here, once, with
     the reason named — rather than twenty-two identical failures later. */
  const check = await api('/crm/v3/properties/contacts');
  if (check.status === 401) return Object.assign({ ok: false, error: 'unauthorized', help: 'HubSpot rejected the key (401). Copy it again from Development → Keys → Service keys.' }, empty);
  if (check.status === 403) return Object.assign({ ok: false, error: 'forbidden', help: SCOPE_HELP }, empty);
  if (!check.ok) return Object.assign({ ok: false, error: 'unreachable', help: 'Could not reach HubSpot: ' + check.status + ' ' + check.text }, empty);

  const existing = {};
  ((check.data && check.data.results) || []).forEach(x => { existing[x.name] = x; });

  const g = await api('/crm/v3/properties/contacts/groups', { method: 'POST', body: JSON.stringify({ name: GROUP.name, label: GROUP.label, displayOrder: -1 }) });
  const group = {
    name: GROUP.name, label: GROUP.label,
    state: g.ok ? 'created' : g.status === 409 ? 'ok' : 'failed',
    detail: g.ok || g.status === 409 ? null : g.status + ' ' + g.text
  };

  const out = new Array(PROPERTIES.length);
  let cursor = 0;
  let scopeDenied = false;

  async function lane() {
    for (;;) {
      const i = cursor++;
      if (i >= PROPERTIES.length || scopeDenied) return;
      out[i] = await one(PROPERTIES[i]);
    }
  }

  async function one(p) {
    const had = existing[p.name];
    if (had) {
      const wrong = [];
      if (had.groupName !== GROUP.name) wrong.push('group ' + had.groupName + ' → ' + GROUP.name);
      if (had.fieldType !== p.fieldType) wrong.push('field ' + had.fieldType + ' → ' + p.fieldType);
      if (!wrong.length) return { name: p.name, label: p.label, state: 'ok', detail: null };
      /* name and type are fixed once a property exists; group and fieldType are not */
      const r = await api('/crm/v3/properties/contacts/' + encodeURIComponent(p.name),
        { method: 'PATCH', body: JSON.stringify({ groupName: GROUP.name, fieldType: p.fieldType }) });
      if (r.status === 403) { scopeDenied = true; return { name: p.name, label: p.label, state: 'failed', detail: 'scope' }; }
      if (r.ok) return { name: p.name, label: p.label, state: 'fixed', detail: wrong.join(', ') };
      return { name: p.name, label: p.label, state: 'failed', detail: r.status + ' ' + r.text };
    }
    const r = await api('/crm/v3/properties/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: p.name, label: p.label, type: p.type, fieldType: p.fieldType, groupName: GROUP.name, options: p.options || undefined, description: DESCRIPTION })
    });
    if (r.status === 403) { scopeDenied = true; return { name: p.name, label: p.label, state: 'failed', detail: 'scope' }; }
    if (r.ok) return { name: p.name, label: p.label, state: 'created', detail: null };
    if (r.status === 409) return { name: p.name, label: p.label, state: 'ok', detail: null };
    return { name: p.name, label: p.label, state: 'failed', detail: r.status + ' ' + r.text };
  }

  await Promise.all(Array.from({ length: Math.min(LANES, PROPERTIES.length) }, lane));

  const properties = [];
  for (let i = 0; i < PROPERTIES.length; i++) {
    properties.push(out[i] || { name: PROPERTIES[i].name, label: PROPERTIES[i].label, state: 'failed', detail: 'not attempted' });
  }
  const tally = { created: 0, fixed: 0, ok: 0, failed: 0 };
  properties.forEach(r => { tally[r.state]++; });
  if (group.state === 'failed') tally.failed++;

  return {
    ok: tally.failed === 0,
    error: tally.failed === 0 ? null : scopeDenied ? 'forbidden' : 'partial',
    help: tally.failed === 0 ? null : scopeDenied ? SCOPE_HELP
      : 'Some properties were not written. Leads would silently drop those fields — fix the reason above and run this again; it is safe to repeat.',
    group, properties, tally
  };
}
