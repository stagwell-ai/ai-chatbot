/* ═══════════════════════════════════════════════════════════════════════════
   HUBSPOT SCHEMA SETUP — ensureProperties() and /api/hubspot-setup against a
   faked portal. What matters here is not "did it POST 22 things" but the two
   ways this has already gone wrong in the real world: a property that exists
   in the WRONG group or the WRONG field type must be repaired rather than
   skipped, and a key that cannot do the job must fail once, loudly, instead
   of twenty-two times.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ensureProperties } from '../../api/_lib/leads/setup.js';
import { PROPERTIES, GROUP } from '../../api/_lib/leads/properties.js';
import handler from '../../api/hubspot-setup.js';

const KEY = 'test-service-key-0123456789';

/* a portal that starts with `seed` properties and records what it is told */
function portal(seed, over) {
  const state = new Map((seed || []).map(p => [p.name, Object.assign({}, p)]));
  const calls = [];
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body || {}) });
  const fake = async (url, init) => {
    const path = String(url).replace('https://api.hubapi.com', '');
    const method = (init && init.method) || 'GET';
    calls.push({ path, method, body: init && init.body ? JSON.parse(init.body) : null });
    if (over && over.status) return reply(over.status, { message: over.message || 'no' });

    if (path === '/crm/v3/properties/contacts' && method === 'GET') return reply(200, { results: [...state.values()] });
    if (path === '/crm/v3/properties/contacts/groups') return reply(over && over.groupStatus || 201, {});
    if (path === '/crm/v3/properties/contacts' && method === 'POST') {
      const b = JSON.parse(init.body);
      if (state.has(b.name)) return reply(409, { message: 'exists' });
      state.set(b.name, b);
      return reply(201, b);
    }
    const m = path.match(/^\/crm\/v3\/properties\/contacts\/(.+)$/);
    if (m && method === 'PATCH') {
      const name = decodeURIComponent(m[1]);
      if (over && over.patchStatus) return reply(over.patchStatus, { message: 'nope' });
      state.set(name, Object.assign({}, state.get(name), JSON.parse(init.body)));
      return reply(200, state.get(name));
    }
    return reply(404, {});
  };
  return { fetch: fake, state, calls };
}

const correct = p => ({ name: p.name, label: p.label, type: p.type, fieldType: p.fieldType, groupName: GROUP.name });

test('an empty portal: the group and all 22 properties are created', async () => {
  const p = portal([]);
  const r = await ensureProperties({ token: KEY, fetch: p.fetch });
  assert.equal(r.ok, true);
  assert.equal(r.tally.created, PROPERTIES.length);
  assert.equal(r.tally.failed, 0);
  assert.equal(r.group.state, 'created');
  PROPERTIES.forEach(d => assert.equal(p.state.get(d.name).groupName, GROUP.name, d.name + ' must land in the group'));
  assert.equal(p.state.get('stagwell_ai_conversation_summary').fieldType, 'textarea');
});

test('a property in the wrong group and the wrong field type is REPAIRED, not skipped', async () => {
  /* exactly what the HubSpot MCP connector left behind on 2026-09-22 */
  const p = portal([
    { name: 'stagwell_ai_session_id', type: 'string', fieldType: 'text', groupName: 'custom_information' },
    { name: 'stagwell_ai_conversation_summary', type: 'string', fieldType: 'text', groupName: 'custom_information' }
  ]);
  const r = await ensureProperties({ token: KEY, fetch: p.fetch });
  assert.equal(r.ok, true);
  assert.equal(r.tally.fixed, 2);
  assert.equal(r.tally.created, PROPERTIES.length - 2);

  assert.equal(p.state.get('stagwell_ai_session_id').groupName, GROUP.name);
  const sum = p.state.get('stagwell_ai_conversation_summary');
  assert.equal(sum.groupName, GROUP.name);
  assert.equal(sum.fieldType, 'textarea', 'the long-text field must stop being a one-line box');

  const patched = p.calls.filter(c => c.method === 'PATCH');
  assert.equal(patched.length, 2, 'only the two broken ones are touched');
  patched.forEach(c => assert.deepEqual(Object.keys(c.body).sort(), ['fieldType', 'groupName'],
    'a repair never rewrites a label or a description — those are a human choice'));
});

