/* ═══════════════════════════════════════════════════════════════════════════
   THE STORY SURVIVES — "it suddenly cuts out when it starts talking about
   IMAI" (client, 2026-09-16, on the live site).

   IMAI is the LAST of the four products, which makes it the moment every
   end-of-story condition becomes true at once: the roster is complete, the
   schedule is near its end, the model finished WRITING most of a minute ago,
   and the server's audio buffer has long since drained. Any one of those read
   as "the story is over" tears the pictures away while the voice is still
   talking about IMAI.

   The pacing suite (voice.rehearsal.mjs) proves the reveals land on the voice.
   This one proves the stage does not DIE — it drives the four ways a real
   session differs from the happy path, each one on its own:

     1. the server's audio buffer drains early (it always does: the model
        generates audio far faster than it is heard)
     2. the model finishes writing long before it finishes speaking
     3. the microphone hears the agent's own voice and the server calls it a
        turn — echo, not a person
     4. the model compresses the script and reaches the closing question a
        breath after IMAI

   In every one of them the stage must still be up while the voice is still
   speaking, and must close exactly once, at the end, on its own terms.

   Run:  node tests/kimi/story.funnel.mjs [baseUrl]   (default http://localhost:8199)
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://localhost:8199';
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

/* the fake peer — the same one voice.funnel.mjs uses, kept in step by hand */
/* the fake peer, installed before any page script runs */
const FAKE = `
window.__voiceFake = {
  sent: [], connects: 0, closed: 0, denied: false, failConnect: false, muted: null, levels: { user: 0, agent: 0 },
  emit(ev) { if (this._onEvent) this._onEvent(ev); },
  drop(why) { if (this._onClose) this._onClose(why || 'failed'); },
  sentTypes() { return this.sent.map(e => e.type); },
  last(type) { const l = this.sent.filter(e => e.type === type); return l[l.length - 1] || null; }
};
window.__SAIVOICE_TRANSPORT = {
  async connect(o) {
    const F = window.__voiceFake;
    F.connects++; F.lastSecret = o.secret; F.model = o.model;
    if (F.denied) { const e = new Error('Permission denied'); e.name = 'NotAllowedError'; throw e; }
    if (F.failConnect) throw new Error('sdp_500');
    F._onEvent = o.onEvent; F._onClose = o.onClose; F.gotAudioEl = !!o.audioEl;
    if (F.needTap) setTimeout(() => o.onNeedTap && o.onNeedTap(), 0);
    return {
      ready: Promise.resolve(),
      send: obj => F.sent.push(obj),
      close: () => { F.closed++; },
      setMuted: m => { F.muted = m; },
      setSpeakerMuted: () => {},
      resumeAudio: () => { F.needTap = false; F.resumed = (F.resumed || 0) + 1; return Promise.resolve(); },
      needsTap: () => !!F.needTap,
      levels: () => F.levels
    };
  }
};`;

