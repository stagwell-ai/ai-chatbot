/* ═══════════════════════════════════════════════════════════════════════════
   VOICE — "Chat with me" (client, 2026-09-11; KIMI-VOICE-PLAN.md).

   One idea: the thread is the single source of truth. Voice is a second way in
   and out of the SAME conversation. What the visitor says is typed out; what
   the agent says is typed out; what the visitor types is answered by voice
   while the session is open. The Kimi flow (SAIKIMI) stays the state — the
   Realtime model can only move a step through SAIKIMI.tools.

   Shape:
     mint  POST /api/voice/session → a two-minute client secret (never the key)
     connect  WebRTC to OpenAI Realtime: mic up, audio down, events on a data
              channel — behind a transport seam (window.__SAIVOICE_TRANSPORT)
              so the tests run a fake peer
     events → SAIVOICEREDUCER → ops → bubbles in the thread + tool calls
     hero-agent.js draws the structures (fact list, cards, form, Book a call)
              from the flow as always; in voice mode it draws no question text,
              because the agent is saying it

   Caps (from the mint): a soft cap where the agent wraps up, a hard cap where
   the session ends, a silence mute so an abandoned tab runs up nothing.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const H = window.SAIHERO, K = window.SAIKIMI, S = window.SAI, VR = window.SAIVOICEREDUCER, WAVE = window.SAIVOICEWAVE;
if (!H || !K || !S || !VR) return;

const $ = (sel, root) => (root || document).querySelector(sel);
const strip = $('#voiceStrip'), startBtn = $('#voiceStart'), muteBtn = $('#voiceMute'), endBtn = $('#voiceEnd'),
      statusEl = $('#voiceStatus'), waveEl = $('#voiceWave'), input = $('#agentInput');
if (!strip || !startBtn) return;

const copy = () => ((((S.data || {}).kimi || {}).copy || {}).voice) || {};
const flags = () => ((S.data || {}).kimi || {}).flags || {};
const esc = s => H.esc(String(s == null ? '' : s));
const track = (name, props) => { try { const a = window.SAIANALYTICS; if (a) a.track(name, props || {}); else S.events.emit(name, props || {}); } catch (e) {} };

/* ── can this browser do it at all? ── */
const fakeTransport = () => window.__SAIVOICE_TRANSPORT || null;
const secure = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const supported = !!fakeTransport() || (secure && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof RTCPeerConnection === 'function');
if (!supported || flags().voice === false) { startBtn.hidden = true; return; }

/* ── state ── */
let phase = 'idle';            /* idle | minting | connecting | live | reconnecting | ended */
let conn = null;               /* the transport connection */
let rstate = VR.blank();       /* the reducer's */
let sub = 'listening';         /* the strip while live: listening | speaking | thinking | muted */
let muted = false, muteReason = null, speakerMuted = false;
let bubbles = {}, meBubbles = {};
let startedAt = 0, turns = 0, lastActivity = 0, reconnects = 0, caps = null, model = null;
let wave = null, timers = [], ticker = 0, toolBusy = 0;