test('a portal already in the right shape is left completely alone', async () => {
  const p = portal(PROPERTIES.map(correct));
  const r = await ensureProperties({ token: KEY, fetch: p.fetch });
  assert.equal(r.ok, true);
  assert.equal(r.tally.ok, PROPERTIES.length);
  assert.equal(r.tally.created + r.tally.fixed, 0);
  assert.equal(p.calls.filter(c => c.method === 'PATCH' || (c.method === 'POST' && c.path === '/crm/v3/properties/contacts')).length, 0);
});

test('the group already existing (409) is not a failure', async () => {
  const p = portal([], { groupStatus: 409 });
  const r = await ensureProperties({ token: KEY, fetch: p.fetch });
  assert.equal(r.group.state, 'ok');
  assert.equal(r.ok, true);
});

test('a bad key stops at the first read, with the reason named and nothing written', async () => {
  for (const [status, error] of [[401, 'unauthorized'], [403, 'forbidden']]) {
    const p = portal([], { status });
    const r = await ensureProperties({ token: KEY, fetch: p.fetch });
    assert.equal(r.ok, false);
    assert.equal(r.error, error);
    assert.match(r.help, status === 403 ? /crm\.schemas\.contacts\.write/ : /rejected/i);
    assert.equal(p.calls.length, 1, 'one call, not twenty-three');
  }
});

test('no key at all is refused without touching the network', async () => {
  const p = portal([]);
  const r = await ensureProperties({ token: '', fetch: p.fetch });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'no_token');
  assert.equal(p.calls.length, 0);
});

test('a dry run describes the plan and calls nobody', async () => {
  const p = portal([]);
  const r = await ensureProperties({ token: KEY, fetch: p.fetch, dry: true });
  assert.equal(r.ok, true);
  assert.equal(r.properties.length, PROPERTIES.length);
  assert.equal(p.calls.length, 0);
});

test('one property failing makes the whole run not-ok, and says so', async () => {
  const p = portal([{ name: 'stagwell_ai_role', fieldType: 'text', groupName: 'custom_information' }], { patchStatus: 400 });
  const r = await ensureProperties({ token: KEY, fetch: p.fetch });
  assert.equal(r.ok, false);
  assert.equal(r.tally.failed, 1);
  assert.match(r.help, /run this again/i);
});

test('the setup says up front whether the key can also raise notes and tasks', async () => {
  /* a portal that knows properties but refuses engagements — the shape of a
     key created with the three CRM scopes and nothing else */
  const p = portal([]);
  const inner = p.fetch;
  const fetch = async (url, init) => {
    if (/\/crm\/v3\/objects\/(notes|tasks)/.test(String(url)))
      return { ok: false, status: 403, text: async () => '{"message":"missing scope"}' };
    return inner(url, init);
  };
  const r = await ensureProperties({ token: KEY, fetch });
  assert.equal(r.ok, true, 'the properties are still fine');
  assert.deepEqual(r.reach, { notes: 'denied', tasks: 'denied' });
  assert.match(r.reachHelp, /crm\.objects\.notes\.read and \.write/);
  assert.match(r.reachHelp, /Leads will still land/);
});

test('a key that can reach them says so, and offers no scary advice', async () => {
  const p = portal([]);
  const inner = p.fetch;
  const fetch = async (url, init) => {
    if (/\/crm\/v3\/objects\/(notes|tasks)/.test(String(url)))
      return { ok: true, status: 200, text: async () => '{"results":[]}' };
    return inner(url, init);
  };
  const r = await ensureProperties({ token: KEY, fetch });
  assert.deepEqual(r.reach, { notes: 'ok', tasks: 'ok' });
  assert.equal(r.reachHelp, null);
});

/* ── the endpoint ───────────────────────────────────────────────────────── */
function res() {
  const o = { code: 0, body: null, headers: {} };
  o.setHeader = (k, v) => { o.headers[k.toLowerCase()] = v; };
  o.status = c => { o.code = c; return o; };
  o.json = b => { o.body = b; return o; };
  return o;
}
const req = (method, body, headers) => ({ method, body, headers: Object.assign({ 'x-forwarded-for': '10.0.0.' + Math.floor(Math.random() * 250) }, headers) });

beforeEach(() => { delete process.env.HUBSPOT_ACCESS_TOKEN; });

test('endpoint: GET is refused — the key must never ride in a URL', async () => {
  process.env.HUBSPOT_ACCESS_TOKEN = KEY;
  const r = res(); await handler(req('GET'), r);
  assert.equal(r.code, 405);
  assert.equal(r.headers.allow, 'POST');
});