const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const state = { errors: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.addInitScript(FAKE);
  await page.route('**/api/voice/session', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, value: 'ek_story', expiresAt: 1, model: 'gpt-realtime', voice: 'marin',
      caps: { sessionSeconds: 900, softSeconds: 600, silenceMuteSeconds: 600 } })
  }));
  await page.route('**/api/ask', r => r.abort());
  await page.route('**/api/lead', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.goto(BASE + '/next/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIVOICE && window.SAIKIMI && window.SAI && window.SAI.data);
  await page.evaluate(() => {
    const a = window.SAIANALYTICS; window.__tracked = [];
    if (a && a.track) { const o = a.track.bind(a); a.track = (n, p) => { window.__tracked.push([n, p || {}]); return o(n, p); }; }
  });
  return { ctx, page, state };
}
const emit = (page, ev) => page.evaluate(e => window.__voiceFake.emit(e), ev);
const stageUp = page => page.evaluate(() => !!document.querySelector('.vstage'));
const roster = page => page.$$eval('.vstage__badge[data-product]', els => els.map(e => e.dataset.product));
const closes = page => page.evaluate(() => window.__tracked.filter(t => t[0] === 'voice_showcase_ended').map(t => t[1]));

/* the agent relaying what the visitor typed — voice.funnel.mjs's helper */
async function toolCall(page, name, args, callId) {
  const id = callId || ('c_' + Math.random().toString(36).slice(2, 8));
  const before = await page.evaluate(() => window.__voiceFake.sent.length);
  await emit(page, { type: 'response.created', response: { id: 'r_' + id } });
  await emit(page, { type: 'response.function_call_arguments.done', call_id: id, name, arguments: JSON.stringify(args || {}) });
  await emit(page, { type: 'response.done', response: { id: 'r_' + id, status: 'completed' } });
  await page.waitForFunction(([n, cid]) => window.__voiceFake.sent.slice(n).some(e => e.type === 'conversation.item.create' && e.item && e.item.type === 'function_call_output' && e.item.call_id === cid), [before, id], { timeout: 15000 });
  const out = await page.evaluate(cid => { const e = window.__voiceFake.sent.find(x => x.type === 'conversation.item.create' && x.item && x.item.call_id === cid); return JSON.parse(e.item.output); }, id);
  await page.waitForTimeout(120);
  return out;
}

const startVoice = async page => { await page.click('#voiceStart'); await page.waitForFunction(() => window.SAIVOICE.phase() === 'live', null, { timeout: 8000 }); await page.waitForTimeout(60); };

/* the greeting, spoken in full — it is what calibrates the pace */
async function greet(page) {
  const V = await page.evaluate(() => window.SAI.data.kimi.copy.voice);
  const text = V.introduction + ' ' + V.invite;
  await emit(page, { type: 'response.created', response: { id: 'r_greet' } });
  await emit(page, { type: 'response.output_item.added', item: { id: 'a_greet', type: 'message', role: 'assistant' } });
  await emit(page, { type: 'output_audio_buffer.started' });
  await emit(page, { type: 'response.output_audio_transcript.delta', item_id: 'a_greet', delta: text });
  await emit(page, { type: 'response.output_audio_transcript.done', item_id: 'a_greet', transcript: text });
  await emit(page, { type: 'response.done', response: { id: 'r_greet', status: 'completed' } });
  await emit(page, { type: 'output_audio_buffer.stopped' });
  await page.waitForTimeout(80);
  return V;
}

/* ── THE STORY, THE WAY THE WIRE REALLY CARRIES IT ──
   The whole transcript in a burst, then `response.done`, then — early, because
   the server has finished generating — output_audio_buffer.stopped. And the
   VOICE carries on for the rest of the schedule. The clock is pinned fast so a
   fifty-second story runs in about five. */
async function tellStory(page, opts = {}) {
  const wps = opts.wps || 24;
  await page.evaluate(w => { window.SAI.data.kimi.copy.voice.wordsPerSecond = w; }, wps);
  const text = opts.text || await page.evaluate(() => {
    const S = window.SAI.data.kimi.copy.voice.showcase;
    const byId = id => (window.SAI.data.solutions.solutions.find(p => p.id === id) || {});
    return [S.interrupt, S.flagship].concat(S.products.map(p => p.line)).concat([S.more, S.land]).join(' ');
  });
  await page.click('#agentThread .turnb__chips--starters .tag--hero');
  await page.waitForSelector('.vstage.is-open', { timeout: 4000 });
  await emit(page, { type: 'response.created', response: { id: 'r_story' } });
  await emit(page, { type: 'response.output_item.added', item: { id: 'a_story', type: 'message', role: 'assistant' } });
  await emit(page, { type: 'output_audio_buffer.started' });
  /* the burst */
  const words = text.split(' ');
  for (let i = 0; i < words.length; i += 6) {
    await emit(page, { type: 'response.output_audio_transcript.delta', item_id: 'a_story', delta: (i ? ' ' : '') + words.slice(i, i + 6).join(' ') });
  }
  await emit(page, { type: 'response.output_audio_transcript.done', item_id: 'a_story', transcript: text });
  return { text, words: words.length };
}
/* the model has finished WRITING — nowhere near finished speaking */
const writingDone = page => emit(page, { type: 'response.done', response: { id: 'r_story', status: 'completed' } });
/* the SERVER's audio buffer has drained — the client is still playing it out */
const bufferDrained = page => emit(page, { type: 'output_audio_buffer.stopped' });
/* wait until a product is on the roster */
const until = (page, id, ms = 12000) => page.waitForFunction(
  i => !!document.querySelector('.vstage__badge[data-product="' + i + '"]'), id, { timeout: ms });

try {
  console.log('\n▶ 1 · the model finishes writing, and the server\'s buffer drains, long before IMAI');
  {
    const { ctx, page, state } = await open();
    await startVoice(page); await greet(page);
    await tellStory(page);
    /* both of the "it's over" signals, fired at the top of the story */
    await writingDone(page);
    await bufferDrained(page);
    await page.waitForTimeout(150);
    ok(await stageUp(page), 'the stage is still up after both — the voice has barely started');
    ok((await roster(page)).length === 0, '   and nothing has been revealed yet');

    await until(page, 'newintel');
    ok(await stageUp(page), 'NewIntel lands and the stage lives');
    await until(page, 'imai');
    ok(await stageUp(page), 'IMAI lands and the stage STILL lives — the thing the client saw');
    const at = Date.now();
    await page.waitForFunction(() => !document.querySelector('.vstage'), null, { timeout: 15000 });
    const after = Date.now() - at;
    ok(after > 900, 'it closes only after IMAI has been talked about (' + after + ' ms later)');
    const c = await closes(page);
    ok(c.length === 1 && c[0].revealed === 4, 'closed exactly once, with the whole team (' + JSON.stringify(c[0]) + ')');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ 2 · the buffer drains right as IMAI is named');
  {
    const { ctx, page, state } = await open();
    await startVoice(page); await greet(page);
    await tellStory(page);
    await writingDone(page);
    await until(page, 'imai');
    /* the worst moment: every end-of-story condition true at once */
    await bufferDrained(page);
    await page.waitForTimeout(250);
    ok(await stageUp(page), 'the stage survives the buffer draining on IMAI itself');
    await page.waitForFunction(() => !document.querySelector('.vstage'), null, { timeout: 15000 });
    const c = await closes(page);
    ok(c.length === 1, 'and still closes exactly once (' + c.map(x => x.why).join(',') + ')');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ 3 · the microphone hears the agent itself — echo, not a person');
  {
    const { ctx, page, state } = await open();
    await startVoice(page); await greet(page);
    await tellStory(page);
    await writingDone(page);
    await until(page, 'questbrand');
    /* the server calls it a turn and hands back the agent's OWN words */
    await emit(page, { type: 'input_audio_buffer.speech_started', item_id: 'u_echo' });
    await emit(page, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u_echo', transcript: 'brand tracking against the competitors you name' });
    await page.waitForTimeout(250);
    ok(await stageUp(page), 'the stage survives an echo of the agent\'s own line');
    await until(page, 'imai', 14000).then(() => ok(true, '   and the story carries on to IMAI')).catch(() => ok(false, '   and the story carries on to IMAI'));
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ 4 · a real interruption still stops it');
  {
    const { ctx, page, state } = await open();
    await startVoice(page); await greet(page);
    await tellStory(page);
    await writingDone(page);
    await until(page, 'newintel');
    await emit(page, { type: 'input_audio_buffer.speech_started', item_id: 'u_real' });
    await emit(page, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u_real', transcript: 'wait, how much does BERA cost?' });
    await page.waitForTimeout(400);
    ok(!(await stageUp(page)), 'a question from the visitor still takes the pictures away');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ 5 · the model compresses: it reaches the closing question a breath after IMAI');
  {
    const { ctx, page, state } = await open();
    await startVoice(page); await greet(page);
    const short = await page.evaluate(() => {
      const S = window.SAI.data.kimi.copy.voice.showcase;
      return [S.interrupt, S.flagship].concat(S.products.map(p => p.line)).concat([S.land]).join(' ');
    });
    await tellStory(page, { text: short });
    await writingDone(page);
    await bufferDrained(page);
    await until(page, 'imai');
    const at = Date.now();
    await page.waitForFunction(() => !document.querySelector('.vstage'), null, { timeout: 15000 });
    const after = Date.now() - at;
    ok(after > 700, 'IMAI gets its moment even when the question follows it straight away (' + after + ' ms)');
    ok((await closes(page))[0].revealed === 4, '   and all four were shown');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }
  console.log('\n▶ 6 · the landing: the address is pitched first, the problem second');
  {
    const { ctx, page, state } = await open();
    await startVoice(page); await greet(page);
    await tellStory(page);
    await writingDone(page);
    await bufferDrained(page);
    await page.waitForFunction(() => !document.querySelector('.vstage'), null, { timeout: 20000 });
    await page.waitForTimeout(500);
    ok(!!(await page.$('#agentThread .turnb--team')), 'the team card stays in the thread');
    const k = await page.evaluate(() => window.SAIKIMI.state());
    ok(k.question && k.question.field === 'email', 'the conversation is standing on the WORK EMAIL (' + (k.question && k.question.id) + ')');
    const c = await page.$eval('#agentInput', e => ({ mode: e.getAttribute('inputmode'), ph: e.placeholder, off: e.disabled }));
    ok(c.mode === 'email' && !c.off && /@/.test(c.ph), '   the composer is set up for an address ("' + c.ph + '")');
    ok((await page.$$('#agentThread .turnb__chips--answers .tag')).length === 0, '   and no pills — an address is typed, not picked');

    /* the address, and then the problem arrives WITH its pills */
    await page.fill('#agentInput', 'ada@acme-brands.com');
    await page.press('#agentInput', 'Enter');
    ok((await page.$$eval('#agentThread .turnb--me', e => e.map(x => x.textContent))).some(t => /ada@acme-brands/.test(t)), '   what they typed is their turn on the thread');
    const r = await toolCall(page, 'submit_answer', { text: 'ada@acme-brands.com' });
    await page.waitForTimeout(600);
    const k2 = await page.evaluate(() => window.SAIKIMI.state());
    ok(r.question && Array.isArray(r.question.options) && r.question.options.length >= 4, '   the model is handed the next question WITH its options: ' + ((r.question || {}).options || []).join(' | '));
    ok(k2.email === 'ada@acme-brands.com', 'the address is taken (' + k2.email + ')');
    ok((k2.suggestions || []).length >= 4, '   and the next question comes with its options: ' + (k2.suggestions || []).map(x => x.label).join(' | '));
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ 7 · …and answering the pitch with a PROBLEM is not a wrong answer');
  {
    const { ctx, page, state } = await open();
    await startVoice(page); await greet(page);
    await tellStory(page);
    await writingDone(page);
    await bufferDrained(page);
    await page.waitForFunction(() => window.SAIKIMI.state().question && window.SAIKIMI.state().question.field === 'email', null, { timeout: 20000 });
    await toolCall(page, 'submit_answer', { text: 'we need to know what our competitors are doing this week' });
    await page.waitForTimeout(600);
    const k = await page.evaluate(() => window.SAIKIMI.state());
    ok(!(k.question && k.question.field === 'email'), 'it does not ask for the address again (' + (k.question ? k.question.id : k.status) + ')');
    ok((k.intents || []).length > 0 || k.primaryGoal, '   it took what they actually said instead');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }
  console.log('\n▶ 8 · refusing the address: asked once more WITH the reason, then never again');
  {
    const { ctx, page, state } = await open();
    await startVoice(page); await greet(page);
    await tellStory(page);
    await writingDone(page);
    await bufferDrained(page);
    await page.waitForFunction(() => window.SAIKIMI.state().question && window.SAIKIMI.state().question.field === 'email', null, { timeout: 20000 });
    const C = await page.evaluate(() => window.SAI.data.kimi.copy);

    /* first refusal — not a typo, so not "check the address" */
    await toolCall(page, 'submit_answer', { text: "i dont want to tell you my email" });
    await page.waitForTimeout(400);
    const k1 = await page.evaluate(() => window.SAIKIMI.state());
    ok(k1.question && k1.question.field === 'email', 'it asks once more (' + (k1.question && k1.question.id) + ')');
    ok(k1.message === C.emailWhy, '   and what it says is the REASON, not an error: "' + String(k1.message).slice(0, 70) + '…"');
    ok(!/does not look like/i.test(k1.message || ''), '   the dead-end line is gone');

    /* second refusal — that is an answer */
    await toolCall(page, 'submit_answer', { text: 'no thanks' });
    await page.waitForTimeout(400);
    const k2 = await page.evaluate(() => window.SAIKIMI.state());
    ok(!(k2.question && k2.question.field === 'email'), 'it lets them through (' + (k2.question ? k2.question.id : k2.status) + ')');
    ok(!k2.email, '   no address was invented (' + JSON.stringify(k2.email) + ')');
    ok(String(k2.message || '').startsWith(String(C.emailSkipped).slice(0, 20)), '   and it says so lightly: "' + String(k2.message).slice(0, 60) + '…"');
    ok(/that's fine/i.test(k2.message || '') && /chance/i.test(k2.message || '') && !/does not look like/i.test(k2.message || ''),
      '   …acknowledging the refusal and promising another chance, not pressing');
    ok((k2.suggestions || []).length >= 4, '   the problem comes next, with its pills: ' + (k2.suggestions || []).map(x => x.label).join(' | '));

    /* …and from there they are still shown a product, before anything else */
    const r = await toolCall(page, 'submit_answer', { text: 'we need to track what our competitors are doing' });
    await page.waitForTimeout(600);
    const k3 = await page.evaluate(() => window.SAIKIMI.state());
    ok(k3.previewed && k3.cards.length, 'and they are still shown a product, without ever giving an address (' + k3.cards.length + ')');
    ok(!!(await page.$('#agentThread .turnb--reco')), '   the cards are in the thread');
    ok((r.shown || []).some(x => /recommendation/.test(x)), '   the voice agent is told they are on screen: ' + JSON.stringify(r.shown));
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? '\n✗ ' + failures + ' failed\n' : '\n✓ the story survives to the end of IMAI, and lands on the ask\n');
process.exit(failures ? 1 : 0);