/* ── the strip ── */
function setStatus(text, tone) {
  if (statusEl) statusEl.textContent = text || '';
  strip.dataset.tone = tone || '';
}
function stripState() {
  if (phase === 'live') return muted ? 'muted' : sub;
  if (phase === 'reconnecting') return 'reconnecting';
  if (phase === 'minting' || phase === 'connecting') return 'connecting';
  return 'ended';
}
function paint() {
  const c = copy();
  strip.dataset.state = stripState();
  startBtn.classList.toggle('is-live', phase === 'live' || phase === 'reconnecting');
  startBtn.setAttribute('aria-pressed', phase === 'live' || phase === 'reconnecting' ? 'true' : 'false');
  const live = phase === 'live' || phase === 'reconnecting' || phase === 'minting' || phase === 'connecting';
  if (muteBtn) { muteBtn.hidden = !live; muteBtn.textContent = muted ? (c.unmute || 'Unmute') : (c.mute || 'Mute'); muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false'); }
  if (endBtn) endBtn.hidden = !live;
  if (phase === 'live') {
    if (muted) setStatus(muteReason === 'silence' ? (c.mutedSilence || 'Muted after a quiet spell — tap Unmute to carry on') : (c.muted || 'Muted'));
    else setStatus(sub === 'speaking' ? (c.speaking || 'Speaking') : sub === 'thinking' ? (c.thinking || 'Thinking') : (c.listening || 'Listening'));
  }
}
function setSub(s) { sub = s; paint(); }

/* ── mint ── */
async function mint(resume) {
  const body = { page: location.pathname };
  if (resume) body.resume = resume;
  let r;
  try {
    r = await fetch('/api/voice/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) { throw tag('network'); }
  let j = null; try { j = await r.json(); } catch (e) { j = null; }
  if (r.status === 429) throw tag('busy');
  if (r.status === 503) throw tag('unconfigured');
  if (!r.ok || !j || !j.ok || !j.value) throw tag('network');
  return j;
}
const tag = (reason, e) => { const err = e || new Error(reason); err.reason = reason; return err; };

/* what the model needs to know to pick up a conversation that began in text
   (or was cut by a dropped connection): the state, in a few plain lines */
function resumeSummary() {
  const st = K.state();
  if (!st || st.status === 'IDLE') return null;
  const parts = [];
  if (st.rawProblemText) parts.push('They said: "' + String(st.rawProblemText).slice(0, 200) + '".');
  if (st.primaryGoal) parts.push('Goal: ' + st.primaryGoal + '.');
  if (st.intents && st.intents.length) {
    const tax = ((S.data || {}).taxonomy || {}).intents || [];
    const needs = st.intents.map(i => { const t = tax.find(x => x.id === i.id); return t && t.need ? t.need : i.id; });
    parts.push('Needs: ' + needs.join('; ') + '.');
  }
  if (st.website && st.website !== '__skip__') parts.push('Website: ' + st.website + '.');
  if (st.findings && st.findings.name) parts.push('Company: ' + st.findings.name + (st.findings.industry ? ' (' + st.findings.industry + ')' : '') + '.');
  if (st.companySize) parts.push('Company size: ' + st.companySize + '.');
  if (st.role) parts.push('Role: ' + st.role + '.');
  if (st.cards && st.cards.length) parts.push('Recommended: ' + st.cards.map(c => c.productName).join(', ') + '.');
  if (st.lead && st.lead.email) parts.push('Email given.');
  if (st.lead && st.lead.phone) parts.push('Phone given.');
  const view = K.tools && K.tools.view ? K.tools.view() : null;
  return { summary: parts.join(' ').slice(0, 1200), step: view && view.step ? view.step : '' };
}

/* ── iOS unlock: the audio element and the AudioContext must be born inside
   the tap, or Safari refuses to play the agent later. start() calls this
   synchronously before its first await and hands the pair to the transport. */
function unlockAudio() {
  let audioEl = null, actx = null;
  try {
    audioEl = document.createElement('audio');
    audioEl.autoplay = true; audioEl.setAttribute('playsinline', ''); audioEl.hidden = true;
    document.body.appendChild(audioEl);
    if (typeof MediaStream === 'function') { audioEl.srcObject = new MediaStream(); audioEl.play().catch(() => {}); }
  } catch (e) { audioEl = null; }
  try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { actx = new AC(); if (actx.state === 'suspended') actx.resume().catch(() => {}); } } catch (e) { actx = null; }
  return { audioEl, actx };
}

/* ── transport: WebRTC to OpenAI, or the injected fake ── */
async function webrtcConnect(o) {
  let mic;
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    const name = e && e.name;
    throw tag(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'nomic' : 'network', e);
  }
  const pc = new RTCPeerConnection();
  let audioEl = o.audioEl;
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.autoplay = true; audioEl.setAttribute('playsinline', ''); audioEl.hidden = true;
    document.body.appendChild(audioEl);
  }
  let remote = null, needTap = false;
  pc.ontrack = e => {
    remote = e.streams && e.streams[0];
    audioEl.srcObject = remote;
    audioEl.play().catch(() => { needTap = true; o.onNeedTap && o.onNeedTap(); });
  };
  mic.getTracks().forEach(t => pc.addTrack(t, mic));
  const dc = pc.createDataChannel('oai-events');
  dc.onmessage = ev => { try { o.onEvent(JSON.parse(ev.data)); } catch (e) { /* not ours */ } };
  let gone = false;
  const lost = why => { if (gone) return; gone = true; o.onClose && o.onClose(why); };
  dc.onclose = () => lost('datachannel');
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === 'failed' || s === 'closed') lost(s);
    /* a blip on a phone: 'disconnected' often heals itself — give it three seconds */
    else if (s === 'disconnected') setTimeout(() => { if (pc.connectionState === 'disconnected') lost('disconnected'); }, 3000);
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const r = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { authorization: 'Bearer ' + o.secret, 'content-type': 'application/sdp' }, body: offer.sdp });
  if (!r.ok) { try { pc.close(); } catch (e) {} mic.getTracks().forEach(t => t.stop()); audioEl.remove(); throw tag('network', new Error('sdp_' + r.status)); }
  await pc.setRemoteDescription({ type: 'answer', sdp: await r.text() });

  /* the wave's ears: one analyser per direction */
  const AC = window.AudioContext || window.webkitAudioContext;
  const actx = o.audioContext || (AC ? new AC() : null);
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  let userA = null, agentA = null;
  if (actx) { userA = actx.createAnalyser(); userA.fftSize = 256; try { actx.createMediaStreamSource(mic).connect(userA); } catch (e) { userA = null; } }
  const attachAgent = () => { if (actx && remote && !agentA) { try { agentA = actx.createAnalyser(); agentA.fftSize = 256; actx.createMediaStreamSource(remote).connect(agentA); } catch (e) { agentA = null; } } };
  const buf = new Uint8Array(256);
  const level = a => { if (!a) return 0; a.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; s += x * x; } return Math.min(1, Math.sqrt(s / buf.length) * 3.2); };

  return {
    ready: new Promise((res, rej) => { if (dc.readyState === 'open') res(); dc.onopen = () => res(); setTimeout(() => rej(tag('network', new Error('datachannel_timeout'))), 15000); }),
    send: obj => { if (dc.readyState === 'open') dc.send(JSON.stringify(obj)); },
    close: () => { try { dc.close(); } catch (e) {} try { pc.close(); } catch (e) {} mic.getTracks().forEach(t => t.stop()); audioEl.remove(); if (actx) actx.close().catch(() => {}); },
    setMuted: m => mic.getAudioTracks().forEach(t => { t.enabled = !m; }),
    setSpeakerMuted: m => { audioEl.muted = !!m; },
    resumeAudio: () => audioEl.play().then(() => { needTap = false; }),
    needsTap: () => needTap,
    levels: () => { attachAgent(); return { user: level(userA), agent: level(agentA) }; }
  };
}
const transport = () => fakeTransport() || { connect: webrtcConnect };

