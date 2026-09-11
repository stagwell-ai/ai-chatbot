/* ═══════════════════════════════════════════════════════════════════════════
   VOICE — "Chat with me" in the browser, against a FAKE Realtime peer.

   OpenAI cannot be reached from the test box, and a real WebRTC call is not a
   thing a test should depend on. voice.js exposes a transport seam
   (window.__SAIVOICE_TRANSPORT); this suite injects a fake that records what
   the browser sends and lets the test emit the server's events. Everything
   above the wire — the button, the strip, the wave states, the transcripts,
   the sync rules, the tools, mute/end, Start over, the fallbacks — runs here.

   Run:  node tests/kimi/voice.funnel.mjs [baseUrl]   (default http://localhost:8199)
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://localhost:8199';
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

const KNOWN = { ok: true, known: true, name: 'Acme Hotels', domain: 'acmehotels.com', employees: 4200, industry: 'hospitality', competitors: ['Marriott', 'Hilton', 'Accor'] };

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
    F._onEvent = o.onEvent; F._onClose = o.onClose;
    return {
      ready: Promise.resolve(),
      send: obj => F.sent.push(obj),
      close: () => { F.closed++; },
      setMuted: m => { F.muted = m; },
      setSpeakerMuted: () => {},
      resumeAudio: () => Promise.resolve(),
      needsTap: () => false,
      levels: () => F.levels
    };
  }
};`;

const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const state = { errors: [], mints: [], leads: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.addInitScript(FAKE);
  await page.route('**/api/voice/session', r => {
    state.mints.push(JSON.parse(r.request().postData() || '{}'));
    if (opts.mint === 503) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'voice_unconfigured' }) });
    if (opts.mint === 429) return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'rate_limited' }) });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, value: 'ek_test_' + state.mints.length, expiresAt: 1, model: 'gpt-realtime', voice: 'marin', caps: { sessionSeconds: 900, softSeconds: 600, silenceMuteSeconds: 90 } }) });
  });
  await page.route('**/api/ask', r => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (body.mode === 'research') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(KNOWN) });
    r.abort();
  });
  await page.route('**/api/lead', r => { state.leads.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: true, mode: 'mock' }) }); });
  await page.goto(BASE + (opts.path || '/next/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAIVOICE && window.SAI && window.SAI.data && window.SAI.data.kimi);
  await page.evaluate(() => {
    const a = window.SAIANALYTICS; window.__tracked = [];
    if (a && a.track) { const orig = a.track.bind(a); a.track = (n, p) => { window.__tracked.push([n, p || {}]); return orig(n, p); }; }
  });
  return { ctx, page, state };
}
const fake = (page, js) => page.evaluate(js);
const emit = (page, ev) => page.evaluate(e => window.__voiceFake.emit(e), ev);
const sentTypes = page => page.evaluate(() => window.__voiceFake.sentTypes());
const vstate = page => page.evaluate(() => window.SAIVOICE.state());
const kstate = page => page.evaluate(() => window.SAIKIMI.state());
const strip = page => page.$eval('#voiceStrip', el => ({ hidden: el.hidden, state: el.dataset.state, tone: el.dataset.tone, status: el.querySelector('#voiceStatus').textContent.trim(), mute: el.querySelector('#voiceMute').hidden ? null : el.querySelector('#voiceMute').textContent.trim(), end: !el.querySelector('#voiceEnd').hidden }));
const tracked = (page, n) => page.evaluate(n => window.__tracked.filter(t => t[0] === n), n);
const thread = page => page.$$eval('#agentThread .turnb', els => els.map(e => ({ cls: e.className.replace('turnb ', ''), text: e.textContent.trim().slice(0, 80) })));
const startVoice = async page => { await page.click('#voiceStart'); await page.waitForFunction(() => window.SAIVOICE.phase() === 'live', null, { timeout: 8000 }); await page.waitForTimeout(80); };
/* the agent speaks a line: start → item → transcript → done, as the API would */
async function agentSays(page, text, id) {
  const item = id || ('a_' + Math.random().toString(36).slice(2, 8)), resp = 'r_' + item;
  await emit(page, { type: 'response.created', response: { id: resp } });
  await emit(page, { type: 'response.output_item.added', item: { id: item, type: 'message', role: 'assistant' } });
  await emit(page, { type: 'output_audio_buffer.started' });
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) await emit(page, { type: 'response.output_audio_transcript.delta', item_id: item, delta: (i ? ' ' : '') + words[i] });
  await emit(page, { type: 'response.output_audio_transcript.done', item_id: item, transcript: text });
  await emit(page, { type: 'output_audio_buffer.stopped' });
  await emit(page, { type: 'response.done', response: { id: resp, status: 'completed' } });
  return item;
}
async function visitorSays(page, text, id) {
  const item = id || ('u_' + Math.random().toString(36).slice(2, 8));
  await emit(page, { type: 'input_audio_buffer.speech_started' });
  const half = Math.ceil(text.length / 2);
  await emit(page, { type: 'conversation.item.input_audio_transcription.delta', item_id: item, delta: text.slice(0, half) });
  await emit(page, { type: 'conversation.item.input_audio_transcription.delta', item_id: item, delta: text.slice(half) });
  await emit(page, { type: 'input_audio_buffer.speech_stopped' });
  await emit(page, { type: 'conversation.item.input_audio_transcription.completed', item_id: item, transcript: text });
  return item;
}
/* the model calls a tool; the browser runs it and answers on the wire */
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

