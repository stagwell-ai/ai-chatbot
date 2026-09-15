/* /api/callback — the pure half: what makes a callable lead, and what the
   automation receives. No network; the webhook fetch is injected. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT } from './_data.mjs';

const { buildCallback, toE164, newSessionId, forward } = await import(path.join(ROOT, 'api', 'callback.js'));

const GOOD = { first_name: 'Yannick', last_name: 'Näf', email: 'Yannick.Naef@ramseier.ch', dial_code: '41', national_number: '076 328 4000' };

test('a number without a country is refused — a national number nobody can dial is not a lead', () => {
  assert.equal(toE164('', '7632840000').error, 'country_required');
  assert.equal(toE164(null, '7632840000').field, 'dial_code');
  assert.equal(buildCallback(Object.assign({}, GOOD, { dial_code: '' })).error, 'country_required');
  /* a whole number pasted in must carry its own + */
  assert.equal(toE164(null, null, '0763284000').error, 'country_required');
  assert.equal(toE164(null, null, '+41 76 328 40 00').phone, '+41763284000');
  /* a country we do not offer is refused rather than guessed at */
  assert.equal(toE164('999', '1234567').error, 'unknown_country');
});

test('country + number become one E.164 string, the trunk zero dropped', () => {
  assert.equal(toE164('41', '076 328 4000').phone, '+41763284000', 'the client\'s own example');
  assert.equal(toE164('41', '763284000').phone, '+41763284000', 'with or without the leading zero');
  assert.equal(toE164('1', '(415) 555-0134').phone, '+14155550134');
  assert.equal(toE164('44', '020 7946 0958').phone, '+442079460958');
  assert.equal(toE164('41', '123').error, 'bad_phone', 'too short');
  assert.equal(toE164('41', '1234567890123456').error, 'bad_phone', 'too long');
  assert.equal(toE164('1', '415 555 0134').dial, '1', 'the dial code is kept alongside');
});

test('the name and a real email are required before anyone is called', () => {
  assert.equal(buildCallback(Object.assign({}, GOOD, { first_name: '  ' })).error, 'first_name_required');
  assert.equal(buildCallback(Object.assign({}, GOOD, { last_name: '' })).error, 'last_name_required');
  assert.equal(buildCallback(Object.assign({}, GOOD, { email: 'not-an-email' })).error, 'bad_email');
  assert.equal(buildCallback(Object.assign({}, GOOD, { email: 'a@b' })).error, 'bad_email');
  assert.equal(buildCallback({}).ok, false);
  const bad = buildCallback({});
  assert.equal(bad.status, 400);
  assert.ok(bad.field, 'a 400 always names the field that failed');
});

test('the payload is exactly the five fields the automation maps, with our context under meta', () => {
  const r = buildCallback(GOOD, { sessionId: 90903, now: Date.parse('2026-09-15T10:00:00Z') });
  assert.equal(r.ok, true);
  const p = r.payload;
  assert.deepEqual(Object.keys(p).sort(), ['email', 'first_name', 'last_name', 'meta', 'phone', 'session_id']);
  assert.equal(p.session_id, 90903);
  assert.equal(p.email, 'yannick.naef@ramseier.ch', 'lower-cased');
  assert.equal(p.first_name, 'Yannick');
  assert.equal(p.last_name, 'Näf');
  assert.equal(p.phone, '+41763284000');
  assert.equal(p.meta.dial_code, '41', 'the country survives in its own right');
  assert.equal(p.meta.request, 'call_my_phone');
  assert.equal(p.meta.consent, 'ai_voice_call_and_recording', 'what they agreed to is recorded with the lead');
  assert.equal(p.meta.requested_at, '2026-09-15T10:00:00.000Z');
  /* the shape of the client's example, field for field */
  const example = { session_id: 90903, email: 'yannick.naef@ramseier.ch', first_name: 'Yannick', last_name: 'Näf', phone: '+41763284000' };
  Object.keys(example).forEach(k => assert.equal(p[k], example[k], k + ' matches the example'));
});

test('a session id is a number, and two in the same millisecond differ', () => {
  const a = newSessionId(1789000000000, 0.1), b = newSessionId(1789000000000, 0.9);
  assert.equal(typeof a, 'number');
  assert.notEqual(a, b);
  assert.ok(String(newSessionId()).length >= 10);
});

test('forwarding: the webhook URL comes from the environment and a failure is reported, never swallowed', async () => {
  let seen = null;
  const okFetch = async (u, i) => { seen = { u, i }; return { ok: true, status: 200 }; };
  const r = await forward({ session_id: 1 }, { CALLBACK_WEBHOOK_URL: 'https://example.test/hook' }, okFetch);
  assert.equal(r.delivered, true);
  assert.equal(seen.u, 'https://example.test/hook');
  assert.equal(seen.i.method, 'POST');
  assert.equal(JSON.parse(seen.i.body).session_id, 1);

  const unset = await forward({}, {}, okFetch);
  assert.equal(unset.delivered, false);
  assert.equal(unset.reason, 'no_webhook_configured', 'without the variable nothing is sent anywhere');

  const bad = await forward({}, { CALLBACK_WEBHOOK_URL: 'https://example.test/hook' }, async () => ({ ok: false, status: 500 }));
  assert.equal(bad.delivered, false);
  assert.equal(bad.reason, 'webhook_http_500');

  const down = await forward({}, { CALLBACK_WEBHOOK_URL: 'https://example.test/hook' }, async () => { throw new Error('nope'); });
  assert.equal(down.delivered, false);
  assert.equal(down.reason, 'webhook_network');
});

test('the handler: POST only, rate limited, and a lead that was not handed on is not a 200', async () => {
  const { default: handler } = await import(path.join(ROOT, 'api', 'callback.js'));
  const call = async (method, body, ip) => {
    let status = 0, json = null;
    const res = { setHeader() {}, status(s) { status = s; return res; }, json(j) { json = j; return res; } };
    await handler({ method, headers: { 'x-forwarded-for': ip || '198.51.100.7' }, body }, res);
    return { status, json };
  };
  assert.equal((await call('GET')).status, 405);
  const bad = await call('POST', { first_name: 'A' }, '198.51.100.8');
  assert.equal(bad.status, 400);
  assert.equal(bad.json.field, 'last_name');
  /* no webhook configured in the test environment → 502, never a false success */
  const saved = process.env.CALLBACK_WEBHOOK_URL;
  delete process.env.CALLBACK_WEBHOOK_URL;
  const out = await call('POST', GOOD, '198.51.100.9');
  assert.equal(out.status, 502);
  assert.equal(out.json.ok, false);
  assert.equal(out.json.delivered, false);
  assert.ok(out.json.session_id, 'the session id comes back even so');
  assert.ok(!JSON.stringify(out.json).includes('http'), 'the reply never carries a URL');
  if (saved !== undefined) process.env.CALLBACK_WEBHOOK_URL = saved;
  /* six an hour per address; the seventh is turned away */
  for (let i = 0; i < 6; i++) await call('POST', GOOD, '198.51.100.20');
  assert.equal((await call('POST', GOOD, '198.51.100.20')).status, 429);
});