/* ── the session ── */
const sendAll = evs => { if (!conn) return; (evs || []).forEach(e => conn.send(e)); };
const c = () => copy();

async function start() {
  if (phase === 'minting' || phase === 'connecting' || phase === 'live' || phase === 'reconnecting') return;
  const startedFromText = K.state().status !== 'IDLE';
  const unlock = unlockAudio();          /* inside the tap, before any await */
  phase = 'minting'; strip.hidden = false; paint();
  setStatus((c().connecting || 'Connecting…') + ' ' + (c().consent || ''));
  try {
    const m = await mint(resumeSummary());
    caps = m.caps || {}; model = m.model || null;
    phase = 'connecting'; paint();
    conn = await transport().connect({ secret: m.value, model, onEvent, onClose, audioEl: unlock.audioEl, audioContext: unlock.actx, onNeedTap: () => setStatus(c().tap || 'Tap to hear', 'warn') });
    await conn.ready;
    rstate = VR.blank(); bubbles = {}; meBubbles = {};
    phase = 'live'; sub = 'thinking'; muted = false; muteReason = null; reconnects = 0;
    startedAt = Date.now(); lastActivity = startedAt; turns = 0;
    paint();
    H.open();
    const restartBtn = $('#agentRestart'); if (restartBtn) restartBtn.hidden = false;
    if (WAVE && waveEl && !wave) wave = WAVE.create(waveEl, () => (conn && conn.levels ? conn.levels() : { user: 0, agent: 0 }), stripState);
    if (wave) wave.start();
    armTimers();
    track('voice_session_started', { model, resumed: startedFromText });
    /* the agent speaks first: a greeting and step 1, or picks up where the text left off */
    sendAll([{ type: 'response.create' }]);
  } catch (e) {
    /* the reason, whichever transport threw it: a refused microphone is the
       one the visitor can do something about */
    const name = e && e.name;
    fail((e && e.reason) || (name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'nomic' : 'network'), e);
  }
}

function fail(reason, e) {
  const wasLive = phase === 'live' || phase === 'reconnecting';
  teardown();
  phase = 'ended'; paint();
  const U = c().unavailable || {};
  setStatus(U[reason] || U.network || 'Voice could not connect — carry on typing.', 'error');
  strip.hidden = false;
  track(wasLive ? 'voice_session_ended' : 'voice_unavailable', wasLive ? { seconds: Math.round((Date.now() - startedAt) / 1000), turns, reason } : { reason });
  if (e && !(e.reason)) { try { console.warn('[voice]', e); } catch (x) {} }
}

