/* ═══════════════════════════════════════════════════════════════════════════
   VOICE — sprint 1: the spoken agent's brief, the session mint, the event
   reducer. No network; the mint's fetch is injected.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { DATA, R, ROOT } from './_data.mjs';

const require = createRequire(import.meta.url);
const VR = require(path.join(ROOT, 'next', 'voice-reducer.js'));
const { buildInstructions, buildTools, buildSession, openingScript, greetingLine, turnDetection, STEPS } = await import(path.join(ROOT, 'api', '_lib', 'voice', 'instructions.js'));
const { mintSession, voiceConfig, default: voiceHandler } = await import(path.join(ROOT, 'api', 'voice', 'session.js'));

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
  ['NEVER INVENT', 'submit_answer', 'request_contact', 'start_over', 'TYPED ANSWERS', 'input:"typed"', 'on screen rather than reading it out', 'Speak English', 'transcribed'].forEach(k => assert.ok(s.includes(k), k));
  assert.ok(!/repeat it back exactly as you understood/.test(s), 'no spelling by ear');
  assert.ok(/do not offer to take it aloud/.test(s), 'typed, not offered aloud');
});

test('the brief opens as NewVoices, from the copy, once — and then STOPS and waits (the opening in two beats)', () => {
  const s = buildInstructions(DATA);
  const V = DATA.kimi.copy.voice;
  assert.ok(s.includes('You are NewVoices'), 'named NewVoices');
  assert.ok(s.includes(V.introduction), 'the introduction is the copy\'s line');
  assert.ok(/revolutionary AI voice agent/.test(s));
  assert.ok(s.includes(greetingLine(DATA)) && greetingLine(DATA) === V.introduction + ' ' + V.invite, 'the greeting is the introduction and the invitation, word for word');
  assert.ok(/then STOP and wait/.test(s), 'and then it waits — the visitor speaks first');
  assert.ok(/Do not describe the products/.test(s) && /do not ask the first step's question yet/.test(s), 'no product list, no first question, unasked');
  assert.ok(/on their screen as buttons/.test(s), 'it knows the questions are pills on screen');
  assert.ok(/IS step 1/.test(s) && /call submit_answer with their words/.test(s), 'what they then say or tap is step 1');
  assert.ok(/Never repeat the greeting or the introduction/.test(s));
  /* the starters themselves: real questions, the hero one named in the brief */
  const st = V.starters;
  assert.ok(Array.isArray(st.questions) && st.questions.length >= 3 && st.questions.length <= 5, st.questions.length + ' starter questions');
  st.questions.forEach(q => assert.ok(/\?$/.test(q) && q.length <= 70, 'a short question: ' + q));
  assert.ok(/competitors/i.test(st.questions.join(' ')) && /influencer/i.test(st.questions.join(' ')) && /AI search/i.test(st.questions.join(' ')), 'competitors, influencers, AI search — the client\'s examples');
  assert.equal(st.hero, 'What is Stagwell AI?');
  assert.ok(s.includes('by tapping "' + st.hero + '"'), 'the hero pill is named in the brief');
});

