/* ═══════════════════════════════════════════════════════════════════════════
   VOICE — sprint 1: the spoken agent's brief, the session mint, the event
   reducer. No network; the mint's fetch is injected.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DATA, R, ROOT } from './_data.mjs';

const require = createRequire(import.meta.url);
const VR = require(path.join(ROOT, 'next', 'voice-reducer.js'));
const { buildInstructions, buildTools, buildSession, STEPS } = await import(path.join(ROOT, 'api', '_lib', 'voice', 'instructions.js'));
const { mintSession, voiceConfig } = await import(path.join(ROOT, 'api', 'voice', 'session.js'));

const active = R.activeProducts(DATA);

/* ── the brief ─────────────────────────────────────────────────────────────── */
test('the brief carries the client\'s nine steps, in order', () => {
  const s = buildInstructions(DATA);
  assert.equal(STEPS.length, 9);
  let at = -1;
  STEPS.forEach((step, i) => { const j = s.indexOf(`${i + 1}) ${step}`); assert.ok(j > at, 'step ' + (i + 1) + ' in order'); at = j; });
});

test('the brief names every active product with its catalog line, and no URL, price or number of its own', () => {
  const s = buildInstructions(DATA);
  active.forEach(p => {
    assert.ok(s.includes(p.name), p.name + ' named');
    const line = (p.cardDescription || p.positioning || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    assert.ok(s.includes(line.slice(0, 60)), p.name + ' with its own line');
  });
  assert.ok(!/https?:\/\//i.test(s), 'no URLs');
  assert.ok(!/\$\s?\d/.test(s), 'no prices');
  assert.ok(!/Unlock/.test(s), 'inactive products are not named');
});

test('the brief states the house rules: never invent, tools move the steps, typed answers for websites/emails/phones, say what is shown', () => {
  const s = buildInstructions(DATA);
  ['NEVER INVENT', 'submit_answer', 'request_contact', 'start_over', 'TYPED ANSWERS', 'input:"typed"', 'on screen rather than reading it out', 'Speak the language the visitor speaks', 'transcribed'].forEach(k => assert.ok(s.includes(k), k));
  assert.ok(!/repeat it back exactly as you understood/.test(s), 'no spelling by ear');
  assert.ok(/do not offer to take it aloud/.test(s), 'typed, not offered aloud');
});

test('the brief opens as NewVoices, from the copy, once', () => {
  const s = buildInstructions(DATA);
  assert.ok(s.includes('You are NewVoices'), 'named NewVoices');
  assert.ok(s.includes(DATA.kimi.copy.voice.introduction), 'the introduction is the copy\'s line');
  assert.ok(/revolutionary AI voice agent/.test(s));
  assert.ok(/Never repeat the introduction/.test(s));
});

test('resuming adds what is known and the current step, capped', () => {
  const s = buildInstructions(DATA, { resume: { summary: 'x'.repeat(2000), step: 'their role' } });
  assert.ok(s.includes('RESUMING') && s.includes('The current step is their role'));
  assert.ok(s.length < buildInstructions(DATA).length + 1200, 'the summary is capped');
});

test('the tools are the flow\'s hands: submit_answer(text), request_contact(kind ∈ the fast-track kinds), start_over()', () => {
  const t = buildTools();
  assert.deepEqual(t.map(x => x.name), ['submit_answer', 'request_contact', 'start_over']);
  t.forEach(x => { assert.equal(x.type, 'function'); assert.ok(x.description.length > 40); assert.equal(x.parameters.type, 'object'); });
  const kinds = t[1].parameters.properties.kind.enum;
  const known = DATA.taxonomy.contactRequests.map(c => c.id).sort();
  assert.deepEqual(kinds.slice().sort(), known, 'the kinds are taxonomy.json\'s');
  assert.deepEqual(t[0].parameters.required, ['text']);
});

test('the session object: realtime, the configured model and voice, transcription on, semantic VAD that interrupts, tools attached', () => {
  const s = buildSession(DATA, { VOICE_MODEL: 'gpt-realtime-mini', VOICE_NAME: 'cedar' });
  assert.equal(s.type, 'realtime');
  assert.equal(s.model, 'gpt-realtime-mini');
  assert.equal(s.audio.output.voice, 'cedar');
  assert.equal(s.audio.input.transcription.model, 'gpt-4o-mini-transcribe');
  assert.equal(s.audio.input.turn_detection.type, 'semantic_vad');
  assert.equal(s.audio.input.turn_detection.interrupt_response, true);
  assert.equal(s.tools.length, 3);
  assert.ok(s.max_output_tokens > 0);
  const d = buildSession(DATA, {});
  assert.equal(d.model, 'gpt-realtime'); assert.equal(d.audio.output.voice, 'marin');
});

/* ── the mint ──────────────────────────────────────────────────────────────── */
test('voiceConfig: off without a key, on with one, caps from env with sane defaults', () => {
  assert.equal(voiceConfig({}).enabled, false);
  assert.equal(voiceConfig({}).keyConfigured, false);
  const on = voiceConfig({ OPENAI_API_KEY: 'sk-test', VOICE_SESSION_SECONDS: '300' });
  assert.equal(on.enabled, true);
  assert.equal(on.caps.sessionSeconds, 300);
  assert.equal(on.caps.mintsPerHour, 6);
  assert.equal(on.caps.silenceMuteSeconds, 90);
  assert.equal(voiceConfig({ OPENAI_API_KEY: 'sk-test', VOICE_ENABLED: 'off' }).enabled, false);
});

test('mintSession posts the session to client_secrets with the key, and returns the secret — never the key', async () => {
  let seen = null;
  const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ value: 'ek_test_123', expires_at: 1700000000, session: { id: 'sess_1' } }) }; };
  const r = await mintSession({ page: '/s/newintel' }, { OPENAI_API_KEY: 'sk-secret-KEY', VOICE_MODEL: 'gpt-realtime' }, fetchImpl);
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.value, 'ek_test_123');
  assert.equal(r.json.model, 'gpt-realtime');
  assert.ok(!JSON.stringify(r.json).includes('sk-secret'), 'the key is not in the reply');
  assert.ok(seen.url.endsWith('/realtime/client_secrets'));
  assert.equal(seen.init.headers.authorization, 'Bearer sk-secret-KEY');
  const body = JSON.parse(seen.init.body);
  assert.equal(body.session.type, 'realtime');
  assert.equal(body.expires_after.seconds, 120);
  assert.ok(body.session.instructions.includes('THE PAGE'), 'the page is passed into the brief');
  assert.equal(body.session.tools.length, 3);
});