function teardown() {
  timers.forEach(t => clearTimeout(t)); timers = [];
  if (ticker) { clearInterval(ticker); ticker = 0; }
  if (conn) { try { conn.close(); } catch (e) {} conn = null; }
  if (wave) { wave.stop(); wave = null; }
  document.querySelectorAll('#agentThread .turnb--interim').forEach(el => el.classList.remove('turnb--interim'));
}

function end(reason) {
  if (phase === 'idle' || phase === 'ended') return;
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  if (conn && rstate.response) sendAll(VR.clientEvents.cancel());
  teardown();
  phase = 'ended'; muted = false; paint();
  setStatus(c().ended || 'Voice ended — carry on typing, or start it again.');
  track('voice_session_ended', { seconds, turns, reason: reason || 'user' });
  /* the strip steps aside after a moment; the thread and the flow stay */
  timers.push(setTimeout(() => { if (phase === 'ended') { strip.hidden = true; phase = 'idle'; paint(); } }, 6000));
}

/* the connection went away under us: three tries, primed with what we know */
async function onClose(why) {
  if (phase !== 'live') return;
  if (reconnects >= 3) { fail('dropped'); return; }
  reconnects++;
  phase = 'reconnecting'; paint();
  setStatus(c().reconnecting || 'Reconnecting…');
  if (conn) { try { conn.close(); } catch (e) {} conn = null; }
  try {
    await new Promise(r => setTimeout(r, 800 * reconnects));
    const m = await mint(resumeSummary());
    conn = await transport().connect({ secret: m.value, model: m.model, onEvent, onClose, onNeedTap: () => setStatus(c().tap || 'Tap to hear', 'warn') });
    await conn.ready;
    rstate = VR.blank();
    phase = 'live'; sub = 'thinking'; paint();
    if (muted) conn.setMuted(true);
    track('voice_reconnected', { attempt: reconnects, why: String(why || '') });
    sendAll([{ type: 'response.create', response: { instructions: c().back || 'You are reconnected. Say one short line that you are back, then continue with the current step.' } }]);
  } catch (e) {
    if (reconnects >= 3) fail('dropped', e); else onClose(why);
  }
}

/* ── caps ── */
function armTimers() {
  const soft = Number(caps && caps.softSeconds) || 600, hard = Number(caps && caps.sessionSeconds) || 900, quiet = Number(caps && caps.silenceMuteSeconds) || 90;
  timers.push(setTimeout(() => { if (phase === 'live') sendAll([{ type: 'response.create', response: { instructions: c().timeUp || 'Time is nearly up: say that the rest is quicker to type, then stop.' } }]); }, soft * 1000));
  timers.push(setTimeout(() => { if (phase === 'live' || phase === 'reconnecting') end('cap'); }, hard * 1000));
  ticker = setInterval(() => {
    if (phase !== 'live' || muted) return;
    if (Date.now() - lastActivity > quiet * 1000 && !rstate.speaking && !rstate.response && !toolBusy) { mute(true, 'silence'); track('voice_silence_mute', {}); }
  }, Math.max(250, Math.min(5000, quiet * 1000 / 3)));
}
document.addEventListener('visibilitychange', () => {
  if (phase !== 'live') return;
  if (document.hidden) { if (!muted) mute(true, 'hidden'); if (wave) wave.pause(); }
  else { if (wave) wave.resume(); if (muted && muteReason === 'hidden') mute(false); }
});

function mute(m, reason) {
  muted = !!m; muteReason = muted ? (reason || 'user') : null;
  if (conn && conn.setMuted) conn.setMuted(muted);
  if (muted && reason === 'user') track('voice_muted', {}); else if (!muted) lastActivity = Date.now();
  paint();
}

/* ── events → the thread and the flow ── */
function onEvent(ev) {
  const r = VR.reduce(rstate, ev);
  rstate = r.state;
  r.ops.forEach(apply);
}

function bubbleText(el, text, cls) {
  let t = el.querySelector('.turnb__text');
  if (!t) { t = document.createElement('div'); t.className = 'turnb__text'; el.insertBefore(t, el.firstChild); }
  t.innerHTML = esc(text).replace(/\?/g, '<span class="q">?</span>');
  if (cls) el.classList.add(cls);
}

