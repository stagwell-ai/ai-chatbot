/* ═══════════════════════════════════════════════════════════════════════════
   FINDING OUT WHAT IS ON THE FORM, INSTEAD OF WAITING TO BE TOLD.

   The first live submission failed on a field name only the form's author
   knew. Asking her cost a day. A HubSpot form's definition is public — it is
   what the embed script downloads — so this reads it, and falls back to
   reading the names out of a rejection HubSpot would give anyone.

   The rule the tests hold: a probe must never be capable of creating
   anything. A rejected submission writes nothing, so the payload is built so
   it cannot be accepted.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeForm, suggestMap } from '../../api/_lib/leads/form-probe.js';

const PORTAL = '24060959';
const GUID = 'be36ba60-e0ba-4fb4-ac43-6fbcdb91e6c4';

/* the shape HubSpot actually serves: fields nested inside groups */
const DEFINITION = {
  guid: GUID,
  formFieldGroups: [
    { fields: [{ name: 'work_email', label: 'Work email', fieldType: 'text', required: true }] },
    { fields: [{ name: 'firstname', label: 'First name', fieldType: 'text', required: false },
               { name: 'lastname', label: 'Last name', fieldType: 'text', required: true }] },
    { fields: [{ name: 'title', label: 'Job title', fieldType: 'text', required: false },
               { name: 'stagwell_ai_form_solution_drop_down', label: 'Product', fieldType: 'checkbox', required: false }] }
  ]
};

