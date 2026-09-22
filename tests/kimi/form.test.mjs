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
  'Agent Cloud', 'The Media Machine', 'NewIntel', 'Search+', 'Stagwell ID Graph', 'Not Sure'];

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

test('ticked nothing: the field says "Not Sure" rather than guessing for them', () => {
  const none = BODY();
  none.discovery.productsRequested = [];
  const lead = validateLeadBody(none, DATA).lead;
  assert.equal(productFieldValue(lead, DATA), 'Not Sure');
  /* and NOT the engine's own pick: one value routes to that product's owner,
     so a guess there hands a visitor to a specialist they never asked for */
  assert.equal(productFieldValue(lead, DATA), lead.discovery.primary ? 'Not Sure' : 'Not Sure');
  assert.ok(OPTIONS.indexOf('Not Sure') !== -1, 'and the portal offers it');

  process.env.HUBSPOT_FORM_PRODUCT_FALLBACK = 'none';
  assert.equal(productFieldValue(lead, DATA), null, 'or nothing at all, without a deploy');
  process.env.HUBSPOT_FORM_PRODUCT_FALLBACK = 'Unsure';
  assert.equal(productFieldValue(lead, DATA), 'Unsure', 'renamed in HubSpot is an env var, not a release');
  delete process.env.HUBSPOT_FORM_PRODUCT_FALLBACK;
});

/* ── THE WORDS ON THE PAGE ARE THE WORDS IN THE CRM ─────────────────────────
   The tick-boxes on /book are labelled from solutions.json, and the value sent
   to HubSpot is derived from the same field. This holds BOTH against the
   portal's actual option list, read from property
   stagwell_ai_form_solution_drop_down on 2026-09-22. A product renamed on the
   site without being renamed in HubSpot fails here rather than in a rejected
   submission nobody sees. */
