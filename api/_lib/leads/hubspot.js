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
    return { status: r.status, ok: r.ok, data, raw: raw.slice(0, 300) };
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

/* brief §33: find by email → update, else create. One function, HubSpot's
   details stay inside it. */
export async function upsertContact(properties, opts) {
  const o = opts || {};
  const mode = o.mode || hubspotMode();
  if (mode === 'mock') {
    const id = 'mock-' + Math.abs(hash(properties.email || '')).toString(36);
    console.log('[hubspot:mock] would upsert contact', JSON.stringify(redactForLog(properties)));
    return { ok: true, mode, action: 'mocked', id };
  }
  const found = await findContactByEmail(properties.email, o.fetch);
  if (!found.ok) return Object.assign({ mode }, found);
  const r = found.id ? await updateContact(found.id, properties, o.fetch) : await createContact(properties, o.fetch);
  if (r.ok && r.action === 'exists') {
    const u = await updateContact(r.id, properties, o.fetch);
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
