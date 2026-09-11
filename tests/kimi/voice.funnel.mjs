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

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, reducedMotion: opts.motion ? 'no-preference' : 'reduce' });
  const page = await ctx.newPage();
  const state = { errors: [], mints: [], leads: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.addInitScript(FAKE);
  await page.route('**/api/voice/session', r => {
    state.mints.push(JSON.parse(r.request().postData() || '{}'));
    if (opts.mint === 503) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'voice_unconfigured' }) });
    if (opts.mint === 429) return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'rate_limited' }) });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, value: 'ek_test_' + state.mints.length, expiresAt: 1, model: 'gpt-realtime', voice: 'marin', caps: Object.assign({ sessionSeconds: 900, softSeconds: 600, silenceMuteSeconds: 90 }, opts.caps || {}) }) });
  });
  await page.route('**/api/ask', r => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (body.mode === 'research') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.research === 'unknown' ? { ok: true, known: false, name: null, domain: null, employees: null, industry: null, competitors: [] } : KNOWN) });
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
    ok(await page.$eval('#voiceStart', b => b.classList.contains('is-live') && b.getAttribute('aria-pressed') === 'true' && /Chat is live/.test(b.textContent)), 'the button reads "Chat is live"');
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
    ok(r1.input === 'typed', 'and told the website is TYPED, not taken by ear');
    ok(/Type it in the box/.test((await strip(page)).status), 'the strip says so too: "' + (await strip(page)).status + '"');
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
    ok(r3.input === 'typed' && (await page.$eval('#agentInput', el => document.activeElement === el)), 'the email is a typed step and the caret is in the box');
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
    ok(await page.$eval('#voiceStart', b => /Chat with me/.test(b.textContent) && !b.classList.contains('is-live')), 'the button reads "Chat with me" again');
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
  for (const [code, re, reason] of [[503, /not available here yet/i, 'unconfigured'], [429, /rate-limited while it.s in beta/i, 'busy']]) {
    const { ctx, page } = await open({ mint: code });
    await page.click('#voiceStart');
    await page.waitForFunction(() => window.SAIVOICE.phase() === 'ended', null, { timeout: 8000 });
    const s = await strip(page);
    ok(re.test(s.status), code + ': "' + s.status + '"');
    ok((await tracked(page, 'voice_unavailable'))[0][1].reason === reason, '   reason ' + reason);
    ok(await page.evaluate(() => window.__voiceFake.connects === 0), '   no connection was attempted');
    const lay = await page.evaluate(() => { const w = document.querySelector('#voiceWave'), s = document.querySelector('#voiceStatus').getBoundingClientRect(), c = document.querySelector('#agentForm').getBoundingClientRect(); return { wave: getComputedStyle(w).display, left: s.left - c.left, h: document.querySelector('#voiceStrip').getBoundingClientRect().height }; });
    ok(lay.wave === 'none' && lay.left < 80 && lay.h < 40, '   one quiet line at the left, no empty wave (' + Math.round(lay.h) + 'px tall)');
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

  console.log('\n▶ the caps: the agent is told to wrap up at the soft cap, the session ends at the hard cap');
  {
    const { ctx, page } = await open({ caps: { softSeconds: 1, sessionSeconds: 2, silenceMuteSeconds: 900 } });
    await startVoice(page);
    await page.waitForFunction(() => window.__voiceFake.sent.some(e => e.type === 'response.create' && e.response && /quicker to type/i.test(e.response.instructions)), null, { timeout: 5000 });
    ok(true, 'at the soft cap the agent is told to say the rest is quicker to type');
    await page.waitForFunction(() => window.SAIVOICE.phase() === 'ended', null, { timeout: 5000 });
    const ended = await tracked(page, 'voice_session_ended');
    ok(ended.length === 1 && ended[0][1].reason === 'cap', 'at the hard cap the session ends {reason:cap}');
    ok(await page.evaluate(() => window.__voiceFake.closed === 1), 'the connection is closed');
    ok(!(await page.$eval('#agentInput', el => el.disabled)), 'the composer stays open for text');
    await ctx.close();
  }

  console.log('\n▶ silence: a quiet spell mutes the mic, a tap on the strip brings it back');
  {
    const { ctx, page } = await open({ caps: { silenceMuteSeconds: 1 } });
    await startVoice(page);
    await agentSays(page, 'What are you trying to solve?');
    await page.waitForFunction(() => window.SAIVOICE.state().muted === true, null, { timeout: 6000 });
    let s = await strip(page);
    ok(s.state === 'muted' && /quiet spell/i.test(s.status), 'muted after the quiet spell: "' + s.status + '"');
    ok((await vstate(page)).muteReason === 'silence' && (await tracked(page, 'voice_silence_mute')).length === 1, 'recorded as a silence mute');
    ok(await page.evaluate(() => window.__voiceFake.muted === true), 'the mic track is off');
    await page.click('#voiceWave');
    await page.waitForTimeout(100);
    ok((await vstate(page)).muted === false && await page.evaluate(() => window.__voiceFake.muted === false), 'a tap on the strip un-mutes');
    await ctx.close();
  }

  console.log('\n▶ the tab goes to the background: the mic is muted; coming back un-mutes');
  {
    const { ctx, page } = await open();
    await startVoice(page);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    ok((await vstate(page)).muted === true && (await vstate(page)).muteReason === 'hidden', 'hidden → muted');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    ok((await vstate(page)).muted === false, 'visible → un-muted');
    await ctx.close();
  }

  console.log('\n▶ Safari will not play until tapped: "Tap to hear", and the tap plays');
  {
    const { ctx, page } = await open();
    await fake(page, () => { window.__voiceFake.needTap = true; });
    await startVoice(page);
    await page.waitForFunction(() => /Tap to hear/.test(document.querySelector('#voiceStatus').textContent), null, { timeout: 3000 });
    ok(true, 'the strip says "Tap to hear"');
    ok(await page.evaluate(() => window.__voiceFake.gotAudioEl === true), 'the audio element was born inside the tap and handed to the transport');
    await page.click('#voiceWave');
    ok(await page.evaluate(() => window.__voiceFake.resumed === 1 && window.__voiceFake.needTap === false), 'the tap resumes playback');
    await ctx.close();
  }

  console.log('\n▶ the fast track by voice: request_contact puts the form up, quietly');
  {
    const { ctx, page, state } = await open();
    await startVoice(page);
    await agentSays(page, 'What are you trying to solve?');
    const before = (await thread(page)).length;
    const r = await toolCall(page, 'request_contact', { kind: 'call' });
    ok(r.status === 'CONTACT_CAPTURE' && r.shown.some(s => /contact form/.test(s)), 'the tool answers: the form is shown, wait (' + r.status + ')');
    ok(!!(await page.$('#heroLeadForm')), 'the form is in the thread');
    ok(await page.$eval('#agentThread .turnb--form .turnb__text', e => e.textContent.trim() === ''), 'with no written intro — the agent says it');
    ok((await thread(page)).length === before + 1, 'one new bubble: the form');
    await page.fill('#heroLeadForm [name=name]', 'Test Visitor');
    await page.fill('#heroLeadForm [name=email]', 'visitor@example-brand.com');
    await page.fill('#heroLeadForm [name=phone]', '+1 212 555 0100');
    await page.click('#heroLeadForm .askform__go');
    await page.waitForFunction(() => !document.querySelector('#heroLeadForm'), null, { timeout: 12000 });
    ok(state.leads.length === 1 && state.leads[0].discovery.contactRequest === 'call', 'the lead carries the call request');
    ok((await vstate(page)).phase === 'live', 'the voice stays open through it');
    await ctx.close();
  }

  console.log('\n▶ a session error from the API is treated as a drop: reconnect');
  {
    const { ctx, page, state } = await open();
    await startVoice(page);
    await emit(page, { type: 'error', error: { code: 'session_expired', message: 'Your session hit the maximum duration' } });
    await page.waitForFunction(() => window.SAIVOICE.state().reconnects > 0, null, { timeout: 5000 });
    await page.waitForFunction(() => window.SAIVOICE.phase() === 'live', null, { timeout: 10000 });
    ok(state.mints.length === 2 && (await tracked(page, 'voice_error')).length === 1, 'a fresh secret and a reconnect, the error recorded');
    await ctx.close();
  }

  console.log('\n▶ three drops in a row: give up honestly, text carries on');
  {
    const { ctx, page } = await open();
    await startVoice(page);
    for (let i = 0; i < 3; i++) {
      await fake(page, () => window.__voiceFake.drop('failed'));
      await page.waitForFunction(() => window.SAIVOICE.phase() === 'live' || window.SAIVOICE.phase() === 'ended', null, { timeout: 10000 });
    }
    await fake(page, () => window.__voiceFake.drop('failed'));
    await page.waitForFunction(() => window.SAIVOICE.phase() === 'ended', null, { timeout: 10000 });
    const s = await strip(page);
    ok(/Voice dropped/i.test(s.status), 'after the third reconnect fails again it says so: "' + s.status + '"');
    ok((await tracked(page, 'voice_session_ended')).some(e => e[1].reason === 'dropped'), 'voice_session_ended {reason:dropped}');
    ok(!(await page.$eval('#agentInput', el => el.disabled)), 'the composer is open for text');
    await ctx.close();
  }

  console.log('\n▶ the opening showcase: pictures fly, each product appears as it is named, then it all goes away');
  {
    const { ctx, page, state } = await open({ motion: true });
    await startVoice(page);
    ok(state.mints[0].showcase === true, 'a fresh start asks for the opening script');
    ok(!!(await page.$('.vstage.is-open')) && !(await page.$('.vstage--still')), 'the stage is up, with motion');
    ok(await page.$eval('#agentThread', t => getComputedStyle(t).display === 'none'), 'the thread waits underneath');
    ok((await page.$$('.vstage__frame')).length >= 4, 'the brand pictures are loaded for the burst');
    await page.waitForFunction(() => document.querySelector('.vstage.is-hero'), null, { timeout: 4000 });
    ok(true, 'the last picture flies out and NewVoices comes in');
    ok(await page.$eval('.vstage__heroname', e => e.textContent === 'NewVoices'), 'named on its card');
    /* the agent speaks the script, piece by piece, as the API would stream it */
    const V = await page.evaluate(() => window.SAI.data.kimi.copy.voice);
    const sc = V.showcase;
    await emit(page, { type: 'response.created', response: { id: 'r1' } });
    await emit(page, { type: 'response.output_item.added', item: { id: 'a1', type: 'message', role: 'assistant' } });
    await emit(page, { type: 'output_audio_buffer.started' });
    let said = '';
    const speak = async chunk => { const delta = (said ? ' ' : '') + chunk; said += delta; await emit(page, { type: 'response.output_audio_transcript.delta', item_id: 'a1', delta }); await page.waitForTimeout(80); };
    await speak(V.introduction); await speak(sc.flagship);
    ok((await page.$$('.vstage__tile')).length === 0, 'no product tile yet — none has been named');
    ok(await page.$eval('.vstage__caption', e => /good company/.test(e.textContent)), 'the caption follows the words: "' + (await page.$eval('.vstage__caption', e => e.textContent.slice(-50))) + '"');
    for (let i = 0; i < sc.products.length; i++) {
      await speak(sc.products[i].line);
      const tiles = await page.$$eval('.vstage__tile', els => els.map(e => e.dataset.product));
      ok(tiles.length === i + 1 && tiles[i] === sc.products[i].id, 'named → appears: ' + tiles.join(' → '));
    }
    ok(await page.$eval('.vstage__tile.is-current', (e, id) => e.dataset.product === id, sc.products[sc.products.length - 1].id), 'the one being described is the large one');
    ok((await page.$$('.vstage__tile.is-past')).length === sc.products.length - 1, 'the earlier ones have stepped aside');
    ok(await page.$eval('.vstage.is-deck .vstage__hero', e => e.getBoundingClientRect().width < 400), 'NewVoices has stepped into the corner');
    await speak(sc.pivot);
    await page.waitForFunction(() => !document.querySelector('.vstage'), null, { timeout: 6000 });
    ok(true, '"' + sc.closeOn + '" → the stage lifts away');
    ok(await page.$eval('#agentThread', t => getComputedStyle(t).display !== 'none'), 'and the thread is there underneath');
    const bubble = await page.$eval('#agentThread .turnb--ai .turnb__text', e => e.textContent);
    ok(bubble.includes('NewVoices') && bubble.includes(sc.pivot.slice(0, 40)), 'with the whole opening as one bubble, in sync with what was said');
    const ev = await tracked(page, 'voice_showcase_ended');
    ok(ev.length === 1 && ev[0][1].why === 'pivot' && ev[0][1].revealed === sc.products.length, 'voice_showcase_ended {why:pivot, revealed:' + sc.products.length + '}');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ the showcase steps aside the moment the visitor speaks or types — and never plays on a conversation begun in text');
  {
    const a = await open();
    await startVoice(a.page);
    await emit(a.page, { type: 'input_audio_buffer.speech_started' });
    await a.page.waitForFunction(() => !document.querySelector('.vstage'), null, { timeout: 3000 });
    ok((await tracked(a.page, 'voice_showcase_ended'))[0][1].why === 'barge', 'speaking over it: gone, recorded as a barge');
    await a.ctx.close();
    const b = await open();
    await startVoice(b.page);
    await b.page.fill('#agentInput', 'hello'); await b.page.press('#agentInput', 'Enter');
    await b.page.waitForFunction(() => !document.querySelector('.vstage'), null, { timeout: 3000 });
    ok((await tracked(b.page, 'voice_showcase_ended'))[0][1].why === 'typed', 'typing: gone, recorded as typed');
    await b.ctx.close();
    const c = await open();
    await c.page.fill('#agentInput', 'we need live competitive intelligence'); await c.page.press('#agentInput', 'Enter');
    await c.page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'), null, { timeout: 12000 });
    await startVoice(c.page);
    ok(!(await c.page.$('.vstage')) && c.state.mints[0].showcase === false, 'a conversation begun in text: no stage, and the brief is told to skip the script');
    await c.ctx.close();
  }

  console.log('\n▶ the showcase on a phone, and under reduced motion');
  {
    const { ctx, page } = await open({ viewport: { width: 390, height: 844 } });
    await startVoice(page);
    ok(!!(await page.$('.vstage--still')), 'reduced motion: the still variant (fades, no flight, no burst)');
    await page.waitForFunction(() => document.querySelector('.vstage.is-hero'), null, { timeout: 3000 });
    const g = await page.evaluate(() => { const s = document.querySelector('.vstage').getBoundingClientRect(), c = document.querySelector('#agentForm').getBoundingClientRect(); return { h: s.height, w: s.width, inside: s.left >= c.left - 1 && s.right <= c.right + 1, vh: innerHeight }; });
    ok(g.inside && g.h <= g.vh * 0.5 && g.w > 250, 'the stage fits the card and no more than half the screen (' + Math.round(g.h) + 'px of ' + g.vh + ')');
    await emit(page, { type: 'response.created', response: { id: 'r1' } });
    await emit(page, { type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'NewIntel — what your competitors did this week. QuestBrand — always-on brand tracking.' });
    await page.waitForTimeout(150);
    ok((await page.$$eval('.vstage__tile', els => els.map(e => e.dataset.product))).join(',') === 'newintel,questbrand', 'tiles appear on the phone too');
    await ctx.close();
  }

  console.log('\n▶ answer pills in voice mode: the agent speaks the question, the options hang under its words');
  {
    const { ctx, page, state } = await open({ research: 'unknown' });
    await startVoice(page);
    await agentSays(page, 'What are you trying to solve?');
    await toolCall(page, 'submit_answer', { text: 'we need to know what competitors are doing this week' });
    await agentSays(page, 'Got it. What is your website? Type it in the box below.');
    ok((await page.$$('#agentThread .turnb__chips')).length === 0, 'the website is typed: no pills for it');
    const r = await toolCall(page, 'submit_answer', { text: 'acme-brands.com' });
    ok(r.question && r.question.id === 'company_size' && r.question.options.length === 3, 'an unknown site → the size question, with three options for the model to offer');
    ok((await page.$$('#agentThread .turnb__chips')).length === 0, 'the pills wait for the agent to ask');
    await agentSays(page, 'Roughly how big is your company?', 'a_size');
    const chips = await page.$$eval('#agentThread .turnb--ai:last-child .turnb__chips .tag', els => els.map(e => e.textContent.trim()));
    ok(chips.join(' | ') === 'Under 250 people | 250 to 2,500 | 2,500 or more', 'the size pills hang under the spoken question: ' + chips.join(' | '));
    ok(await page.$eval('#agentThread .turnb--ai:last-child .turnb__text', e => /how big/i.test(e.textContent)), 'under the agent\'s own words, not a separate box');
    await page.click('#agentThread .turnb--ai:last-child .turnb__chips .tag:has-text("250 to 2,500")');
    await page.waitForTimeout(150);
    const created = await page.evaluate(() => window.__voiceFake.last('conversation.item.create'));
    ok(created && created.item.content && created.item.content[0].text === '250 to 2,500', 'a tap on a pill goes to the agent as the visitor\'s words');
    ok(await page.$eval('#agentThread .turnb--ai .turnb__chips .tag[aria-pressed="true"]', e => e.disabled), 'the pills settle once answered');
    const r2 = await toolCall(page, 'submit_answer', { text: '250 to 2,500' });
    ok(r2.question && r2.question.id === 'role' && r2.question.options.length === 4, 'the model relays it → the size lands, the role comes next with four options');
    await agentSays(page, 'And what is your role there?', 'a_role');
    ok((await page.$$eval('#agentThread .turnb--ai:last-child .turnb__chips .tag', els => els.length)) === 4, 'four role pills under the role question');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ typography: welcome in display type, names in bold, the question weighted');
  {
    const { ctx, page } = await open();
    await startVoice(page);
    await emit(page, { type: 'input_audio_buffer.speech_started' });
    await page.waitForFunction(() => !document.querySelector('.vstage'), null, { timeout: 3000 });
    const V = await page.evaluate(() => window.SAI.data.kimi.copy.voice);
    ok(/^Welcome to Stagwell AI\./.test(V.introduction) && /I'm NewVoices/.test(V.introduction), 'the introduction welcomes them to Stagwell AI first, then names itself: "' + V.introduction.slice(0, 60) + '…"');
    await agentSays(page, V.introduction + ' What are you trying to solve?');
    const t = await page.$eval('#agentThread .turnb--ai:last-child .turnb__text', e => ({
      lead: (e.querySelector('.t-lead') || {}).textContent || null,
      brands: [...e.querySelectorAll('.t-brand')].map(b => b.textContent),
      ask: (e.querySelector('.t-ask') || {}).textContent || null,
      text: e.textContent
    }));
    ok(t.lead === 'Welcome to Stagwell AI.', 'the welcome opens in display type: "' + t.lead + '"');
    ok(t.brands.includes('Stagwell AI') && t.brands.includes('NewVoices'), 'Stagwell AI and NewVoices in bold (' + t.brands.join(', ') + ')');
    ok(t.ask && /trying to solve\?/.test(t.ask), 'the question carries the weight: "' + t.ask.trim() + '"');
    ok(t.text.replace(/\s+/g, ' ').trim() === (V.introduction + ' What are you trying to solve?').replace(/\s+/g, ' '), 'and the words themselves are untouched');
    await agentSays(page, 'NewIntel tracks what your competitors did this week; QuestBrand benchmarks you against 2,500 rivals.');
    const b = await page.$eval('#agentThread .turnb--ai:last-child .turnb__text', e => ({ brands: [...e.querySelectorAll('.t-brand')].map(x => x.textContent), nums: [...e.querySelectorAll('.t-num')].map(x => x.textContent) }));
    ok(b.brands.join(',') === 'NewIntel,QuestBrand' && b.nums.join(',') === '2,500', 'product names bold, figures tabular (' + b.brands.join(',') + ' · ' + b.nums.join(',') + ')');
    await ctx.close();
  }

  console.log('\n▶ the thread follows the words as they stream in — and the page keeps the card in view');
  {
    const { ctx, page } = await open({ viewport: { width: 1360, height: 720 } });
    await startVoice(page);
    await emit(page, { type: 'input_audio_buffer.speech_started' });            /* the showcase steps aside */
    await page.waitForFunction(() => !document.querySelector('.vstage'), null, { timeout: 3000 });
    for (let i = 0; i < 6; i++) await agentSays(page, 'Line ' + i + ': ' + 'a fairly long sentence about competitors and pricing and hiring and coverage. '.repeat(3));
    await emit(page, { type: 'response.created', response: { id: 'rx' } });
    for (let i = 0; i < 12; i++) await emit(page, { type: 'response.output_audio_transcript.delta', item_id: 'ax', delta: 'more words arriving as the agent speaks them, ' });
    await page.waitForTimeout(250);
    const g = await page.$eval('#agentThread', t => ({ gap: t.scrollHeight - t.scrollTop - t.clientHeight, scrollable: t.scrollHeight > t.clientHeight }));
    ok(g.scrollable && g.gap < 40, 'the newest words are in view (gap to the bottom ' + Math.round(g.gap) + 'px)');
    const card = await page.$eval('#agentForm', f => ({ bottom: Math.round(f.getBoundingClientRect().bottom), vh: innerHeight, scrolled: Math.round(scrollY) }));
    ok(card.bottom <= card.vh + 2, 'the page scrolled so the composer is not cut off (card bottom ' + card.bottom + ' ≤ ' + card.vh + ', page scrolled ' + card.scrolled + 'px)');
    /* but a visitor who scrolled up to read is left where they are */
    await page.$eval('#agentThread', t => { t.scrollTop = 0; t.dispatchEvent(new Event('scroll')); });
    for (let i = 0; i < 6; i++) await emit(page, { type: 'response.output_audio_transcript.delta', item_id: 'ax', delta: 'and still more, ' });
    await page.waitForTimeout(200);
    ok(await page.$eval('#agentThread', t => t.scrollTop < 40), 'scrolled up to read: not yanked back down');
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