test('every name on the website is, verbatim, an option in HubSpot', () => {
  const active = (DATA.solutions.solutions || DATA.solutions).filter(p => p.active !== false);
  const shown = active.map(p => p.displayName || p.name);
  shown.forEach(n => assert.ok(OPTIONS.indexOf(n) !== -1,
    'the site offers "' + n + '", which the CRM field does not have'));
  assert.equal(shown.length, OPTIONS.length - 1,
    'and the two lists are the same length once "Not Sure" is set aside — ' +
    'site ' + shown.length + ', CRM ' + (OPTIONS.length - 1));
  OPTIONS.filter(o => o !== 'Not Sure').forEach(o => assert.ok(shown.indexOf(o) !== -1,
    'HubSpot offers "' + o + '", which is on no tick-box'));
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

/* ── THE FORM NAMES ITS OWN FIELDS ──────────────────────────────────────────
   The first live submission was rejected outright:
     Error in 'fields.work_email'. Required field 'work_email' is missing
   That form calls the email field `work_email`. Nothing about that is
   knowable from this side, so it is configuration. */
test('a field can be renamed to whatever the form calls it', () => {
  process.env.HUBSPOT_FORM_FIELD_MAP = 'email:work_email,jobtitle:title';
  const f = formFields(validateLeadBody(BODY(), DATA).lead, DATA);
  const names = f.map(x => x.name);
  assert.ok(names.indexOf('work_email') !== -1, 'sent under the form’s name');
  assert.equal(names.indexOf('email'), -1, 'and not under ours as well');
  assert.equal(f.find(x => x.name === 'work_email').value, 'ada@example-brand.com');
  assert.ok(names.indexOf('title') !== -1 && names.indexOf('jobtitle') === -1);
  assert.ok(names.indexOf('firstname') !== -1, 'anything unmapped keeps its own name');
  delete process.env.HUBSPOT_FORM_FIELD_MAP;
});

test('a field mapped to nothing is dropped, for a form that has no such field', () => {
  process.env.HUBSPOT_FORM_FIELD_MAP = 'phone:,company:';
  const names = formFields(validateLeadBody(BODY(), DATA).lead, DATA).map(x => x.name);
  assert.equal(names.indexOf('phone'), -1);
  assert.equal(names.indexOf('company'), -1);
  assert.ok(names.indexOf('email') !== -1, 'the rest are untouched');
  delete process.env.HUBSPOT_FORM_FIELD_MAP;
});

test('a malformed map is ignored rather than silently renaming things', () => {
  process.env.HUBSPOT_FORM_FIELD_MAP = 'nonsense,,:orphan,email:work_email';
  const names = formFields(validateLeadBody(BODY(), DATA).lead, DATA).map(x => x.name);
  assert.ok(names.indexOf('work_email') !== -1, 'the good pair still applies');
  assert.ok(names.indexOf('firstname') !== -1);
  delete process.env.HUBSPOT_FORM_FIELD_MAP;
});

test('a one-word name sends no lastname — which a form requiring one will reject', () => {
  /* exactly what happened on 2026-09-22: "TEST" typed into a single Full name
     box, no surname to send, and the form requires one. Recorded here so the
     day somebody changes the name field, this test says what it was for. */
  const body = BODY();
  body.lead.name = 'TEST';
  const f = formFields(validateLeadBody(body, DATA).lead, DATA);
  assert.equal(f.find(x => x.name === 'firstname').value, 'TEST');
  assert.equal(f.find(x => x.name === 'lastname'), undefined);
});

/* ── THE DOMAIN DECIDES WHETHER THE LEAD IS BINNED ──────────────────────────
   HubSpot files a submission under the site domain in context.pageUri and
   quarantines one it does not recognise — after answering 200, so it looks
   like success from here. The site answers on three names, so reporting a
   single configured one would be right on one and wrong on two. */
import { originFor, siteHosts } from '../../api/_lib/leads/hubspot-form.js';

test('the submission is filed under the host the visitor was actually on', () => {
  assert.equal(originFor('beta.stagwell.ai'), 'https://beta.stagwell.ai');
  assert.equal(originFor('stagwell.ai'), 'https://stagwell.ai');
  assert.equal(originFor('stagwell-ai-prototypes.vercel.app'), 'https://stagwell-ai-prototypes.vercel.app');
  assert.equal(originFor('BETA.STAGWELL.AI'), 'https://beta.stagwell.ai', 'case is not a different domain');
  assert.equal(originFor('beta.stagwell.ai:443'), 'https://beta.stagwell.ai', 'nor is a port');
});

test('a host we do not know is not believed — it would end up in the CRM', () => {
  const fall = 'https://stagwell-ai-prototypes.vercel.app';
  ['evil.example.com', 'stagwell.ai.evil.com', '', 'not a host', 'localhost:3000'].forEach(h => {
    assert.equal(originFor(h), fall, JSON.stringify(h) + ' must not be reported as ours');
  });
});

test('a forwarded list of hosts uses the first, as proxies write it', () => {
  assert.equal(originFor('stagwell.ai, 10.0.0.1'), 'https://stagwell.ai');
});

test('the host list is configuration, and SITE_ORIGIN is always part of it', () => {
  process.env.SITE_HOSTS = 'one.example.com';
  process.env.SITE_ORIGIN = 'https://two.example.com';
  const hosts = siteHosts();
  assert.deepEqual(hosts.sort(), ['one.example.com', 'two.example.com']);
  assert.equal(originFor('two.example.com'), 'https://two.example.com');
  assert.equal(originFor('stagwell.ai'), 'https://two.example.com', 'no longer in the list, so not honoured');
  delete process.env.SITE_HOSTS; delete process.env.SITE_ORIGIN;
});

test('the pageUri that actually goes to HubSpot carries that host', async () => {
  const p = portal();
  await submitForm(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: p.fetch, host: 'beta.stagwell.ai' });
  assert.equal(p.posts[0].body.context.pageUri, 'https://beta.stagwell.ai/book');
});

test('the page can be withheld entirely, so there is no domain to quarantine', async () => {
  process.env.HUBSPOT_FORM_SEND_PAGE = 'false';
  const p = portal();
  await submitForm(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: p.fetch, host: 'beta.stagwell.ai' });
  assert.equal(p.posts[0].body.context.pageUri, undefined, 'no page, so no site domain');
  assert.equal(p.posts[0].body.fields.length > 0, true, 'and the lead itself is untouched');
  delete process.env.HUBSPOT_FORM_SEND_PAGE;
});

test('the outcome carries the product VALUE, so nobody has to infer it from a field name', async () => {
  const none = BODY();
  none.discovery.productsRequested = [];
  const p = portal();
  const r = await submitForm(validateLeadBody(none, DATA).lead, DATA, { fetch: p.fetch });
  assert.equal(r.product, 'Not Sure', 'answerable by reading, not by reasoning');

  const p2 = portal();
  const r2 = await submitForm(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: p2.fetch });
  assert.equal(r2.product, 'BERA.ai;GEOPulse');

  /* and still no trace of the person */
  const p3 = portal({ status: 400 });
  const r3 = await submitForm(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: p3.fetch });
  const logged = JSON.stringify({ sent: r3.sent, product: r3.product });
  ['ada@example-brand.com', 'Ada', 'Lovelace', '2125550100'].forEach(pii =>
    assert.equal(logged.indexOf(pii), -1, 'no personal detail reaches the log: ' + pii));
});