/* ── the story: the showcase, told when asked ───────────────────────────────── */
test('the story: the interruption line → flagship → each showcased product in order → the pivot; real products, real pictures, told slowly', () => {
  const V = DATA.kimi.copy.voice, sc = V.showcase;
  const s = openingScript(DATA);
  assert.ok(!s.includes(V.introduction), 'the introduction is NOT in the story — it was said at the greeting');
  assert.ok(s.startsWith(sc.interrupt) && /interrupt me any time/i.test(sc.interrupt), 'opens by saying they may interrupt ("' + sc.interrupt.slice(0, 40) + '…")');
  let at = s.indexOf(sc.flagship); assert.ok(at > 0, 'then the flagship line');
  assert.ok(sc.flagship.toLowerCase().includes(sc.openOn.toLowerCase()), 'the flagship line carries the word that raises the stage when asked aloud: ' + sc.openOn);
  assert.ok(sc.products.length >= 4 && sc.products.length <= 6, sc.products.length + ' products — about 25 s');
  sc.products.forEach(p => {
    const P = R.productById(p.id, DATA);
    assert.ok(P && P.active !== false, p.id + ' is an active product');
    assert.ok(p.line.includes(P.name), p.id + ' names itself as the catalog does');
    const j = s.indexOf(p.line); assert.ok(j > at, p.id + ' in order'); at = j;
    assert.ok(fs.existsSync(path.join(ROOT, p.img.replace(/^\//, ''))), p.img + ' exists');
    /* its mark, when the catalog has one, is a real file — the tile shows it */
    if (P.lockup) assert.ok(fs.existsSync(path.join(ROOT, P.lockup.replace(/^\//, ''))), P.lockup + ' exists');
  });
  assert.ok(sc.products.filter(p => (R.productById(p.id, DATA) || {}).lockup).length >= 3, 'most showcased products carry a lockup for their tile');
  /* the team: every member has an emblem the stage can draw, and no two share one */
  const STAGE = require(path.join(ROOT, 'next', 'voice-stage.js'));
  sc.products.forEach(p => assert.ok(STAGE.icons.indexOf(p.icon) !== -1, p.id + ' has a drawable emblem: ' + p.icon));
  assert.equal(new Set(sc.products.map(p => p.icon)).size, sc.products.length, 'each member its own emblem');
  assert.ok(STAGE.icons.indexOf(sc.self.icon) !== -1, 'NewVoices has one too');
  assert.ok(sc.teamLabel && sc.teamLabel.length <= 40, 'a short label for the assembled team');
  /* Agent Cloud is on the team, and the family is bigger than the team (client, 2026-09-11) */
  assert.ok(sc.products.some(p => p.id === 'agent_cloud'), 'Agent Cloud is one of the six');
  const jm = s.indexOf(sc.more); assert.ok(jm > at, 'then "…and that\'s just six of them"'); at = jm;
  assert.ok(/more than ten products/.test(sc.more) && /growing/.test(sc.more), 'more than ten, a growing family: "' + sc.more + '"');
  assert.ok(R.activeProducts ? true : DATA.solutions.solutions.filter(p => p.active !== false).length > 10, 'and that is true of the catalog');
  assert.ok(/^\d+\+ /.test(sc.moreLabel), 'a badge for the rest: ' + sc.moreLabel);
  assert.ok(s.indexOf(sc.pivot) > at, 'the pivot last');
  assert.ok(/marketing genius/.test(sc.pivot) && sc.pivot.toLowerCase().includes(sc.closeOn.toLowerCase()), 'the pivot carries the words that close the stage');
  const words = s.split(/\s+/).length;
  assert.ok(words >= 100 && words <= 215, 'about 60–75 s of unhurried speech: ' + words + ' words');
  [].concat(sc.burst, [sc.self.img, sc.self.logo]).forEach(img => assert.ok(fs.existsSync(path.join(ROOT, img.replace(/^\//, ''))), img + ' exists'));
  assert.ok(!/https?:\/\//.test(s) && !/\$\s?\d/.test(s), 'no URL, no price in the script');
});

test('the brief: the greeting on a fresh start, a one-line hello when resuming — and the story is always there to be asked for, slowly, once', () => {
  const fresh = buildInstructions(DATA);
  assert.ok(fresh.includes('OPENING.') && !fresh.includes('OPENING SCRIPT'), 'the opening is the greeting, not a script');
  assert.ok(fresh.includes('WHAT IS STAGWELL AI') && fresh.includes(openingScript(DATA)), 'the story, word for word, under its own heading');
  assert.ok(/Slowly/.test(fresh) && /clear pause after each product/.test(fresh), 'paced slower');
  assert.ok(/First the interruption line/.test(fresh), 'the interruption notice comes before the detail');
  assert.ok(/If they interrupt with a question, answer it/.test(fresh), 'an interruption wins');
  assert.ok(/Tell it once/.test(fresh));
  assert.ok(fresh.includes('MARKETING GENIUS'), 'general marketing guidance allowed, within the limits');
  const back = buildInstructions(DATA, { showcase: false });
  assert.ok(!back.includes('OPENING.') && back.includes('No opening script'), 'resuming: no greeting script');
  assert.ok(back.includes('WHAT IS STAGWELL AI'), 'but the story can still be asked for');
});

test('mintSession: the greeting is off when the browser says so, and always when resuming', async () => {
  const bodyOf = async (b) => { let body = null; await mintSession(b, { OPENAI_API_KEY: 'sk' }, async (u, i) => { body = JSON.parse(i.body); return { ok: true, status: 200, json: async () => ({ value: 'ek', expires_at: 1 }) }; }); return body.session.instructions; };
  assert.ok((await bodyOf({})).includes('OPENING.'), 'fresh → the greeting');
  assert.ok((await bodyOf({ showcase: false })).includes('No opening script'), 'showcase:false → a hello');
  assert.ok((await bodyOf({ resume: { summary: 'they said x', step: 'their role' } })).includes('No opening script'), 'resume → a hello');
});

test('resuming adds what is known and the current step, capped', () => {
  const s = buildInstructions(DATA, { showcase: false, resume: { summary: 'x'.repeat(2000), step: 'their role', reason: 'reconnect' } });
  assert.ok(s.includes('RESUMING') && s.includes('The current step is their role'));
  assert.ok(/coming back after a drop/.test(s) && !/HANDOFF/.test(s), 'a reconnect is one line that it is back, not a handoff');
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

/* ── how easily it is interrupted (client, 2026-09-13) ─────────────────────── */
test('listening: semantic VAD at LOW eagerness by default, far-field noise reduction, and every dial settable from the environment', () => {
  const d = turnDetection({});
  assert.equal(d.type, 'semantic_vad');
  assert.equal(d.eagerness, 'low', 'low = waits longer, interrupts less');
  assert.equal(d.create_response, true);
  assert.equal(d.interrupt_response, true, 'the visitor can still cut in; the agent invites it');

  assert.equal(turnDetection({ VOICE_VAD_EAGERNESS: 'high' }).eagerness, 'high');
  assert.equal(turnDetection({ VOICE_VAD_EAGERNESS: 'nonsense' }).eagerness, 'low', 'a bad value falls back, never reaches OpenAI');
  assert.equal(turnDetection({ VOICE_VAD_INTERRUPT: 'off' }).interrupt_response, false);

  const s = turnDetection({ VOICE_VAD: 'server' });
  assert.equal(s.type, 'server_vad');
  assert.equal(s.threshold, 0.65, 'deafer than the 0.5 default');
  assert.equal(s.silence_duration_ms, 700);
  assert.equal(s.prefix_padding_ms, 300);
  assert.equal(turnDetection({ VOICE_VAD: 'server', VOICE_VAD_THRESHOLD: '0.8' }).threshold, 0.8);
  assert.equal(turnDetection({ VOICE_VAD: 'server', VOICE_VAD_THRESHOLD: '9' }).threshold, 0.65, 'out of range falls back');
  assert.equal(turnDetection({ VOICE_VAD: 'server', VOICE_VAD_SILENCE_MS: '1200' }).silence_duration_ms, 1200);

  /* the filter runs before the VAD, so it is the strongest control for a noisy room */
  assert.deepEqual(buildSession(DATA, {}).audio.input.noise_reduction, { type: 'far_field' });
  assert.deepEqual(buildSession(DATA, { VOICE_NOISE_REDUCTION: 'near_field' }).audio.input.noise_reduction, { type: 'near_field' });
  assert.equal(buildSession(DATA, { VOICE_NOISE_REDUCTION: 'off' }).audio.input.noise_reduction, undefined, 'off sends no field at all');
  assert.equal(buildSession(DATA, {}).audio.input.turn_detection.eagerness, 'low', 'the session carries it');
});

/* ── the mint ──────────────────────────────────────────────────────────────── */
test('voiceConfig: off without a key, on with one, caps from env with sane defaults', () => {
  assert.equal(voiceConfig({}).enabled, false);
  assert.equal(voiceConfig({}).keyConfigured, false);
  const on = voiceConfig({ OPENAI_API_KEY: 'sk-test', VOICE_SESSION_SECONDS: '300' });
  assert.equal(on.enabled, true);
  assert.equal(on.caps.sessionSeconds, 300);
  /* the per-IP mint limit is OFF (0) while voice is in beta; a positive env value turns it on */
  assert.equal(on.caps.mintsPerHour, 0);
  assert.equal(voiceConfig({ OPENAI_API_KEY: 'sk-test', VOICE_MINT_PER_HOUR: '12' }).caps.mintsPerHour, 12);
  assert.equal(on.caps.silenceMuteSeconds, 90);
  assert.equal(voiceConfig({ OPENAI_API_KEY: 'sk-test', VOICE_ENABLED: 'off' }).enabled, false);
});

test('handler: no per-IP 429 while the mint limit is off; a positive VOICE_MINT_PER_HOUR brings it back', async () => {
  const saved = { key: process.env.OPENAI_API_KEY, per: process.env.VOICE_MINT_PER_HOUR };
  const call = async (ip) => {
    let status = 0, body = null;
    const res = { setHeader() {}, status(s) { status = s; return res; }, json(j) { body = j; return res; } };
    await voiceHandler({ method: 'POST', headers: { 'x-forwarded-for': ip }, body: {} }, res);
    return { status, body };
  };
  try {
    delete process.env.OPENAI_API_KEY;              /* no key → 503 from the mint, never 429 from a limiter */
    delete process.env.VOICE_MINT_PER_HOUR;
    for (let i = 0; i < 60; i++) {
      const r = await call('203.0.113.9');
      assert.equal(r.status, 503, 'call ' + i + ' was not rate-limited');
      assert.equal(r.body.error, 'voice_unconfigured');
    }
    process.env.VOICE_MINT_PER_HOUR = '2';
    assert.equal((await call('203.0.113.10')).status, 503);
    assert.equal((await call('203.0.113.10')).status, 503);
    const third = await call('203.0.113.10');
    assert.equal(third.status, 429);
    assert.equal(third.body.error, 'rate_limited');
  } finally {
    if (saved.key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.key;
    if (saved.per === undefined) delete process.env.VOICE_MINT_PER_HOUR; else process.env.VOICE_MINT_PER_HOUR = saved.per;
  }
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

test('voice joining a conversation begun in writing: a handoff line, what is known, the current step — and no second introduction', () => {
  const s = buildInstructions(DATA, { showcase: false, resume: { summary: 'They said: "protect brand reputation". Goal: brand_reputation.', step: 'their website', reason: 'join' } });
  assert.ok(/INTRODUCTION — A HANDOFF/.test(s), 'the introduction is a handoff');
  assert.ok(/just been handed the conversation and have caught up/.test(s), 'says it has caught up');
  assert.ok(/name in a few words what they have told you so far/.test(s), 'and names what was said');
  assert.ok(/JOINING\. The conversation so far, in writing: They said: "protect brand reputation"/.test(s) && /The current step is their website/.test(s), 'what is known and where we are');
  assert.ok(!/RESUMING/.test(s) && !/connection dropped/.test(s), 'not described as a dropped call');
  assert.ok(/Do not introduce yourself again after that/.test(s));
  /* the language rule: English, and never a switch on noise (the client saw it drift into French) */
  assert.ok(/LANGUAGE\. Speak English\./.test(s), 'English by default (copy.voice.language)');
  assert.ok(/never because of background noise/.test(s) && /A conversation that began in English stays in English/.test(s), 'no switch on noise or an unsure transcript');
  assert.ok(/carries no real words/.test(s) && /do not greet or introduce yourself again/.test(s), 'an empty turn gets no second greeting');
});

test('mintSession: a resume summary is passed through, capped', async () => {
  let body = null;
  await mintSession({ resume: { summary: 'y'.repeat(5000), step: 'their phone number' } }, { OPENAI_API_KEY: 'sk' }, async (u, i) => { body = JSON.parse(i.body); return { ok: true, status: 200, json: async () => ({ value: 'ek', expires_at: 1 }) }; });
  assert.ok(body.session.instructions.includes('JOINING') && !body.session.instructions.includes('RESUMING'), 'no reason given → a join (a handoff), the safe default');
  await mintSession({ resume: { summary: 'y', step: 'their phone number', reason: 'reconnect' } }, { OPENAI_API_KEY: 'sk' }, async (u, i) => { body = JSON.parse(i.body); return { ok: true, status: 200, json: async () => ({ value: 'ek', expires_at: 1 }) }; });
  assert.ok(body.session.instructions.includes('RESUMING'), 'reason:reconnect → resuming');
  assert.ok(body.session.instructions.includes('their phone number'));
  assert.ok(body.session.instructions.length < 12000);
});

/* ── the reducer ───────────────────────────────────────────────────────────── */
const run = events => { let st = VR.blank(); const ops = []; events.forEach(e => { const r = VR.reduce(st, e); st = r.state; ops.push(...r.ops); }); return { st, ops }; };

test('reducer: the visitor\'s turn is placed when committed — before its transcript, which lands after the reply has begun — so the thread can reserve the bubble', () => {
  const { ops } = run([
    { type: 'input_audio_buffer.speech_started' }, { type: 'input_audio_buffer.speech_stopped' },
    { type: 'input_audio_buffer.committed', item_id: 'u1' },
    { type: 'conversation.item.created', item: { id: 'u1', type: 'message', role: 'user', content: [{ type: 'input_audio' }] } },
    { type: 'response.created', response: { id: 'r1' } },
    { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'keep going' }
  ]);
  assert.deepEqual(ops.map(o => o.op), ['user.speaking', 'user.silent', 'me.committed', 'ai.start', 'me.final'], 'placed once, before the reply, then filled');
  assert.equal(ops[2].itemId, 'u1');
  const b = run([{ type: 'conversation.item.added', item: { id: 'u2', type: 'message', role: 'user', content: [{ type: 'input_audio' }] } }, { type: 'input_audio_buffer.committed', item_id: 'u2' }]);
  assert.deepEqual(b.ops.map(o => o.op), ['me.committed'], 'the GA event name too, and only once for the same item');
  const c = run([{ type: 'conversation.item.created', item: { id: 'u3', type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] } }]);
  assert.equal(c.ops.length, 0, 'a typed line is not placed — the browser drew it as it was sent');
});

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
