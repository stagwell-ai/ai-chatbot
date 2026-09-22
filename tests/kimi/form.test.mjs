/* ═══════════════════════════════════════════════════════════════════════════
   THE FORM SUBMISSION — the event a Contacts API write cannot make.

   "My workflow triggers on a HubSpot form submission event, so it has to come
   in as a real form fill or leads won't enroll and won't route."
   (Eriel Pettiford, who runs the portal, relayed 2026-09-22.)

   The thing most worth guarding is the dropdown. "The form has to send the
   exact internal values, not the labels, or the lead won't route" — so these
   tests hold the values the site sends against the OPTIONS THE PORTAL
   ACTUALLY HAS, read from HubSpot on the day and pinned here. A mapping table
   written by hand would agree with itself forever and with HubSpot never.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DATA } from './_data.mjs';
import { validateLeadBody } from '../../api/_lib/leads/schema.js';
import { submitForm, formFields, productValues, productFieldValue, formMode } from '../../api/_lib/leads/hubspot-form.js';
import { submitLead } from '../../api/_lib/leads/leadService.js';

/* stagwell_ai_form_solution_drop_down, read from portal 24060959 on
   2026-09-22. If the site ever sends something outside this set, the lead
   reaches HubSpot and stops dead instead of routing. */
const OPTIONS = ['QuestBrand', 'QuestDIY', 'BERA.ai', 'The Knowledge Machine', 'UNICEPTA', 'IMAI',
  'Stagwell AI for SMBs', 'GEOPulse', 'The Targeting Machine', 'Numetrix', 'NewVoices', 'The Machine',
  'Agent Cloud', 'The Media Machine', 'NewIntel', 'Search+', 'Stagwell ID Graph'];

const GUID = '11111111-2222-3333-4444-555555555555';
const BODY = () => ({
  lead: { name: 'Ada Lovelace', email: 'ada@example-brand.com', phone: '+1 212 555 0100', company: 'Example Brand' },
  discovery: { sessionId: 'k_form', primaryGoal: 'competition', rawProblemText: 'competitor pricing and hiring signals',
    roleText: 'VP Marketing', productsRequested: ['bera', 'geopulse'], steps: 1,
    attribution: { landingPage: '/book' } },
  page: '/book', ts: '2026-09-22T10:00:00.000Z'
});

function portal(over) {
  const posts = [];
  const fetch = async (url, init) => {
    posts.push({ url: String(url), body: JSON.parse(init.body) });
    if (over && over.status) return { ok: false, status: over.status, text: async () => over.text || '{"message":"no"}' };
    return { ok: true, status: 200, text: async () => '{"inlineMessage":"Thanks"}' };
  };
  return { fetch, posts };
}

beforeEach(() => {
  process.env.HUBSPOT_PORTAL_ID = '24060959';
  process.env.HUBSPOT_FORM_GUID = GUID;
  delete process.env.HUBSPOT_MOCK;
  delete process.env.HUBSPOT_FORM_PRODUCT_FIELD;
});

test('every value the field can be sent is one the portal actually offers', () => {
  const seen = new Set();
  (DATA.solutions.solutions || DATA.solutions).forEach(p => {
    if (p.active === false) return;
    const body = BODY();
    body.discovery.productsRequested = [p.id];
    productValues(validateLeadBody(body, DATA).lead, DATA).forEach(v => {
      seen.add(v);
      assert.ok(OPTIONS.indexOf(v) !== -1,
        p.id + ' would send "' + v + '", which the field has never heard of');
    });
  });
  assert.ok(seen.size >= 15, 'and nearly all of them map to something (' + seen.size + ')');
});

/* ── THE COUNT IS LOAD-BEARING ───────────────────────────────────────────────
   "Multiple selections route to our catch-all owner, single selection routes
   to that product's owner." So how many values we send decides who picks up
   the phone. Sending only the first tick would route a three-product lead to
   one product's owner as though they had asked for one thing. */
test('all of their ticks go, semicolon separated, in the order they ticked them', () => {
  const body = BODY();
  body.discovery.productsRequested = ['bera', 'smb_platform', 'geopulse'];
  const lead = validateLeadBody(body, DATA).lead;
  assert.deepEqual(productValues(lead, DATA), ['BERA.ai', 'Stagwell AI for SMBs', 'GEOPulse']);
  assert.equal(productFieldValue(lead, DATA), 'BERA.ai;Stagwell AI for SMBs;GEOPulse');
});

test('one tick is ONE value, so a single-product lead still reaches that product’s owner', () => {
  const body = BODY();
  body.discovery.productsRequested = ['bera'];
  const lead = validateLeadBody(body, DATA).lead;
  assert.equal(productFieldValue(lead, DATA), 'BERA.ai');
  assert.equal(productFieldValue(lead, DATA).indexOf(';'), -1, 'a stray separator would route this to catch-all');
});

test('the same product ticked twice is still one selection', () => {
  const body = BODY();
  body.discovery.productsRequested = ['bera', 'bera'];
  const lead = validateLeadBody(body, DATA).lead;
  assert.equal(productFieldValue(lead, DATA), 'BERA.ai', 'a duplicate must not read as "multiple"');
});

test('ticked nothing: our recommendation, as ONE value — or none at all if she prefers', () => {
  const none = BODY();
  none.discovery.productsRequested = [];
  const lead = validateLeadBody(none, DATA).lead;
  const v = productValues(lead, DATA);
  assert.equal(v.length, 1, 'a guess is never allowed to look like a multi-select');
  assert.ok(OPTIONS.indexOf(v[0]) !== -1, 'and it is a real option: ' + v[0]);

  process.env.HUBSPOT_FORM_PRODUCT_FALLBACK = 'none';
  assert.equal(productFieldValue(lead, DATA), null, 'turned off without a deploy');
  delete process.env.HUBSPOT_FORM_PRODUCT_FALLBACK;
});