test('mintSession: no key → 503 voice_unconfigured; OpenAI error → 502 mint_failed with a short detail; network → 504', async () => {
  assert.equal((await mintSession({}, {}, async () => { throw new Error('should not be called'); })).json.error, 'voice_unconfigured');
  const bad = await mintSession({}, { OPENAI_API_KEY: 'sk' }, async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Incorrect API key provided: sk-… you can find your API key at …' } }) }));
  assert.equal(bad.status, 502); assert.equal(bad.json.error, 'mint_failed'); assert.ok(bad.json.detail.length <= 200);
  const net = await mintSession({}, { OPENAI_API_KEY: 'sk' }, async () => { throw new TypeError('fetch failed'); });
  assert.equal(net.status, 504); assert.equal(net.json.error, 'mint_network');
});

test('mintSession: a resume summary is passed through, capped', async () => {
  let body = null;
  await mintSession({ resume: { summary: 'y'.repeat(5000), step: 'their phone number' } }, { OPENAI_API_KEY: 'sk' }, async (u, i) => { body = JSON.parse(i.body); return { ok: true, status: 200, json: async () => ({ value: 'ek', expires_at: 1 }) }; });
  assert.ok(body.session.instructions.includes('RESUMING'));
  assert.ok(body.session.instructions.includes('their phone number'));
  assert.ok(body.session.instructions.length < 12000);
});

/* ── the reducer ───────────────────────────────────────────────────────────── */
const run = events => { let st = VR.blank(); const ops = []; events.forEach(e => { const r = VR.reduce(st, e); st = r.state; ops.push(...r.ops); }); return { st, ops }; };

test('the visitor\'s speech: interim deltas fill one bubble, the completed transcript finalises it', () => {
  const { ops } = run([
    { type: 'input_audio_buffer.speech_started' },
    { type: 'conversation.item.input_audio_transcription.delta', item_id: 'u1', delta: 'acme' },
    { type: 'conversation.item.input_audio_transcription.delta', item_id: 'u1', delta: 'hotels.com' },
    { type: 'input_audio_buffer.speech_stopped' },
    { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'acmehotels.com' }
  ]);
  assert.deepEqual(ops.map(o => o.op), ['user.speaking', 'me.interim', 'me.interim', 'user.silent', 'me.final']);
  assert.equal(ops[2].text, 'acmehotels.com');
  assert.equal(ops[4].text, 'acmehotels.com');
});

test('the agent\'s speech: start, streamed transcript, done, end — GA and beta event names alike', () => {
  for (const [delta, done] of [['response.output_audio_transcript.delta', 'response.output_audio_transcript.done'], ['response.audio_transcript.delta', 'response.audio_transcript.done']]) {
    const { ops, st } = run([
      { type: 'response.created', response: { id: 'r1' } },
      { type: 'response.output_item.added', item: { id: 'a1', type: 'message', role: 'assistant' } },
      { type: 'output_audio_buffer.started' },
      { type: delta, item_id: 'a1', delta: 'What\'s your ' },
      { type: delta, item_id: 'a1', delta: 'website?' },
      { type: done, item_id: 'a1', transcript: 'What\'s your website?' },
      { type: 'output_audio_buffer.stopped' },
      { type: 'response.done', response: { id: 'r1', status: 'completed' } }
    ]);
    assert.deepEqual(ops.map(o => o.op), ['ai.start', 'agent.speaking', 'ai.delta', 'ai.delta', 'ai.done', 'agent.silent', 'ai.end']);
    assert.equal(ops[3].text, 'What\'s your website?');
    assert.equal(st.response, null);
    assert.equal(st.speaking, false);
  }
});

test('barge-in: the visitor speaking over the agent cuts its bubble off; a cancelled response does too', () => {
  const a = run([
    { type: 'response.created', response: { id: 'r1' } },
    { type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'Let me tell you about' },
    { type: 'input_audio_buffer.speech_started' }
  ]);
  assert.ok(a.ops.some(o => o.op === 'ai.cutoff' && o.itemId === 'a1'), 'cut off on speech_started');
  const b = run([
    { type: 'response.created', response: { id: 'r2' } },
    { type: 'response.output_audio_transcript.delta', item_id: 'a2', delta: 'Here is' },
    { type: 'response.done', response: { id: 'r2', status: 'cancelled' } }
  ]);
  assert.ok(b.ops.some(o => o.op === 'ai.cutoff' && o.itemId === 'a2'), 'cut off on cancel');
  assert.equal(b.ops.filter(o => o.op === 'ai.cutoff').length, 1, 'once');
});

test('a tool call surfaces once, with parsed arguments, whichever event carries it', () => {
  const { ops } = run([
    { type: 'response.created', response: { id: 'r1' } },
    { type: 'response.function_call_arguments.done', call_id: 'c1', name: 'submit_answer', arguments: '{"text":"we need to track competitors"}' },
    { type: 'response.output_item.done', item: { type: 'function_call', call_id: 'c1', name: 'submit_answer', arguments: '{"text":"we need to track competitors"}' } },
    { type: 'response.done', response: { id: 'r1', status: 'completed' } }
  ]);
  const calls = ops.filter(o => o.op === 'tool.call');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { op: 'tool.call', callId: 'c1', name: 'submit_answer', args: { text: 'we need to track competitors' } });
  /* malformed arguments do not throw */
  const bad = run([{ type: 'response.function_call_arguments.done', call_id: 'c2', name: 'start_over', arguments: '{oops' }]);
  assert.deepEqual(bad.ops[0].args, {});
});

