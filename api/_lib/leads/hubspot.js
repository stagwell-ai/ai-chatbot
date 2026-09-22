/* ═══════════════════════════════════════════════════════════════════════════
   HUBSPOT — server-only client for the CRM v3 contacts API (brief §28–§34).

   No SDK: the two calls this needs (search by email, create/update a contact)
   are plain HTTPS, and the repo runs without dependencies. The official
   @hubspot/api-client can replace this file behind the same three functions
   if the team prefers it; nothing else knows HubSpot's shapes.

   MOCK MODE — "just fake hubspot for now" (client, 2026-09-10). With no
   HUBSPOT_ACCESS_TOKEN, or HUBSPOT_MOCK=true, upsertContact() logs the exact
   properties it WOULD send, returns a synthetic id and never touches the
   network. The rest of the lead service cannot tell the difference, which is
   the point: the day a token is set, the same code writes to the portal.

   upsertContact(properties, opts) → { ok, mode:'live'|'mock', action:'created'|'updated'|'mocked', id, error, retryable }
   ═══════════════════════════════════════════════════════════════════════════ */
const env = k => (process.env[k] || '').trim();
const BASE = () => (env('HUBSPOT_BASE_URL') || 'https://api.hubapi.com').replace(/\/+$/, '');

export function hubspotMode() {
  if (env('HUBSPOT_MOCK').toLowerCase() === 'true') return 'mock';
  return env('HUBSPOT_ACCESS_TOKEN') ? 'live' : 'mock';
}

async function call(path, init, fetchImpl, timeoutMs) {
  const f = fetchImpl || fetch;
  const ac = new AbortController();
  const bail = setTimeout(() => ac.abort(), timeoutMs || 8000);
  try {
    const r = await f(BASE() + path, Object.assign({}, init, {
      signal: ac.signal,
      headers: Object.assign({ 'authorization': 'Bearer ' + env('HUBSPOT_ACCESS_TOKEN'), 'content-type': 'application/json' }, (init && init.headers) || {})
    }));
    const raw = await r.text();
    let data = null; try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
    /* enough of the body to read a validation error out of, and still
       server-side only — nothing returns `raw` to a browser */
    return { status: r.status, ok: r.ok, data, raw: raw.slice(0, 1200) };
  } catch (e) {
    return { status: 0, ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network' };
  } finally { clearTimeout(bail); }
}

export async function findContactByEmail(email, fetchImpl) {
  const r = await call('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }], properties: ['email'], limit: 1 })
  }, fetchImpl);
  if (!r.ok) return { ok: false, status: r.status, error: r.error || 'search_' + r.status, retryable: r.status === 0 || r.status === 429 || r.status >= 500 };
  const hit = r.data && Array.isArray(r.data.results) && r.data.results[0];
  return { ok: true, id: hit ? String(hit.id) : null };
}

export async function createContact(properties, fetchImpl) {
  const r = await call('/crm/v3/objects/contacts', { method: 'POST', body: JSON.stringify({ properties }) }, fetchImpl);
  if (r.ok) return { ok: true, id: String(r.data && r.data.id), action: 'created' };
  /* 409: the contact exists after all (race, or a search that lagged) — the
     message carries the existing id */
  if (r.status === 409) {
    const m = String((r.data && r.data.message) || '').match(/Existing ID:\s*(\d+)/i);
    if (m) return { ok: true, id: m[1], action: 'exists' };
  }
  return { ok: false, status: r.status, error: r.error || 'create_' + r.status, detail: r.raw, retryable: r.status === 0 || r.status === 429 || r.status >= 500 };
}