test('endpoint: with no key configured it says so instead of pretending', async () => {
  const r = res(); await handler(req('POST', { key: KEY }), r);
  assert.equal(r.code, 503);
  assert.equal(r.body.error, 'not_configured');
});

test('endpoint: a wrong key is 401 and the right one is not echoed back', async () => {
  process.env.HUBSPOT_ACCESS_TOKEN = KEY;
  for (const given of ['', 'nope', KEY + 'x', KEY.slice(0, -1)]) {
    const r = res(); await handler(req('POST', { key: given }), r);
    assert.equal(r.code, 401, 'rejected: ' + JSON.stringify(given));
    assert.equal(JSON.stringify(r.body).includes(KEY), false, 'the real key never appears in a response');
  }
});

test('endpoint: noindex and no-store on every answer', async () => {
  const r = res(); await handler(req('GET'), r);
  assert.equal(r.headers['x-robots-tag'], 'noindex');
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('endpoint: the right key runs the setup and reports per property', async () => {
  process.env.HUBSPOT_ACCESS_TOKEN = KEY;
  const p = portal([]);
  const real = globalThis.fetch;
  globalThis.fetch = p.fetch;
  try {
    const r = res(); await handler(req('POST', {}, { authorization: 'Bearer ' + KEY }), r);
    assert.equal(r.code, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.properties.length, PROPERTIES.length);
    assert.equal(r.body.tally.created, PROPERTIES.length);
  } finally { globalThis.fetch = real; }
});

/* ── the lead that arrives before the setup has run ─────────────────────── */
import { upsertContact } from '../../api/_lib/leads/hubspot.js';

/* HubSpot's real shape for this: a 400 whose message is a JSON string */
const propertyError = names => JSON.stringify({
  status: 'error',
  message: 'Property values were not valid: ' + JSON.stringify(
    names.map(n => ({ isValid: false, message: 'Property "' + n + '" does not exist', error: 'PROPERTY_DOESNT_EXIST', name: n })))
});

function crm(rejects) {
  const sent = [];
  const fetch = async (url, init) => {
    const path = String(url).replace('https://api.hubapi.com', '');
    if (path.endsWith('/search')) return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }) };
    const props = JSON.parse(init.body).properties;
    sent.push(props);
    const bad = rejects.filter(n => n in props);
    if (bad.length) return { ok: false, status: 400, text: async () => propertyError(bad) };
    return { ok: true, status: 201, text: async () => JSON.stringify({ id: '551' }) };
  };
  return { fetch, sent };
}

test('a contact whose custom fields do not exist yet still lands, without them', async () => {
  process.env.HUBSPOT_ACCESS_TOKEN = KEY;
  const c = crm(['stagwell_ai_conversation_summary', 'stagwell_ai_products_requested']);
  const r = await upsertContact({
    email: 'ada@example.com', firstname: 'Ada', company: 'Example',
    stagwell_ai_conversation_summary: 'wants a demo of The Machine',
    stagwell_ai_products_requested: 'themachine',
    stagwell_ai_primary_product: 'themachine'
  }, { fetch: c.fetch });

  assert.equal(r.ok, true, 'the person reaches the CRM even though the schema is not set up');
  assert.equal(r.id, '551');
  assert.deepEqual(r.dropped.sort(), ['stagwell_ai_conversation_summary', 'stagwell_ai_products_requested']);
  assert.equal(c.sent.length, 2, 'one rejected attempt, then one slimmed retry');
  assert.equal(c.sent[1].email, 'ada@example.com');
  assert.equal(c.sent[1].stagwell_ai_primary_product, 'themachine', 'fields that DO exist are still written');
  assert.equal('stagwell_ai_conversation_summary' in c.sent[1], false);
});

test('a 400 that is not about a missing property is not retried', async () => {
  process.env.HUBSPOT_ACCESS_TOKEN = KEY;
  let calls = 0;
  const fetch = async (url) => {
    if (String(url).endsWith('/search')) return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }) };
    calls++;
    return { ok: false, status: 400, text: async () => JSON.stringify({ message: 'Email address is invalid' }) };
  };
  const r = await upsertContact({ email: 'nope', firstname: 'Ada' }, { fetch });
  assert.equal(r.ok, false);
  assert.equal(calls, 1, 'retrying an invalid email would just fail twice');
});
