/* ═══════════════════════════════════════════════════════════════════════════
   LEADS — brief §49E against a faked HubSpot: new contact, existing contact,
   field mapping, custom properties, retry/error behaviour, no secret leaks,
   duplicate prevention; plus the server-side revalidation of the payload.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DATA } from './_data.mjs';
import { validateLeadBody, salesSummary, normalizePhone } from '../../api/_lib/leads/schema.js';
import { toHubSpotProperties, PROPERTIES } from '../../api/_lib/leads/properties.js';
import { upsertContact } from '../../api/_lib/leads/hubspot.js';
import { submitLead } from '../../api/_lib/leads/leadService.js';

const BODY = () => ({
  lead: { name: 'Ada Lovelace', email: 'Ada@Example-Brand.com', phone: '+1 (212) 555-0100', company: 'Example Brand' },
  discovery: { sessionId: 'k_test', primaryGoal: 'competition', rawProblemText: 'We need competitor pricing and hiring signals this week',
    intents: [{ id: 'competitive_activity', explicit: true }, { id: 'not_real', explicit: true }], companySize: 'enterprise', askedQuestionIds: ['competition_type', 'company_size'], steps: 2,
    primary: 'questdiy', secondary: [], confidence: { level: 'high' }, llmStatus: 'DETERMINISTIC', industry: 'hospitality',
    attribution: { utmSource: 'linkedin', utmCampaign: 'launch', landingPage: '/next?utm_source=linkedin', referrer: 'https://linkedin.com/' } },
  page: '/next', ts: '2026-09-10T10:00:00.000Z'
});

beforeEach(() => { delete process.env.HUBSPOT_ACCESS_TOKEN; delete process.env.HUBSPOT_MOCK; delete process.env.LEAD_WEBHOOK_URL; delete process.env.KIMI_HUBSPOT_ENABLED; });

test('validation: normalises email and phone, splits the name, drops unknown intents, RECOMPUTES the recommendation', () => {
  const v = validateLeadBody(BODY(), DATA);
  assert.equal(v.ok, true);
  assert.equal(v.lead.email, 'Ada@example-brand.com');
  assert.equal(v.lead.phone, '+12125550100');
  assert.equal(v.lead.firstname, 'Ada'); assert.equal(v.lead.lastname, 'Lovelace');
  assert.deepEqual(v.lead.discovery.intents.map(i => i.id), ['competitive_activity']);
  assert.equal(v.lead.discovery.primary, 'newintel', 'the client claimed QuestDIY; the signals say NewIntel');
  assert.equal(v.lead.discovery.claimedPrimary, 'questdiy');
  assert.equal(v.lead.attribution.utmSource, 'linkedin');
});

test('validation: rejects a missing name, a bad email, a bad phone, an oversized payload', () => {
  const noName = BODY(); noName.lead.name = '  ';
  assert.equal(validateLeadBody(noName, DATA).error, 'name_required');
  const badMail = BODY(); badMail.lead.email = 'ada at example';
  assert.equal(validateLeadBody(badMail, DATA).error, 'email_invalid');
  const badPhone = BODY(); badPhone.lead.phone = '12';
  assert.equal(validateLeadBody(badPhone, DATA).error, 'phone_invalid');
  const big = BODY(); big.discovery.rawProblemText = 'x'.repeat(30000);
  assert.equal(validateLeadBody(big, DATA).error, 'payload_too_large');
  assert.equal(normalizePhone('020 7946 0958'), '02079460958');
});

test('the older flat payload (previous homepage form) still validates', () => {
  const v = validateLeadBody({ name: 'Bo', email: 'bo@x.io', phone: null, problems: ['competitive'], product: 'QuestBrand' }, DATA);
  assert.equal(v.ok, true);
  assert.equal(v.lead.phone, null);
});

test('field mapping: every custom property written exists in the definitions; the summary reads like a person wrote it', () => {
  const v = validateLeadBody(BODY(), DATA);
  const summary = salesSummary(v.lead, DATA);
  const props = toHubSpotProperties(v.lead, summary);
  const defined = new Set(PROPERTIES.map(p => p.name).concat(['email', 'firstname', 'lastname', 'phone', 'company']));
  Object.keys(props).forEach(k => assert.ok(defined.has(k), 'undefined property ' + k));
  assert.equal(props.stagwell_ai_primary_product, 'newintel');
  assert.equal(props.stagwell_ai_company_size, 'enterprise');
  assert.equal(props.stagwell_ai_utm_source, 'linkedin');
  assert.equal(props.stagwell_ai_recommendation_confidence, 0.9);
  assert.match(summary, /Primary recommendation: NewIntel/);
  assert.match(summary, /hospitality company, 2,500\+ people/);
  assert.ok(!summary.includes('Ada@'), 'no email in the summary');
});

test('mock mode (no token): upsert returns a synthetic id, makes no network call, logs the domain not the address', async () => {
  const logs = [];
  const orig = console.log; console.log = (...a) => logs.push(a.join(' '));
  let fetched = 0;
  try {
    const r = await upsertContact({ email: 'ada@example-brand.com', firstname: 'Ada', phone: '+12125550100', stagwell_ai_primary_product: 'newintel' }, { fetch: async () => { fetched++; } });
    assert.equal(r.mode, 'mock'); assert.equal(r.action, 'mocked'); assert.ok(r.id.startsWith('mock-'));
  } finally { console.log = orig; }
  assert.equal(fetched, 0);
  assert.ok(logs.some(l => l.includes('[hubspot:mock]')));
  assert.ok(!logs.join(' ').includes('ada@example-brand.com'), 'address never logged');
  assert.ok(logs.join(' ').includes('@example-brand.com'));
});

function hubspotFake(existingId, opts) {
  const o = opts || {};
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null, auth: init.headers.authorization });
    if (o.failWith) return { ok: false, status: o.failWith, text: async () => '{"message":"down"}' };
    if (url.endsWith('/contacts/search')) return { ok: true, status: 200, text: async () => JSON.stringify({ results: existingId ? [{ id: existingId }] : [] }) };
    if (init.method === 'POST' && url.endsWith('/contacts')) {
      if (o.conflict) return { ok: false, status: 409, text: async () => JSON.stringify({ message: 'Contact already exists. Existing ID: 777' }) };
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: '101' }) };
    }
    if (init.method === 'PATCH') return { ok: true, status: 200, text: async () => JSON.stringify({ id: url.split('/').pop() }) };
    return { ok: false, status: 404, text: async () => '' };
  };
  fn.calls = calls;
  return fn;
}

test('live mode: new contact → search then create; existing → search then PATCH (no duplicate)', async () => {
  process.env.HUBSPOT_ACCESS_TOKEN = 'pat-secret';
  const f1 = hubspotFake(null);
  const r1 = await upsertContact({ email: 'new@x.io', firstname: 'N' }, { fetch: f1 });
  assert.equal(r1.action, 'created'); assert.equal(r1.id, '101');
  assert.deepEqual(f1.calls.map(c => c.method), ['POST', 'POST']);
  assert.equal(f1.calls[0].body.filterGroups[0].filters[0].value, 'new@x.io');
  const f2 = hubspotFake('555');
  const r2 = await upsertContact({ email: 'old@x.io', firstname: 'O', stagwell_ai_primary_product: 'bera' }, { fetch: f2 });
  assert.equal(r2.action, 'updated'); assert.equal(r2.id, '555');
  assert.equal(f2.calls[1].method, 'PATCH');
  assert.ok(!('email' in f2.calls[1].body.properties), 'the identifier is not rewritten');
  assert.ok(f2.calls.every(c => c.auth === 'Bearer pat-secret'));
});

test('live mode: a 409 on create resolves to an update of the existing id', async () => {
  process.env.HUBSPOT_ACCESS_TOKEN = 'pat';
  const f = hubspotFake(null, { conflict: true });
  const r = await upsertContact({ email: 'race@x.io' }, { fetch: f });
  assert.equal(r.ok, true); assert.equal(r.action, 'updated'); assert.equal(r.id, '777');
});

test('live mode: HubSpot down → the lead is not lost silently (LEAD_UNDELIVERED logged), response says delivered:false + retryable', async () => {
  process.env.HUBSPOT_ACCESS_TOKEN = 'pat';
  const errs = [];
  const orig = console.error; console.error = (...a) => errs.push(a.join(' '));
  let out;
  try { out = await submitLead(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: hubspotFake(null, { failWith: 503 }) }); }
  finally { console.error = orig; }
  assert.equal(out.delivered, false);
  assert.equal(out.retryable, true);
  assert.ok(errs.some(l => l.startsWith('LEAD_UNDELIVERED')));
  assert.ok(!errs.join(' ').includes('Ada@example-brand.com'), 'the address is redacted in the failure log');
  assert.ok(errs.join(' ').includes('competitive_activity'), 'the discovery is kept for replay');
});

test('lead service: mock HubSpot + configured webhook → delivered via the webhook, HubSpot mocked', async () => {
  process.env.LEAD_WEBHOOK_URL = 'https://hooks.example.com/lead';
  const calls = [];
  const f = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 }; };
  const out = await submitLead(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: f });
  assert.equal(out.delivered, true);
  assert.equal(out.results.find(r => r.destination === 'hubspot').mode, 'mock');
  assert.equal(out.results.find(r => r.destination === 'webhook').ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.discovery.primary, 'newintel');
  assert.ok(calls[0].body.summary);
});

test('lead service: KIMI_HUBSPOT_ENABLED=false skips HubSpot entirely', async () => {
  process.env.KIMI_HUBSPOT_ENABLED = 'false';
  const out = await submitLead(validateLeadBody(BODY(), DATA).lead, DATA, { fetch: async () => { throw new Error('should not be called'); } });
  assert.equal(out.mode, 'off');
  assert.equal(out.results.length, 0);
});