try {
  console.log('\n▶ the button, the strip, the greeting');
  {
    const { ctx, page, state } = await open();
    ok(await page.$eval('#voiceStart', b => !b.hidden && /Chat with me/.test(b.textContent)), '"Chat with me" sits in the composer bar');
    ok(await page.$eval('#voiceStrip', el => el.hidden), 'the strip is hidden before a session');
    await page.click('#voiceStart');
    await page.waitForFunction(() => window.SAIVOICE.phase() === 'live', null, { timeout: 8000 });
    await page.waitForTimeout(100);
    const s = await strip(page);
    ok(!s.hidden && s.state === 'thinking' && s.mute === 'Mute' && s.end, 'the strip is up with Mute and End (' + s.state + ')');
    ok(state.mints.length === 1 && state.mints[0].page === '/next/index.html' && !state.mints[0].resume, 'one secret was minted for this page, nothing to resume');
    ok(await page.evaluate(() => window.__voiceFake.lastSecret === 'ek_test_1' && window.__voiceFake.model === 'gpt-realtime'), 'the transport got the secret and the model, never a key');
    ok((await sentTypes(page)).join(',') === 'response.create', 'the agent is asked to speak first');
    ok((await tracked(page, 'voice_session_started')).length === 1, 'voice_session_started tracked');
    ok(await page.$eval('#voiceStart', b => b.classList.contains('is-live') && b.getAttribute('aria-pressed') === 'true'), 'the button shows live');
    ok(await page.$eval('#agentRestart', b => !b.hidden), 'Start over is offered');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ the agent talks: its words stream into a bubble as it speaks; the wave says speaking');
  {
    const { ctx, page } = await open();
    await startVoice(page);
    const id = 'a1', resp = 'r1';
    await emit(page, { type: 'response.created', response: { id: resp } });
    await emit(page, { type: 'response.output_item.added', item: { id, type: 'message', role: 'assistant' } });
    await emit(page, { type: 'output_audio_buffer.started' });
    await emit(page, { type: 'response.output_audio_transcript.delta', item_id: id, delta: "Hi — what are" });
    let t = await thread(page);
    ok(t.length === 1 && /turnb--ai/.test(t[0].cls) && t[0].text === 'Hi — what are', 'the first words appear at once: "' + t[0].text + '"');
    ok((await strip(page)).state === 'speaking', 'the strip says speaking');
    await emit(page, { type: 'response.output_audio_transcript.delta', item_id: id, delta: ' you trying to solve?' });
    await emit(page, { type: 'response.output_audio_transcript.done', item_id: id, transcript: 'Hi — what are you trying to solve?' });
    await emit(page, { type: 'output_audio_buffer.stopped' });
    await emit(page, { type: 'response.done', response: { id: resp, status: 'completed' } });
    t = await thread(page);
    ok(t.length === 1 && t[0].text === 'Hi — what are you trying to solve?', 'one bubble, the whole line: "' + t[0].text + '"');
    ok((await strip(page)).state === 'listening', 'then the strip listens');
    ok(await page.$eval('#agentThread .turnb--ai .turnb__text .q', e => e.textContent === '?'), 'the question mark is styled like every other');
    await ctx.close();
  }

  console.log('\n▶ the visitor talks: a grey interim bubble that settles when the transcript is final');
  {
    const { ctx, page } = await open();
    await startVoice(page);
    await emit(page, { type: 'input_audio_buffer.speech_started' });
    ok((await strip(page)).state === 'listening', 'listening as they speak');
    await emit(page, { type: 'conversation.item.input_audio_transcription.delta', item_id: 'u1', delta: 'we need to track ' });
    let t = await thread(page);
    ok(t.length === 1 && /turnb--me/.test(t[0].cls) && /turnb--interim/.test(t[0].cls) && t[0].text === 'we need to track', 'their words arrive as an interim "me" bubble');
    await emit(page, { type: 'conversation.item.input_audio_transcription.delta', item_id: 'u1', delta: 'competitors' });
    await emit(page, { type: 'input_audio_buffer.speech_stopped' });
    await emit(page, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'we need to track competitors' });
    t = await thread(page);
    ok(t.length === 1 && !/interim/.test(t[0].cls) && t[0].text === 'we need to track competitors', 'and settle to normal type when final');
    ok((await vstate(page)).turns === 1, 'counted as a turn');
    await ctx.close();
  }

  console.log('\n▶ the tools: the model moves the flow only through submit_answer, and gets back what it may say');
  {
    const { ctx, page, state } = await open();
    await startVoice(page);
    const bubblesBefore = (await thread(page)).length;
    const r1 = await toolCall(page, 'submit_answer', { text: 'we need to know what competitors are doing this week' });
    ok(r1.status === 'DISCOVERY' && r1.question && r1.question.id === 'website', 'step 1 answered → the flow asks for the website (' + (r1.question && r1.question.id) + ')');
    ok(/website/i.test(r1.say) && r1.step === 'their website', 'the model is handed the question to say ("' + r1.say.slice(0, 50) + '…")');
    ok((await thread(page)).length === bubblesBefore, 'hero-agent drew NO question text — the agent is saying it');
    ok((await kstate(page)).primaryGoal !== undefined, 'the flow state moved');
    const r2 = await toolCall(page, 'submit_answer', { text: 'acmehotels.com' });
    ok(r2.facts && r2.facts.company === 'Acme Hotels' && r2.facts.industry === 'hospitality', 'the website → the lookup\'s facts, and only those (' + JSON.stringify(r2.facts).slice(0, 80) + ')');
    ok(r2.shown.some(s => /fact list/.test(s)), 'and it is told the fact list is on screen');
    ok((await page.$$('.found__row')).length === 3, 'the fact list is drawn in the thread (3 rows)');
    ok(r2.question && r2.question.id === 'role', 'size was read from the site → the role comes next (' + (r2.question && r2.question.id) + ')');
    ok(Array.isArray(r2.question.options) && r2.question.options.includes('C-suite'), 'with the options to offer');
    const r3 = await toolCall(page, 'submit_answer', { text: 'I am the CMO' });
    ok(r3.status === 'CAPTURE_EMAIL' && r3.recommendation && r3.recommendation[0].name === 'NewIntel', 'role → the recommendation (NewIntel) and the email ask (' + r3.status + ')');
    ok((await page.$$('.reco__card--best')).length === 1, 'the cards are drawn');
    ok(!(await page.$$eval('#agentThread .turnb--ai .turnb__text', els => els.some(e => /work email/i.test(e.textContent)))), 'but the email question is not written — it is spoken');
    ok(await page.$eval('#agentInput', el => el.getAttribute('inputmode') === 'email' && !el.disabled), 'the keyboard is set to email, the composer open');
    const r4 = await toolCall(page, 'submit_answer', { text: 'not an email' });
    ok(r4.status === 'CAPTURE_EMAIL' && r4.holding === true && /does not look like/i.test(r4.say), 'a bad email: the model is told to ask again');
    const r5 = await toolCall(page, 'submit_answer', { text: 'cmo@acmehotels.com' });
    ok(r5.status === 'CAPTURE_PHONE' && r5.lead && r5.lead.emailGiven, 'a good one → the phone ask; the lead exists');
    ok(state.leads.length === 1 && state.leads[0].lead.email === 'cmo@acmehotels.com', 'the lead was created on the email');
    const r6 = await toolCall(page, 'submit_answer', { text: '+1 212 555 0100' });
    ok(r6.status === 'BOOK' && r6.done === true && r6.shown.some(s => /Book a call/.test(s)), 'phone → the call is offered, done');
    ok(state.leads.length === 2 && state.leads[1].lead.phone === '+1 212 555 0100', 'the lead was updated with the phone');
    ok(!!(await page.$('.turnb--book [data-kimi-cta="BOOK"]')), 'the Book a call button is on screen');
    ok((await tracked(page, 'voice_tool_call')).length === 6, 'six tool calls tracked');
    const asked = (await kstate(page)).askedQuestionIds.join(' → ');
    ok(asked === 'website → role', 'the questions ran in the client\'s order: ' + asked);
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ typing while the voice is open: a "me" bubble, sent to the agent, answered by voice');
  {
    const { ctx, page } = await open();
    await startVoice(page);
    await agentSays(page, 'What are you trying to solve?');
    await page.fill('#agentInput', 'we want to run our own surveys');
    await page.press('#agentInput', 'Enter');
    await page.waitForTimeout(150);
    const t = await thread(page);
    ok(t.length === 2 && /turnb--me/.test(t[1].cls) && t[1].text === 'we want to run our own surveys', 'the typed line is a "me" bubble');
    const types = await sentTypes(page);
    const created = await page.evaluate(() => window.__voiceFake.last('conversation.item.create'));
    ok(created && created.item.role === 'user' && created.item.content[0].text === 'we want to run our own surveys' && types[types.length - 1] === 'response.create', 'it went to the agent as a user turn, then a response was asked for');
    ok((await page.$$('#agentThread .turnb--wait')).length === 0, 'no thinking dots in the thread — the strip carries that');
    ok((await strip(page)).state === 'thinking', 'the strip says thinking');
    ok(await page.$eval('#agentInput', el => el.value === ''), 'the composer is empty again');
    await ctx.close();
  }

  console.log('\n▶ barge-in: talking or typing over the agent cuts it off');
  {
    const { ctx, page } = await open();
    await startVoice(page);
    await emit(page, { type: 'response.created', response: { id: 'r1' } });
    await emit(page, { type: 'output_audio_buffer.started' });
    await emit(page, { type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'Let me tell you about the whole' });
    await emit(page, { type: 'input_audio_buffer.speech_started' });
    ok(await page.$eval('#agentThread .turnb--ai', e => e.classList.contains('turnb--cutoff')), 'speaking over it marks the bubble cut off');
    ok((await tracked(page, 'voice_barge_in')).length === 1, 'voice_barge_in tracked');
    await emit(page, { type: 'response.done', response: { id: 'r1', status: 'cancelled' } });
    await emit(page, { type: 'output_audio_buffer.cleared' });
    /* now typing over a fresh response */
    await emit(page, { type: 'response.created', response: { id: 'r2' } });
    await emit(page, { type: 'response.output_audio_transcript.delta', item_id: 'a2', delta: 'Here is' });
    await page.fill('#agentInput', 'stop'); await page.press('#agentInput', 'Enter');
    await page.waitForTimeout(100);
    const types = await sentTypes(page);
    const i = types.lastIndexOf('response.cancel');
    ok(i !== -1 && types[i + 1] === 'output_audio_buffer.clear' && types[i + 2] === 'conversation.item.create', 'typing sent cancel + clear before the new turn');
    await ctx.close();
  }

  console.log('\n▶ mute, end — and the text keeps working after');
  {
    const { ctx, page, state } = await open();
    await startVoice(page);
    await page.click('#voiceMute');
    ok(await page.evaluate(() => window.__voiceFake.muted === true), 'the mic track is muted');
    let s = await strip(page);
    ok(s.state === 'muted' && s.mute === 'Unmute' && /Muted/.test(s.status), 'the strip says muted, the button says Unmute');
    await page.click('#voiceMute');
    ok(await page.evaluate(() => window.__voiceFake.muted === false), 'and back');
    await page.click('#voiceEnd');
    await page.waitForTimeout(100);
    ok((await vstate(page)).phase === 'ended' && await page.evaluate(() => window.__voiceFake.closed === 1), 'End closes the connection');
    s = await strip(page);
    ok(/Voice ended/.test(s.status) && s.mute === null && !s.end, 'the strip says so and drops its controls');
    ok((await tracked(page, 'voice_session_ended')).length === 1 && (await tracked(page, 'voice_session_ended'))[0][1].reason === 'user', 'voice_session_ended {reason:user}');
    /* text mode carries on with the ordinary flow */
    await page.fill('#agentInput', 'I want to create my own surveys'); await page.press('#agentInput', 'Enter');
    await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'), null, { timeout: 12000 });
    await page.waitForTimeout(200);
    ok(await page.$$eval('#agentThread .turnb--ai .turnb__text', els => els.some(e => /website/i.test(e.textContent))), 'a typed line after End is answered in text by the ordinary flow');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ Start over during a voice session: the thread clears, the flow resets, the agent is told');
  {
    const { ctx, page } = await open();
    await startVoice(page);
    await agentSays(page, 'What are you trying to solve?');
    await toolCall(page, 'submit_answer', { text: 'we need to track competitors' });
    ok((await kstate(page)).status === 'DISCOVERY', 'a conversation is under way');
    await page.click('#agentRestart');
    await page.waitForTimeout(150);
    ok((await thread(page)).length === 0, 'the thread is empty');
    ok((await kstate(page)).status === 'IDLE', 'the flow is blank');
    ok((await vstate(page)).phase === 'live', 'the voice stays open');
    const last = await page.evaluate(() => window.__voiceFake.last('response.create'));
    ok(last && last.response && /started over/i.test(last.response.instructions), 'the agent is told to greet again');
    /* and the model's own start_over tool does the same, without a second prompt */
    await agentSays(page, 'Sure — what do you want to solve?');
    const n = await page.evaluate(() => window.__voiceFake.sent.filter(e => e.type === 'response.create').length);
    await toolCall(page, 'start_over', {});
    ok((await thread(page)).length === 0 && (await kstate(page)).status === 'IDLE', 'start_over from the model clears too');
    const n2 = await page.evaluate(() => window.__voiceFake.sent.filter(e => e.type === 'response.create').length);
    ok(n2 === n + 1, 'one response.create for the tool result, no extra prompt (' + n + ' → ' + n2 + ')');
    await ctx.close();
  }

  console.log('\n▶ text first, voice later: the agent is primed with what is already known');
  {
    const { ctx, page, state } = await open();
    await page.fill('#agentInput', 'we need live competitive intelligence'); await page.press('#agentInput', 'Enter');
    await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'), null, { timeout: 12000 });
    await page.fill('#agentInput', 'acmehotels.com'); await page.press('#agentInput', 'Enter');
    await page.waitForFunction(() => window.SAIKIMI.state().question && window.SAIKIMI.state().question.id === 'role', null, { timeout: 12000 });
    await startVoice(page);
    const m = state.mints[0];
    ok(m.resume && /Acme Hotels/.test(m.resume.summary) && /acmehotels\.com/.test(m.resume.summary) && m.resume.step === 'their role', 'the mint carries a summary and the current step: "' + (m.resume && m.resume.summary.slice(0, 70)) + '…" / ' + (m.resume && m.resume.step));
    ok((await tracked(page, 'voice_session_started'))[0][1].resumed === true, 'tracked as resumed');
    ok((await page.$$('.found__row')).length === 3, 'what was already on screen stays');
    await ctx.close();
  }

  console.log('\n▶ the microphone is refused: one honest line, text carries on');
  {
    const { ctx, page, state } = await open();
    await fake(page, () => { window.__voiceFake.denied = true; });
    await page.click('#voiceStart');
    await page.waitForFunction(() => window.SAIVOICE.phase() === 'ended', null, { timeout: 8000 });
    const s = await strip(page);
    ok(/microphone was not allowed/i.test(s.status) && s.tone === 'error', 'the strip explains: "' + s.status + '"');
    ok((await tracked(page, 'voice_unavailable'))[0][1].reason === 'denied', 'voice_unavailable {reason:denied}');
    await page.fill('#agentInput', 'hello'); await page.press('#agentInput', 'Enter');
    await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'), null, { timeout: 12000 });
    ok((await thread(page)).some(t => /turnb--ai/.test(t.cls)), 'typing still gets a text answer');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ the mint fails (503, 429): unavailable / busy, text carries on');
  for (const [code, re, reason] of [[503, /not available here yet/i, 'unconfigured'], [429, /busy/i, 'busy']]) {
    const { ctx, page } = await open({ mint: code });
    await page.click('#voiceStart');
    await page.waitForFunction(() => window.SAIVOICE.phase() === 'ended', null, { timeout: 8000 });
    const s = await strip(page);
    ok(re.test(s.status), code + ': "' + s.status + '"');
    ok((await tracked(page, 'voice_unavailable'))[0][1].reason === reason, '   reason ' + reason);
    ok(await page.evaluate(() => window.__voiceFake.connects === 0), '   no connection was attempted');
    await ctx.close();
  }

  console.log('\n▶ the connection drops: reconnect, primed, one line to say it is back');
  {
    const { ctx, page, state } = await open();
    await startVoice(page);
    await toolCall(page, 'submit_answer', { text: 'we need to know what competitors are doing this week' });
    await fake(page, () => window.__voiceFake.drop('failed'));
    await page.waitForFunction(() => window.SAIVOICE.phase() === 'reconnecting' || window.SAIVOICE.state().reconnects > 0, null, { timeout: 5000 });
    await page.waitForFunction(() => window.SAIVOICE.phase() === 'live', null, { timeout: 10000 });
    ok(state.mints.length === 2 && state.mints[1].resume && /competitors/.test(state.mints[1].resume.summary), 'a second secret, primed with the conversation so far (' + JSON.stringify(state.mints.map(m => m.resume)) + ')');
    ok(await page.evaluate(() => window.__voiceFake.connects === 2), 'a second connection');
    const last = await page.evaluate(() => window.__voiceFake.last('response.create'));
    ok(last && last.response && /reconnected/i.test(last.response.instructions), 'the agent is told it is back');
    ok((await tracked(page, 'voice_reconnected')).length === 1, 'voice_reconnected tracked');
    ok((await kstate(page)).status === 'DISCOVERY', 'the flow state survived');
    await ctx.close();
  }

  console.log('\n▶ a phone: the strip fits the card, the controls are finger-sized');
  {
    const { ctx, page, state } = await open({ viewport: { width: 390, height: 844 } });
    ok(await page.$eval('#voiceStart', b => !b.hidden && b.getBoundingClientRect().height >= 30), 'the button is there');
    await startVoice(page);
    const geo = await page.evaluate(() => {
      const card = document.querySelector('#agentForm').getBoundingClientRect(), s = document.querySelector('#voiceStrip').getBoundingClientRect();
      const btns = [...document.querySelectorAll('#voiceMute, #voiceEnd')].map(b => b.getBoundingClientRect());
      return { inside: s.left >= card.left - 1 && s.right <= card.right + 1, width: Math.round(s.width), btn: btns.map(b => [Math.round(b.width), Math.round(b.height)]), noX: document.documentElement.scrollWidth <= innerWidth };
    });
    ok(geo.inside && geo.width > 200, 'the strip sits inside the card (' + geo.width + 'px)');
    ok(geo.btn.every(([w, h]) => h >= 30 && w >= 44), 'Mute and End are at least 44px wide (' + JSON.stringify(geo.btn) + ')');
    ok(geo.noX, 'the page does not scroll sideways');
    await agentSays(page, 'What are you trying to solve?');
    ok((await thread(page)).length === 1, 'transcripts land on the phone too');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ no transport, no button: a browser that cannot do it never sees "Chat with me"');
  {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); });
    await page.goto(BASE + '/next/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);
    ok(await page.$eval('#voiceStart', b => b.hidden), 'the button is hidden');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all green'));
process.exit(failures ? 1 : 0);
