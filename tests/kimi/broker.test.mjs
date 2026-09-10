/* ═══════════════════════════════════════════════════════════════════════════
   BROKER — brief §49C: for each provider, valid output, timeout, 429, 500,
   malformed JSON, wrong schema, empty response — and that failover happens.
   fetch is faked per test; no network, no keys.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { structured, chainConfig, describeChain, buildChain } from '../../api/_lib/llm/broker.js';
import { validateInterpretation, validateExplanation } from '../../api/_lib/llm/schemas.js';
import { parseSlot } from '../../api/_lib/llm/providers.js';

const VOCAB = { goalIds: ['competition'], intentIds: ['competitive_activity', 'ai_search_visibility'], sizeBands: ['smb', 'mid_market', 'enterprise'], creatorBands: ['under_100', '100_plus'], geoBands: ['single_market', 'global'] };
const GOOD = JSON.stringify({ detectedGoals: ['competition'], detectedIntents: ['competitive_activity', 'made_up'], inferred: { industry: 'hospitality', companySize: 'enterprise', creatorProgramSize: null, geographicScope: null }, userNeedSummary: 'Wants live competitor signal.', confidence: 0.9 });

const openaiBody = content => JSON.stringify({ model: 'm', choices: [{ message: { content } }] });
const anthropicBody = content => JSON.stringify({ model: 'a', content: [{ type: 'text', text: content }] });
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body });

function fakeFetch(script) {
  /* script: array of handlers by call order; each returns a Response-like or throws */
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
    const h = script[Math.min(calls.length - 1, script.length - 1)];
    if (h.signal === 'timeout') { await new Promise(r => setTimeout(r, 200)); const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
    if (h.throw) throw new Error('ECONNRESET');
    return resp(h.status, h.body);
  };
  fn.calls = calls;
  return fn;
}

const CFG = { enabled: true, slots: ['kimi/k', 'openai/o', 'anthropic/a'], timeoutMs: 100, deadlineMs: 2000 };
beforeEach(() => { process.env.LLM_API_KEY = 'sk-test-kimi-secret'; process.env.OPENAI_API_KEY = 'sk-test-openai-secret'; process.env.ANTHROPIC_API_KEY = 'sk-ant-test-secret'; delete process.env.KIMI_LLM_ENABLED; });

const req = () => ({ system: 's', user: 'u', maxTokens: 100, json: true, validate: p => validateInterpretation(p, VOCAB) });

test('primary answers → used; unknown ids dropped by the schema', async () => {
  const f = fakeFetch([{ status: 200, body: openaiBody(GOOD) }]);
  const r = await structured(req(), { config: CFG, fetch: f });
  assert.equal(r.ok, true);
  assert.equal(r.telemetry.provider, 'kimi/k');
  assert.equal(r.telemetry.chainIndex, 0);
  assert.deepEqual(r.value.detectedIntents, ['competitive_activity']);
  assert.equal(r.value.inferred.companySize, 'enterprise');
  assert.equal(f.calls.length, 1);
});

for (const [name, first, retried] of [
  ['timeout', { signal: 'timeout' }, false],
  ['429', { status: 429, body: '{"error":"rate"}' }, true],
  ['500', { status: 500, body: 'boom' }, true],
  ['malformed JSON', { status: 200, body: openaiBody('this is not json at all') }, false],
  ['wrong schema', { status: 200, body: openaiBody('{"answer": 42}') }, false],
  ['empty response', { status: 200, body: openaiBody('') }, false],
  ['network error', { throw: true }, true]
]) {
  test('primary ' + name + ' → secondary takes over', async () => {
    /* a transient error earns one retry on the primary before the hand-over;
       bad output hands over at once — so the good answer sits at call 3 or 2 */
    const f = fakeFetch(retried ? [first, first, { status: 200, body: openaiBody(GOOD) }] : [first, { status: 200, body: openaiBody(GOOD) }]);
    const r = await structured(req(), { config: CFG, fetch: f });
    assert.equal(r.ok, true, name + ' should still succeed via secondary');
    assert.equal(r.telemetry.provider, 'openai/o');
    assert.equal(r.telemetry.chainIndex, 1);
    assert.equal(r.telemetry.fallbacks, 1);
    assert.ok(r.telemetry.failed.includes('kimi/k'));
  });
}