const reply = (ok, status, body) => ({ ok, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

test('the public definition gives every field, its type and whether it is required', async () => {
  const seen = [];
  const fetch = async url => { seen.push(String(url)); return reply(true, 200, DEFINITION); };
  const r = await describeForm({ portalId: PORTAL, guid: GUID, fetch });

  assert.equal(r.ok, true);
  assert.equal(r.source, 'definition');
  assert.equal(seen.length, 1, 'no probe submission was needed');
  assert.match(seen[0], /forms\.hsforms\.com\/embed\/v3\/form\/24060959\//);

  const names = r.fields.map(f => f.name);
  assert.deepEqual(names.sort(), ['firstname', 'lastname', 'stagwell_ai_form_solution_drop_down', 'title', 'work_email']);
  assert.equal(r.fields.find(f => f.name === 'work_email').required, true);
  assert.equal(r.fields.find(f => f.name === 'title').required, false);
});

test('and it works out the mapping we would otherwise have had to ask for', async () => {
  const fetch = async () => reply(true, 200, DEFINITION);
  const r = await describeForm({ portalId: PORTAL, guid: GUID, fetch });
  const pairs = r.suggestion.split(',');
  assert.ok(pairs.indexOf('email:work_email') !== -1, 'the field that broke the first submission');
  assert.ok(pairs.indexOf('jobtitle:title') !== -1);
  assert.ok(pairs.indexOf('phone:') !== -1, 'a field the form does not define is dropped, not sent');
  assert.ok(pairs.indexOf('company:') !== -1);
  assert.equal(r.suggestion.indexOf('firstname:'), -1, 'what already matches is left alone');
  assert.equal(r.suggestion.indexOf('stagwell_ai_form_solution_drop_down:'), -1);
});

/* the real portal, 2026-09-22: firstname, work_email and jobtitle required;
   the product dropdown present but optional; phone and company not on the
   form at all */
function realPortal() {
  const sent = [];
  const fetch = async (url, init) => {
    if (String(url).indexOf('/embed/v3/') !== -1) return reply(false, 404, 'no');
    const body = JSON.parse(init.body);
    sent.push(body);
    const names = body.fields.map(f => f.name);
    const errs = [];
    ['firstname', 'work_email', 'jobtitle'].forEach(n => {
      if (names.indexOf(n) === -1) errs.push({ message: "Error in 'fields." + n + "'. Required field '" + n + "' is missing", errorType: 'REQUIRED_FIELD' });
    });
    ['phone', 'company', 'email', 'lastname'].forEach(n => {
      if (n !== 'lastname' && n !== 'email' && names.indexOf(n) !== -1) errs.push({ message: "Error in 'fields." + n + "'. The field \"" + n + "\" does not exist", errorType: 'INVALID_FIELD' });
      if ((n === 'email') && names.indexOf(n) !== -1) errs.push({ message: "Error in 'fields.email'. The field \"email\" does not exist", errorType: 'INVALID_FIELD' });
    });
    return reply(false, 400, { status: 'error', errors: errs });
  };
  return { fetch, sent };
}

test('no definition: required names come from a rejection, optional ones from a second pass', async () => {
  const p = realPortal();
  const r = await describeForm({ portalId: PORTAL, guid: GUID, fetch: p.fetch });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'probe');
  assert.equal(r.partial, true);
  assert.equal(p.sent.length, 2, 'two probes: what is required, then what exists');

  const req = r.fields.filter(f => f.required).map(f => f.name).sort();
  assert.deepEqual(req, ['firstname', 'jobtitle', 'work_email']);

  assert.ok(r.absent.indexOf('phone') !== -1 && r.absent.indexOf('company') !== -1,
    'the form refused these, so they are proven absent: ' + JSON.stringify(r.absent));
  assert.ok(r.fields.some(f => f.name === 'stagwell_ai_form_solution_drop_down' && !f.required),
    'and the dropdown is found, optional — the field the whole integration turns on');
  assert.match(r.help, /Nothing was created/);
});

/* ── THE BUG THIS EXISTS TO PREVENT ─────────────────────────────────────────
   The first version read only the REQUIRED fields, did not find the product
   dropdown among them — because it is optional, not because it is absent —
   and suggested dropping it. That field is the entire point of the
   integration: without it nothing routes. */
test('a field that is merely unseen is NEVER suggested for dropping', () => {
  const onlyRequired = ['firstname', 'work_email', 'jobtitle'].map(name => ({ name, required: true }));
  const s = suggestMap(onlyRequired, { partial: true });
  assert.ok(s.map.indexOf('email:work_email') !== -1, 'a rename we can see is still made');
  assert.equal(s.map.indexOf('stagwell_ai_form_solution_drop_down:'), -1,
    'the dropdown must not be dropped on the strength of a partial reading');
  assert.equal(s.map.indexOf('phone:'), -1);
  assert.deepEqual(s.unsure.sort(), ['company', 'lastname', 'phone', 'stagwell_ai_form_solution_drop_down'],
    'they are handed to a human instead');
});

test('but a field HubSpot has actually refused IS dropped', () => {
  const s = suggestMap(['firstname', 'work_email'].map(name => ({ name, required: true })),
    { partial: true, absent: ['phone', 'company'] });
  assert.ok(s.map.indexOf('phone:') !== -1);
  assert.ok(s.map.indexOf('company:') !== -1);
  assert.equal(s.unsure.indexOf('phone'), -1);
});

test('NEITHER PROBE CAN CREATE ANYTHING', async () => {
  const sent = [];
  const fetch = async (url, init) => {
    if (String(url).indexOf('/embed/v3/') !== -1) return reply(false, 500, 'nope');
    sent.push(JSON.parse(init.body));
    return reply(false, 400, { errors: [{ message: "Error in 'fields.work_email'. Required field 'work_email' is missing" }] });
  };
  await describeForm({ portalId: PORTAL, guid: GUID, fetch });
  assert.equal(sent.length, 2);

  const first = sent[0].fields.map(f => f.name);
  assert.deepEqual(first, ['__stagwell_ai_probe__'], 'one field, and no form has it');

  const second = sent[1].fields.map(f => f.name);
  assert.equal(second.indexOf('work_email'), -1,
    'the one field we KNOW is required is withheld, so this rejection is certain too');
  assert.equal(second.some(n => /^email$|work_email/.test(n) && n === 'work_email'), false);
  sent.forEach(s2 => s2.fields.forEach(f => assert.equal(f.value, 'probe', 'nothing real is ever sent')));
});

test('a probe that somehow succeeds is reported as wrong, not as a result', async () => {
  const fetch = async url => (String(url).indexOf('/embed/v3/') !== -1 ? reply(false, 404, 'no') : reply(true, 200, {}));
  const r = await describeForm({ portalId: PORTAL, guid: GUID, fetch });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'probe_accepted');
  assert.match(r.help, /should not happen/);
});

test('neither route working says so plainly, with what HubSpot said', async () => {
  const fetch = async () => reply(false, 404, 'Form not found');
  const r = await describeForm({ portalId: PORTAL, guid: GUID, fetch });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'unreadable');
  assert.match(r.help, /Form not found/);
});

test('with nothing configured it asks for nothing', async () => {
  let calls = 0;
  const fetch = async () => { calls++; return reply(true, 200, {}); };
  const r = await describeForm({ portalId: '', guid: GUID, fetch });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'not_configured');
  assert.equal(calls, 0);
});

test('a form that already matches us needs no mapping at all', () => {
  const same = ['email', 'firstname', 'lastname', 'jobtitle', 'phone', 'company', 'stagwell_ai_form_solution_drop_down']
    .map(name => ({ name, required: false }));
  assert.equal(suggestMap(same).map, '');
});