export async function updateContact(id, properties, fetchImpl) {
  const props = Object.assign({}, properties);
  delete props.email;      /* the identifier is not rewritten */
  const r = await call('/crm/v3/objects/contacts/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ properties: props }) }, fetchImpl);
  if (r.ok) return { ok: true, id: String(id), action: 'updated' };
  return { ok: false, status: r.status, error: r.error || 'update_' + r.status, detail: r.raw, retryable: r.status === 0 || r.status === 429 || r.status >= 500 };
}

/* ── ON ARRIVAL, NOT ON EVERY TOUCH ──────────────────────────────────────────
   Who owns the contact and what stage it lands at are set ONLY when the
   contact is created. Writing them on every update would hand an account back
   to the website's default owner every time that person returned, and would
   drag somebody who is already an Opportunity — or a Customer — back to
   Marketing Qualified Lead because they booked a second demo. Both are set in
   Vercel, so they change without a deploy of this file:

     HUBSPOT_OWNER_ID          the HubSpot user id of the owner (a number)
     HUBSPOT_LIFECYCLE_STAGE   e.g. marketingqualifiedlead                     */
function onCreateProps() {
  const p = {};
  const owner = env('HUBSPOT_OWNER_ID');
  const stage = env('HUBSPOT_LIFECYCLE_STAGE');
  if (/^\d+$/.test(owner)) p.hubspot_owner_id = owner;
  if (stage) p.lifecyclestage = stage;
  return p;
}

/* ── A LEAD MUST NOT ARRIVE SILENTLY ────────────────────────────────────────
   "It shouldn't just silently update." (client, 2026-09-22.) It was: the
   upsert writes properties, and a property write raises nothing in HubSpot —
   no timeline entry, no feed item, no notification, and for a contact that
   already existed, not even a place in "recently created". The first real
   lead sat in the CRM for an hour and the person who should have called it
   had no way of knowing.

   So every live lead now also writes two things HubSpot *does* surface:

     a NOTE   on the contact's timeline, so the record itself shows what
              happened and when, and the activity feed carries it
     a TASK   due now, assigned to HUBSPOT_OWNER_ID when one is set, which
              lands in that person's HubSpot task queue and in the task
              reminder email HubSpot already sends

   Both are best-effort by design. A CRM that took the lead but refused the
   note is still a CRM that took the lead, so a failure here is logged and
   returned, never thrown, and never changes what the visitor is told.

   Association type ids are HubSpot's own defaults: note→contact 202,
   task→contact 204. */
const NOTE_TO_CONTACT = 202;
const TASK_TO_CONTACT = 204;

function assoc(contactId, typeId) {
  return [{ to: { id: String(contactId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: typeId }] }];
}

/* HubSpot renders a note body as limited HTML, so anything a visitor typed
   has to be escaped before it goes in one */
export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function createNote(contactId, html, fetchImpl) {
  const r = await call('/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: String(html).slice(0, 65000) },
      associations: assoc(contactId, NOTE_TO_CONTACT)
    })
  }, fetchImpl);
  if (r.ok) return { ok: true, id: String(r.data && r.data.id) };
  return { ok: false, status: r.status, error: r.error || 'note_' + r.status, detail: r.raw };
}

export async function createTask(contactId, t, fetchImpl) {
  const props = {
    hs_timestamp: new Date().toISOString(),
    hs_task_subject: String(t.subject || 'New Stagwell AI lead').slice(0, 250),
    hs_task_body: String(t.body || '').slice(0, 65000),
    hs_task_status: 'NOT_STARTED',
    hs_task_priority: t.priority || 'HIGH',
    hs_task_type: 'TODO'
  };
  if (/^\d+$/.test(String(t.ownerId || ''))) props.hubspot_owner_id = String(t.ownerId);
  const r = await call('/crm/v3/objects/tasks', {
    method: 'POST', body: JSON.stringify({ properties: props, associations: assoc(contactId, TASK_TO_CONTACT) })
  }, fetchImpl);
  if (r.ok) return { ok: true, id: String(r.data && r.data.id) };
  return { ok: false, status: r.status, error: r.error || 'task_' + r.status, detail: r.raw };
}

/* ── AND INTO THE LIST SHE ACTUALLY WATCHES ─────────────────────────────────
   HubSpot has no public API for a saved CRM view, and the kind of list this
   portal can be given through a connector is STATIC — a frozen snapshot that
   never gains a row on its own. Which would be useless, except that a static
   list is exactly the kind you can push into: the site adds each contact as
   it lands, so the list collects without anybody maintaining it and without
   needing Marketing Hub for an active list.

   HUBSPOT_LIST_ID names it. Unset, this does nothing at all. Adding a contact
   that is already a member is a no-op at HubSpot's end, so a returning visitor
   costs nothing and duplicates nothing. */