test('one bounded retry on a transient error, none on bad output', async () => {
  const f1 = fakeFetch([{ status: 500, body: '' }, { status: 200, body: openaiBody(GOOD) }]);
  const r1 = await structured(req(), { config: CFG, fetch: f1 });
  assert.equal(r1.telemetry.provider, 'kimi/k', 'retry on the same provider after a 500');
  assert.equal(f1.calls.length, 2);
  const f2 = fakeFetch([{ status: 200, body: openaiBody('nope') }, { status: 200, body: openaiBody(GOOD) }]);
  const r2 = await structured(req(), { config: CFG, fetch: f2 });
  assert.equal(r2.telemetry.provider, 'openai/o', 'unparseable output moves on at once');
  assert.equal(f2.calls.length, 2);
});

test('secondary fails too → tertiary (Anthropic shape) answers', async () => {
  const f = fakeFetch([{ status: 500, body: '' }, { status: 500, body: '' }, { status: 429, body: '' }, { status: 429, body: '' }, { status: 200, body: anthropicBody(GOOD) }]);
  const r = await structured(req(), { config: CFG, fetch: f });
  assert.equal(r.ok, true);
  assert.equal(r.telemetry.provider, 'anthropic/a');
  assert.equal(r.telemetry.chainIndex, 2);
  assert.equal(r.telemetry.fallbacks, 2);
  assert.ok(f.calls[4].url.includes('/v1/messages'));
});

test('everything fails → ok:false, deterministic mode for the caller', async () => {
  const f = fakeFetch([{ status: 503, body: '' }]);
  const r = await structured(req(), { config: CFG, fetch: f });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'exhausted');
  assert.equal(r.telemetry.fallbacks, 3);
  assert.equal(r.telemetry.provider, null);
});

test('a provider with no key is skipped without a network call', async () => {
  delete process.env.OPENAI_API_KEY;
  const f = fakeFetch([{ status: 500, body: '' }, { status: 500, body: '' }, { status: 200, body: anthropicBody(GOOD) }]);
  const r = await structured(req(), { config: CFG, fetch: f });
  assert.equal(r.telemetry.provider, 'anthropic/a');
  assert.ok(f.calls.every(c => !c.url.includes('openai')));
});

test('the total deadline stops the chain', async () => {
  const f = fakeFetch([{ signal: 'timeout' }]);
  const r = await structured(req(), { config: Object.assign({}, CFG, { timeoutMs: 150, deadlineMs: 250 }), fetch: f });
  assert.equal(r.ok, false);
  assert.ok(r.telemetry.ms < 1500, 'gave up within the deadline (' + r.telemetry.ms + 'ms)');
});

test('KIMI_LLM_ENABLED=false → no call at all', async () => {
  const f = fakeFetch([{ status: 200, body: openaiBody(GOOD) }]);
  const r = await structured(req(), { config: Object.assign({}, CFG, { enabled: false }), fetch: f });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'disabled');
  assert.equal(f.calls.length, 0);
});

test('chain configuration comes from the environment, health never leaks a key', () => {
  process.env.KIMI_PRIMARY_MODEL = 'openai/gpt-4o-mini';
  process.env.KIMI_SECONDARY_MODEL = 'kimi/kimi-for-coding-highspeed';
  process.env.KIMI_TERTIARY_MODEL = 'off';
  const c = chainConfig();
  assert.deepEqual(c.slots, ['openai/gpt-4o-mini', 'kimi/kimi-for-coding-highspeed', '']);
  const d = describeChain(c);
  assert.equal(d.chain.length, 2);
  assert.ok(!JSON.stringify(d).includes(process.env.OPENAI_API_KEY));
  assert.deepEqual(parseSlot('xai/grok-3-mini'), { vendor: 'xai', model: 'grok-3-mini', id: 'xai/grok-3-mini' });
  assert.equal(parseSlot('nope/x'), null);
  assert.equal(buildChain({ slots: ['', '', ''] }).length, 0);
  delete process.env.KIMI_PRIMARY_MODEL; delete process.env.KIMI_SECONDARY_MODEL; delete process.env.KIMI_TERTIARY_MODEL;
});

test('explanation schema rejects figures, URLs and markdown', () => {
  assert.equal(validateExplanation({ why: 'NewIntel fits because you want live competitor signal; it tracks pricing, hiring and coverage as they change.' }).why.length > 20, true);
  assert.equal(validateExplanation({ why: 'It lifts sales by 40% for most clients.' }), null);
  assert.equal(validateExplanation({ why: 'Read more at https://example.com for the details of it.' }), null);
  assert.equal(validateExplanation({ why: 'short' }), null);
  assert.equal(validateExplanation({ why: '**NewIntel** is the strongest fit because you want current competitor activity.' }).why.startsWith('NewIntel'), true);
});