function apply(op) {
  switch (op.op) {
    case 'user.speaking':
      lastActivity = Date.now();
      if (sub !== 'speaking') setSub('listening');
      break;
    case 'user.silent':
      break;
    case 'me.interim': {
      const el = meBubbles[op.itemId] || (meBubbles[op.itemId] = H.me(''));
      el.classList.add('turnb--interim');
      el.textContent = op.text;
      break;
    }
    case 'me.final': {
      const el = meBubbles[op.itemId] || (meBubbles[op.itemId] = H.me(''));
      el.classList.remove('turnb--interim');
      el.textContent = op.text;
      if (!op.text) el.remove();
      else { turns++; lastActivity = Date.now(); H.settleChips(); }
      break;
    }
    case 'ai.start':
      setSub('thinking');
      break;
    case 'ai.delta': {
      const el = bubbles[op.itemId] || (bubbles[op.itemId] = H.ai('', null, null, null));
      bubbleText(el, op.text);
      if (!rstate.speaking) setSub('speaking');
      break;
    }
    case 'ai.done': {
      const el = bubbles[op.itemId] || (bubbles[op.itemId] = H.ai('', null, null, null));
      bubbleText(el, op.text);
      if (!op.text) el.remove();
      break;
    }
    case 'ai.cutoff': {
      const el = bubbles[op.itemId];
      if (el && !el.classList.contains('turnb--cutoff')) { el.classList.add('turnb--cutoff'); track('voice_barge_in', {}); }
      break;
    }
    case 'ai.end':
      lastActivity = Date.now();
      if (!rstate.speaking) setSub(muted ? 'muted' : 'listening');
      break;
    case 'agent.speaking':
      setSub('speaking');
      break;
    case 'agent.silent':
      if (!rstate.response) setSub(muted ? 'muted' : 'listening');
      break;
    case 'tool.call':
      runTool(op);
      break;
    case 'error':
      track('voice_error', { code: op.code });
      if (/session|expired|token/i.test(op.code + ' ' + op.message) && phase === 'live') onClose('expired');
      break;
    default:
      break;
  }
}

/* the model's hands are the flow's: run the step, hand back what may be said */
async function runTool(op) {
  toolBusy++;
  setSub('thinking');
  let out;
  try {
    const fn = K.tools && K.tools[op.name];
    if (op.name === 'start_over') {
      const HA = window.SAIHEROAGENT;
      if (HA && HA.restart) HA.restart({ fromVoice: true });
      bubbles = {}; meBubbles = {};
      out = fn ? await fn(op.args) : {};
    } else out = fn ? await fn(op.args || {}) : { error: 'unknown_tool', known: Object.keys(K.tools || {}) };
  } catch (e) { out = { error: 'tool_failed' }; }
  toolBusy--;
  track('voice_tool_call', { name: op.name, status: out && out.status ? out.status : null });
  sendAll(VR.clientEvents.toolResult(op.callId, out));
}

/* ── typed text while the voice is open ── */
function sendText(text) {
  const v = String(text == null ? '' : text).trim();
  if (!v || phase !== 'live') return false;
  H.open();
  H.me(v);
  H.settleChips();
  turns++; lastActivity = Date.now();
  if (rstate.response || rstate.speaking) sendAll(VR.clientEvents.cancel());
  sendAll(VR.clientEvents.userText(v));
  setSub('thinking');
  return true;
}

/* Start over pressed on the card while the voice is open: the flow and the
   thread are cleared by hero-agent; the agent is told and greets again */
function onRestart() {
  if (phase !== 'live') return;
  bubbles = {}; meBubbles = {};
  if (rstate.response || rstate.speaking) sendAll(VR.clientEvents.cancel());
  sendAll([{ type: 'response.create', response: { instructions: c().restarted || 'The visitor started over. Greet them again in one short line and ask what they want to solve.' } }]);
}

/* ── wiring ── */
startBtn.addEventListener('click', () => {
  if (phase === 'live' || phase === 'reconnecting') { end('user'); return; }
  if (conn && conn.needsTap && conn.needsTap()) { conn.resumeAudio().catch(() => {}); return; }
  start();
});
if (muteBtn) muteBtn.addEventListener('click', () => mute(!muted, 'user'));
if (endBtn) endBtn.addEventListener('click', () => end('user'));
strip.addEventListener('click', e => {
  /* a tap on the strip itself: un-mute after a quiet spell, or let Safari play */
  if (e.target.closest('button')) return;
  if (phase === 'live' && muted) mute(false);
  if (conn && conn.needsTap && conn.needsTap()) conn.resumeAudio().catch(() => {});
});
startBtn.textContent = '';
startBtn.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="7" y="2.5" width="6" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5M7.5 17.5h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>' + esc(c().start || 'Chat with me') + '</span>');
paint();

window.SAIVOICE = {
  start, end, mute, sendText, onRestart,
  live: () => phase === 'live' || phase === 'reconnecting',
  phase: () => phase,
  state: () => ({ phase, sub, muted, muteReason, turns, reconnects, model, startedAt })
};
})();