test('an unknown or retired product is dropped, never guessed at', () => {
  const body = BODY();
  body.discovery.productsRequested = ['not_a_product'];
  const lead = validateLeadBody(body, DATA).lead;
  productValues(lead, DATA).forEach(v => assert.ok(OPTIONS.indexOf(v) !== -1));
});

test('the fields are the six she asked for, by internal name, and no others', () => {
  const f = formFields(validateLeadBody(BODY(), DATA).lead, DATA);
  const names = f.map(x => x.name);
  assert.deepEqual(names.slice(0, 6), ['email', 'firstname', 'lastname', 'jobtitle', 'phone', 'company']);
  assert.equal(names[6], 'stagwell_ai_form_solution_drop_down', 'the internal name, not the label');
  assert.equal(names.length, 7, 'a form rejects a field it does not define');
  assert.equal(f.find(x => x.name === 'firstname').value, 'Ada');
  assert.equal(f.find(x => x.name === 'lastname').value, 'Lovelace');
  assert.equal(f.find(x => x.name === 'jobtitle').value, 'VP Marketing');
  f.forEach(x => assert.equal(x.objectTypeId, '0-1', 'contact fields'));
});

test('the property the dropdown lands in can be repointed without a deploy', () => {
  process.env.HUBSPOT_FORM_PRODUCT_FIELD = 'something_else';
  const names = formFields(validateLeadBody(BODY(), DATA).lead, DATA).map(x => x.name);
  assert.ok(names.indexOf('something_else') !== -1);
  assert.equal(names.indexOf('stagwell_ai_form_solution_drop_down'), -1);
});

test('with no guid configured it does nothing at all, rather than posting somewhere wrong', async () => {
  for (const guid of ['', 'not-a-guid', GUID.slice(0, -1)]) {
    process.env.HUBSPOT_FORM_GUID = guid;
    assert.equal(formMode(), 'off', JSON.stringify(guid));
    const p = portal();
    const r = await submitForm(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: p.fetch });
    assert.equal(r.action, 'skipped');
    assert.equal(p.posts.length, 0);
  }
});

test('it posts to the portal and form it was given', async () => {
  const p = portal();
  const r = await submitForm(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: p.fetch });
  assert.equal(r.ok, true);
  assert.equal(p.posts.length, 1);
  assert.equal(p.posts[0].url, 'https://api.hsforms.com/submissions/v3/integration/submit/24060959/' + GUID);
  assert.ok(p.posts[0].body.submittedAt > 0, 'HubSpot dates the submission');
  assert.match(p.posts[0].body.context.pageUri, /\/book$/);
});

test('a form that refuses the submission does not stop the lead reaching the CRM', async () => {
  const seen = [];
  const fetch = async (url, init) => {
    const u = String(url);
    if (u.indexOf('hsforms.com') !== -1) return { ok: false, status: 400, text: async () => '{"message":"Error in \'fields.stagwell_ai_form_solution_drop_down\'"}' };
    if (u.indexOf('/contacts/search') !== -1) return { ok: true, status: 200, text: async () => '{"results":[]}' };
    seen.push(u);
    return { ok: true, status: 201, text: async () => '{"id":"901"}' };
  };
  process.env.HUBSPOT_ACCESS_TOKEN = 'pat-test';
  try {
    const out = await submitLead(validateLeadBody(BODY(), DATA).lead, DATA, { fetch });
    assert.equal(out.delivered, true, 'the Contacts API still carried it');
    const form = out.results.find(r => r.destination === 'hubspot-form');
    assert.equal(form.ok, false, 'and the failure is reported, not hidden');
    assert.ok(seen.some(u => u.indexOf('/crm/v3/objects/contacts') !== -1));
  } finally { delete process.env.HUBSPOT_ACCESS_TOKEN; }
});

test('the form goes FIRST, so her workflow enrols before we add the detail', async () => {
  const order = [];
  const fetch = async (url) => {
    const u = String(url);
    if (u.indexOf('hsforms.com') !== -1) { order.push('form'); return { ok: true, status: 200, text: async () => '{}' }; }
    if (u.indexOf('/contacts/search') !== -1) return { ok: true, status: 200, text: async () => '{"results":[]}' };
    if (u.indexOf('/crm/v3/objects/contacts') !== -1) { order.push('contact'); return { ok: true, status: 201, text: async () => '{"id":"901"}' }; }
    return { ok: true, status: 200, text: async () => '{}' };
  };
  process.env.HUBSPOT_ACCESS_TOKEN = 'pat-test';
  process.env.HUBSPOT_NOTE_ENABLED = 'false';
  process.env.HUBSPOT_TASK_ENABLED = 'false';
  try {
    await submitLead(validateLeadBody(BODY(), DATA).lead, DATA, { fetch });
    assert.deepEqual(order, ['form', 'contact']);
  } finally {
    delete process.env.HUBSPOT_ACCESS_TOKEN;
    delete process.env.HUBSPOT_NOTE_ENABLED; delete process.env.HUBSPOT_TASK_ENABLED;
  }
});

test('mock mode posts no form anywhere', async () => {
  process.env.HUBSPOT_MOCK = 'true';
  assert.equal(formMode(), 'mock');
  const p = portal();
  const r = await submitForm(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: p.fetch });
  assert.equal(p.posts.length, 0);
  assert.equal(r.action, 'skipped');
  delete process.env.HUBSPOT_MOCK;
});