test('session.ready once; errors are surfaced short; unknown events are no-ops', () => {
  const { ops } = run([{ type: 'session.created' }, { type: 'session.updated' }, { type: 'rate_limits.updated' }, { type: 'error', error: { code: 'x', message: 'm'.repeat(500) } }, { type: 'something.new' }]);
  assert.deepEqual(ops.map(o => o.op), ['session.ready', 'error']);
  assert.ok(ops[1].message.length <= 200);
});

test('client events: a typed line, a tool result, a cancel, a session update — the shapes the API takes', () => {
  const ut = VR.clientEvents.userText('hello');
  assert.equal(ut[0].type, 'conversation.item.create'); assert.equal(ut[0].item.role, 'user'); assert.equal(ut[0].item.content[0].type, 'input_text'); assert.equal(ut[1].type, 'response.create');
  const tr = VR.clientEvents.toolResult('c1', { say: 'ok' });
  assert.equal(tr[0].item.type, 'function_call_output'); assert.equal(tr[0].item.call_id, 'c1'); assert.deepEqual(JSON.parse(tr[0].item.output), { say: 'ok' }); assert.equal(tr[1].type, 'response.create');
  assert.deepEqual(VR.clientEvents.cancel().map(e => e.type), ['response.cancel', 'output_audio_buffer.clear']);
  assert.equal(VR.clientEvents.sessionUpdate({ instructions: 'x' })[0].session.instructions, 'x');
});