export async function addToList(listId, contactId, fetchImpl) {
  const r = await call('/crm/v3/lists/' + encodeURIComponent(listId) + '/memberships/add', {
    method: 'PUT', body: JSON.stringify([String(contactId)])
  }, fetchImpl);
  if (r.ok) {
    const added = (r.data && Array.isArray(r.data.recordIdsAdded) && r.data.recordIdsAdded.length) ? 'added' : 'already there';
    return { ok: true, id: String(listId), action: added };
  }
  return { ok: false, status: r.status, error: r.error || 'list_' + r.status, detail: r.raw };
}

export function announceScopeHelp(status) {
  return status === 403
    ? 'The HubSpot key needs crm.objects.notes.write, crm.objects.tasks.write and crm.lists.write to raise the timeline note, the task and the list membership. Add them at Development → Keys → Service keys → your key → Scopes.'
    : null;
}

/* ── A LEAD IS NEVER LOST TO A MISSING FIELD ─────────────────────────────────
   If the schema setup has not run — or someone deletes a property in HubSpot —
   the CRM answers a perfectly good lead with 400 PROPERTY_DOESNT_EXIST and
   refuses the WHOLE contact, name and email included. A person who filled in
   the form would reach nobody because of an admin step they never saw.

   So: read which properties it objected to, drop exactly those, and send the
   rest once more. The discovery detail is what degrades; the human being does
   not. `dropped` comes back on the result so the function log says which
   fields fell off and the setup can be run. */
function missingProps(detail) {
  const names = new Set();
  const text = String(detail || '');
  let m;
  /* HubSpot double-encodes this: the body is JSON, and its `message` is itself
     a JSON string, so the quotes around the property name arrive as \" or \\"
     depending on how deep they sit. Allow any run of backslashes. */
  const quoted = /Property\s+\\*"([A-Za-z0-9_]+)\\*"\s+does not exist/gi;
  while ((m = quoted.exec(text))) names.add(m[1]);
  const named = /\\*"name\\*"\s*:\s*\\*"([A-Za-z0-9_]+)/g;
  if (/PROPERTY_DOESNT_EXIST/i.test(text)) { while ((m = named.exec(text))) names.add(m[1]); }
  return [...names];
}

async function withoutMissing(r, properties, send) {
  if (r.ok || r.status !== 400) return r;
  const drop = missingProps(r.detail).filter(n => n in properties);
  if (!drop.length) return r;
  const slim = Object.assign({}, properties);
  drop.forEach(n => { delete slim[n]; });
  if (!slim.email) return r;
  console.error('[hubspot] properties missing from the portal, sending the lead without them —',
    'run scripts/hubspot-setup.mjs or open /hubspot-setup:', drop.join(', '));
  const again = await send(slim);
  return again.ok ? Object.assign({}, again, { dropped: drop }) : again;
}

/* brief §33: find by email → update, else create. One function, HubSpot's
   details stay inside it. */
export async function upsertContact(properties, opts) {
  const o = opts || {};
  const mode = o.mode || hubspotMode();
  if (mode === 'mock') {
    const id = 'mock-' + Math.abs(hash(properties.email || '')).toString(36);
    console.log('[hubspot:mock] would upsert contact', JSON.stringify(redactForLog(Object.assign({}, properties, onCreateProps()))));
    return { ok: true, mode, action: 'mocked', id };
  }
  const found = await findContactByEmail(properties.email, o.fetch);
  if (!found.ok) return Object.assign({ mode }, found);

  let r;
  if (found.id) {
    const send = props => updateContact(found.id, props, o.fetch);
    r = await withoutMissing(await send(properties), properties, send);
  } else {
    const onCreate = Object.assign({}, properties, onCreateProps());
    const send = props => createContact(props, o.fetch);
    r = await withoutMissing(await send(onCreate), onCreate, send);
  }
  if (r.ok && r.action === 'exists') {
    const send = props => updateContact(r.id, props, o.fetch);
    const u = await withoutMissing(await send(properties), properties, send);
    return Object.assign({ mode }, u);
  }
  return Object.assign({ mode }, r);
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

/* what the mock logs: the mapping, with the person reduced to a domain */
export function redactForLog(props) {
  const p = Object.assign({}, props);
  if (p.email) p.email = '@' + String(p.email).split('@')[1];
  if (p.phone) p.phone = '[phone]';
  if (p.firstname) p.firstname = '[first]';
  if (p.lastname) p.lastname = '[last]';
  return p;
}
