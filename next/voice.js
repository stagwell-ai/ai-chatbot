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
const H = window.SAIHERO, K = window.SAIKIMI, S = window.SAI, VR = window.SAIVOICEREDUCER, WAVE = window.SAIVOICEWAVE, STAGE = window.SAIVOICESTAGE;
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
/* the opening showcase (voice-stage.js): up while the agent speaks its
   script, driven by the transcript, gone when it says "let's get to know each
   other" — or the moment the visitor talks or types */
let stage = null, intro = null;      /* intro = { responseId, text, revealed:Set, fallback:timer } */

/* ── DIAGNOSTICS ──
   ?voicedebug=1 (or localStorage sai-voice-debug=1) shows a panel under the
   strip: the phase, the microphone track's real state, the connection state,
   what OpenAI accepted at the mint, and the last events on the wire — so a
   "it doesn't hear me" can be read off a screenshot. Also logs to the console. */
const DEBUG = (() => { try { return /[?&]voicedebug=1/.test(location.search) || localStorage.getItem('sai-voice-debug') === '1'; } catch (e) { return false; } })();
const dlog = [];
let debugEl = null, accepted = null, heardSpeech = false, micEnergyHits = 0, rescued = false;
function dbg(kind, detail) {
  const line = new Date().toISOString().slice(11, 19) + ' ' + kind + (detail ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 160) : '');
  dlog.push(line); if (dlog.length > 40) dlog.shift();
  if (DEBUG) { try { console.debug('[voice]', line); } catch (e) {} }
  paintDebug();
}
function paintDebug() {
  if (!DEBUG) return;
  if (!debugEl) { debugEl = document.createElement('pre'); debugEl.className = 'voice__debug'; strip.insertAdjacentElement('afterend', debugEl); }
  const mic = conn && conn.micState ? conn.micState() : null;
  const pc = conn && conn.pcState ? conn.pcState() : null;
  debugEl.textContent =
    'phase ' + phase + ' · sub ' + sub + ' · muted ' + muted + ' · heardSpeech ' + heardSpeech + ' · micEnergyHits ' + micEnergyHits + '\n' +
    'mic ' + (mic ? JSON.stringify(mic) : '—') + '\n' +
    'pc ' + (pc ? JSON.stringify(pc) : '—') + '\n' +
    'accepted ' + (accepted ? JSON.stringify(accepted) : '—') + '\n' +
    dlog.slice(-18).join('\n');
}
/* the rescue: the mic clearly carries sound but the server never says
   speech_started — try plain server VAD once, and say what is going on */
function watchHearing() {
  if (!conn || phase !== 'live' || heardSpeech || rescued) return;
  const L = conn.levels ? conn.levels() : { user: 0 };
  if (L.user > 0.08 && !muted) micEnergyHits++;
  if (micEnergyHits >= 12 && !rstate.speaking) {
    rescued = true;
    dbg('rescue', 'mic energy but no speech_started → session.update server_vad');
    track('voice_no_input_detected', { micEnergyHits, accepted: accepted || null });
    sendAll(VR.clientEvents.sessionUpdate({ audio: { input: { turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true } } } }));
    setStatus(c().cantHear || 'Not hearing you? Check the mic isn\'t muted, or type below.', 'warn');
  }
}

/* ── the opening, in two beats (client, 2026-09-11: "the timing here was too
   fast … give them an opportunity to say something first") ──
   1. the agent greets and STOPS; a few questions the visitor might ask hang
      under its words as animated pills, with one focused pill: "What is
      Stagwell AI?"
   2. the story (the showcase) plays only when asked for — the hero pill, or
      the visitor asking aloud — slowly, after the agent has said they may
      interrupt at any time. */
let storyShown = false;
function starterChips() {
  const st = c().starters || {};
  const qs = (st.questions || []).map(q => (typeof q === 'string' ? { label: q, value: q } : q)).filter(q => q && q.label);
  const hero = st.hero ? (typeof st.hero === 'string' ? { label: st.hero, value: st.hero } : st.hero) : null;
  return (hero ? [Object.assign({ hero: true }, hero)] : []).concat(qs);
}
function offerStarters() {
  const chips = starterChips();
  if (!chips.length) return;
  offerChips(chips, chip => {
    track('voice_starter_tapped', { hero: !!chip.hero, label: String(chip.label).slice(0, 60) });
    if (chip.hero) explain('pill', chip.value); else sendText(chip.value);
  }, { fallback: false, cls: 'turnb__chips--starters' });
}
/* the story, asked for: the pictures rise at once and the agent is asked, in
   the visitor's words, what Stagwell AI is — its brief carries the script */
function explain(via, words) {
  if (phase !== 'live') return false;
  const q = String(words || (c().starters || {}).hero || 'What is Stagwell AI?');
  if (pendingChips) { if (pendingChips.timer) clearTimeout(pendingChips.timer); pendingChips = null; }
  H.open();
  H.me(q);
  H.settleChips();
  turns++; lastActivity = Date.now();
  if (rstate.response || rstate.speaking) sendAll(VR.clientEvents.cancel());
  openStage(via || 'pill');
  sendAll(VR.clientEvents.userText(q));
  setSub('thinking');
  return true;
}

/* ── the showcase (voice-stage.js) ── */
function showcaseCfg() {
  const sc = c().showcase || {};
  const products = ((S.data || {}).solutions || {}).solutions || [];
  const byId = id => products.find(p => p && p.id === id && p.active !== false);
  return {
    burst: sc.burst || [],
    self: sc.self || { name: 'NewVoices', sub: '', img: '' },
    teamLabel: sc.teamLabel || 'The Stagwell AI team',
    /* each member of the team carries its emblem (an icon key the stage
       draws) and its own mark — the catalog's lockup, when it has one
       ("when each of them is named, display the logo, or some kind of SVG
       icon … like introducing a team of superheroes", client 2026-09-11) */
    products: (sc.products || []).map(p => { const P = byId(p.id); return P ? { id: p.id, name: P.name, line: p.line, img: p.img, icon: p.icon || null, lockup: P.lockup || null } : null; }).filter(Boolean),
    openOn: sc.openOn || 'flagship',
    closeOn: sc.closeOn || 'get to know each other'
  };
}
function openStage(via) {
  if (!STAGE || flags().voiceShowcase === false || stage) return;
  const host = $('#agentForm'); if (!host) return;
  const cfg = showcaseCfg();
  if (!cfg.products.length) return;
  storyShown = true;
  stage = STAGE.create(host, cfg);
  stage.open();
  intro = { responseId: null, text: '', cfg, fallback: null, started: Date.now() };
  /* a clock only as the net under the transcript: if the words never name a
     product, the tiles still come — slowly, the story is paced for a listener
     — and nothing stays up past 90 s */
  intro.fallback = setTimeout(() => { if (intro && stage) revealByClock(); }, 14000);
  timers.push(intro.fallback);
  timers.push(setTimeout(() => closeStage('timeout'), 90000));
  track('voice_showcase_started', { products: cfg.products.length, via: via || 'voice' });
}
function revealByClock() {
  if (!intro || !stage) return;
  const next = intro.cfg.products.find(p => stage.state().revealed.indexOf(p.id) === -1);
  if (!next) return;
  stage.reveal(next.id);
  intro.fallback = setTimeout(revealByClock, 5000);
  timers.push(intro.fallback);
}
/* the visitor asked aloud what Stagwell AI is: the agent's words reach the
   story's first beat, and the pictures rise to meet them */
function maybeOpenStage(text) {
  if (stage || storyShown || phase !== 'live') return;
  const cfg = showcaseCfg();
  if (cfg.openOn && String(text).toLowerCase().indexOf(String(cfg.openOn).toLowerCase()) !== -1) openStage('voice');
}
/* the agent's words so far → the tiles they name, in order; the pivot closes */
function followTranscript(text) {
  if (!intro || !stage) return;
  intro.text = text;
  stage.caption(text);
  const low = text.toLowerCase();
  intro.cfg.products.forEach(p => { if (low.indexOf(p.name.toLowerCase()) !== -1) { if (stage.reveal(p.id) && intro.fallback) { clearTimeout(intro.fallback); intro.fallback = null; } } });
  /* the pivot: the whole team assembles for a beat, then the stage lifts away */
  if (intro.cfg.closeOn && low.indexOf(String(intro.cfg.closeOn).toLowerCase()) !== -1) { if (stage.assemble) stage.assemble(); closeStage('pivot', 2400); }
}
function closeStage(why, delay) {
  if (!stage) return;
  const s = stage; stage = null;
  const seconds = intro ? Math.round((Date.now() - intro.started) / 1000) : 0;
  const revealed = s.state().revealed.length;
  intro = null;
  const go = () => s.close(why);
  if (delay) timers.push(setTimeout(go, delay)); else go();
  track('voice_showcase_ended', { why, seconds, revealed });
}

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
  const on = phase === 'live' || phase === 'reconnecting';
  startBtn.classList.toggle('is-live', on);
  startBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  /* "if I'm in a chat, then it should say 'chat is live', not 'Chat with me'" */
  const label = startBtn.querySelector('span');
  if (label) label.textContent = on ? (c.live || 'Chat is live') : (phase === 'minting' || phase === 'connecting') ? (c.connecting || 'Connecting…') : (c.start || 'Chat with me');
  startBtn.setAttribute('aria-label', on ? (c.live || 'Chat is live') + ' — end the voice chat' : (c.start || 'Chat with me'));
  const live = phase === 'live' || phase === 'reconnecting' || phase === 'minting' || phase === 'connecting';
  if (muteBtn) { muteBtn.hidden = !live; muteBtn.textContent = muted ? (c.unmute || 'Unmute') : (c.mute || 'Mute'); muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false'); }
  if (endBtn) endBtn.hidden = !live;
  if (phase === 'live') {
    if (muted) setStatus(muteReason === 'silence' ? (c.mutedSilence || 'Muted after a quiet spell — tap Unmute to carry on') : (c.muted || 'Muted'));
    else if (sub === 'listening' && typedStep()) setStatus(c.typeIt || 'Type it in the box below', 'warn');
    else setStatus(sub === 'speaking' ? (c.speaking || 'Speaking') : sub === 'thinking' ? (c.thinking || 'Thinking') : (c.listening || 'Listening'));
  }
}
/* websites, emails and phone numbers are typed, never taken by ear (client,
   2026-09-11): while the flow waits for one, the strip says so */
function typedStep() {
  const st = K.state();
  return !!(st && ((st.question && st.question.field === 'website') || st.status === 'CAPTURE_EMAIL' || st.status === 'CAPTURE_PHONE'));
}
K.onChange(() => { if (phase === 'live') paint(); });
function setSub(s) { sub = s; paint(); }

/* ── mint ── */
async function mint(resume, extra) {
  const body = Object.assign({ page: location.pathname }, extra || {});
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
function resumeSummary(reason) {
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
  /* 'join': voice joining a conversation begun in writing — the agent opens
     with a quick handoff ("I've just been handed our chat and caught up: …");
     'reconnect': back after a drop — one line that it is back */
  return { summary: parts.join(' ').slice(0, 1200), step: view && view.step ? view.step : '', reason: reason || 'join' };
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
    micState: () => { const t = mic.getAudioTracks()[0]; return t ? { enabled: t.enabled, muted: t.muted, readyState: t.readyState, label: String(t.label || '').slice(0, 40), senders: pc.getSenders().filter(s => s.track && s.track.kind === 'audio').length } : { none: true }; },
    pcState: () => ({ connection: pc.connectionState, ice: pc.iceConnectionState, signaling: pc.signalingState, dc: dc.readyState, remote: !!remote }),
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
const sendAll = evs => { if (!conn) return; (evs || []).forEach(e => { dbg('→', e.type); conn.send(e); }); };
const c = () => copy();

async function start() {
  if (phase === 'minting' || phase === 'connecting' || phase === 'live' || phase === 'reconnecting') return;
  const startedFromText = K.state().status !== 'IDLE';
  const unlock = unlockAudio();          /* inside the tap, before any await */
  phase = 'minting'; strip.hidden = false; paint();
  setStatus((c().connecting || 'Connecting…') + ' ' + (c().consent || ''));
  try {
    /* the showcase plays on a fresh start only; a conversation begun in text
       gets a one-line greeting and picks up */
    const m = await mint(resumeSummary('join'), { showcase: !startedFromText });
    caps = m.caps || {}; model = m.model || null; accepted = m.accepted || null;
    dbg('minted', accepted || 'no echo');
    phase = 'connecting'; paint();
    conn = await transport().connect({ secret: m.value, model, onEvent, onClose, audioEl: unlock.audioEl, audioContext: unlock.actx, onNeedTap: () => setStatus(c().tap || 'Tap to hear', 'warn') });
    await conn.ready;
    rstate = VR.blank(); bubbles = {}; meBubbles = {};
    phase = 'live'; sub = 'thinking'; muted = false; muteReason = null; reconnects = 0;
    heardSpeech = false; micEnergyHits = 0; rescued = false;
    startedAt = Date.now(); lastActivity = startedAt; turns = 0;
    paint();
    dbg('live', conn.micState ? conn.micState() : null);
    track('voice_mic_state', Object.assign({}, conn.micState ? conn.micState() : {}, { label: undefined }));
    H.open();
    storyShown = false;
    /* a fresh start: the agent greets and waits; the questions the visitor
       might ask hang under its greeting. The story comes only when asked. */
    if (!startedFromText) offerStarters();
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
  if (stage) { const s = stage; stage = null; intro = null; s.destroy(); }
  pendingChips = null;
  if (hearing) { if (!hearing.textContent) hearing.remove(); hearing = null; }
  timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers = [];
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
    const m = await mint(resumeSummary('reconnect'));
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
  /* twice a second: is sound reaching the mic while the server hears nothing? */
  timers.push(setInterval(() => { watchHearing(); if (DEBUG) paintDebug(); }, 500));
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
  const t = ev && ev.type;
  if (t && !/delta$/.test(t)) dbg('←', t + (t === 'error' ? ' ' + JSON.stringify(ev.error || {}).slice(0, 120) : ''));
  if (t === 'input_audio_buffer.speech_started') heardSpeech = true;
  const r = VR.reduce(rstate, ev);
  rstate = r.state;
  r.ops.forEach(apply);
}

/* ── THE ORDER OF THE THREAD ──
   The visitor's transcript arrives AFTER the model has begun to answer (the
   transcription runs behind the response), so a bubble made when the words
   land would sit under the reply ("it should have its response under my
   transcript, not above it", client 2026-09-11). So their bubble is reserved
   the moment they start speaking — a quiet listening mark — takes the turn's
   id when the turn is committed, and fills when the words arrive. A reserved
   bubble that never gets words (noise, a cough) goes away by itself. */
let hearing = null, hearingTimer = 0;
function reserveMe() {
  if (hearing) return;
  hearing = H.me('');
  hearing.classList.add('turnb--interim', 'turnb--hearing');
  if (H.follow) H.follow();
  clearTimeout(hearingTimer);
  hearingTimer = setTimeout(() => { if (hearing && !hearing.textContent) { hearing.remove(); hearing = null; } }, 12000);
  timers.push(hearingTimer);
}
function meBubble(itemId) {
  if (meBubbles[itemId]) return meBubbles[itemId];
  if (hearing) { meBubbles[itemId] = hearing; hearing = null; return meBubbles[itemId]; }
  return (meBubbles[itemId] = H.me(''));
}

function bubbleText(el, text, cls) {
  let t = el.querySelector('.turnb__text');
  if (!t) { t = document.createElement('div'); t.className = 'turnb__text'; el.insertBefore(t, el.firstChild); }
  t.innerHTML = H.rich ? H.rich(text) : esc(text).replace(/\?/g, '<span class="q">?</span>');
  if (cls) el.classList.add(cls);
  if (H.follow) H.follow();              /* the thread keeps up with the words */
}

/* ── answer pills in voice mode ──
   The flow's suggestions for the current question (size bands, roles, the
   goal's options). The agent is about to SAY the question, so the pills wait
   for its next bubble and hang under it; if no bubble comes, they get one of
   their own. Typed steps (website, email, phone) have no suggestions. */
let pendingChips = null;
function offerChips(chips, onChip, opts) {
  const o = opts || {};
  if (!chips || !chips.length) { pendingChips = null; return; }
  if (pendingChips && pendingChips.timer) clearTimeout(pendingChips.timer);
  pendingChips = { chips, onChip, cls: o.cls || null, bubble: null, at: Date.now(), timer: null };
  /* the starters only ever hang under the greeting — no bubble of their own */
  if (o.fallback !== false) {
    pendingChips.timer = setTimeout(() => {
      if (pendingChips && !pendingChips.bubble && phase === 'live') { const p = pendingChips; pendingChips = null; H.ai(null, p.chips, null, p.onChip); }
    }, 6000);
    timers.push(pendingChips.timer);
  }
}
function hangChips(bubble) {
  if (!pendingChips || !bubble) return;
  const p = pendingChips; pendingChips = null;
  if (p.timer) clearTimeout(p.timer);
  H.chips(bubble, p.chips, p.onChip, p.cls);
}
/* "whenever it asks me questions, there should be pills with common answers I
   can either say out loud or click on" (client, 2026-09-11). The flow's own
   options are offered as each step arrives (offerChips); this is the net under
   every OTHER question the agent asks: step 1 asked again (after a barge, a
   start-over, an aside) gets the six goals; a step with options gets them
   again; a typed step (website, email, phone) gets none — the box is the answer. */
function chipsForNow() {
  const st = K.state();
  if (!st) return null;
  if (st.status === 'IDLE') {
    const goals = (((S.data || {}).goals || {}).goals || []).filter(g => g && g.label);
    return goals.length ? goals.slice(0, 6).map(g => ({ label: g.label, value: g.label })) : null;
  }
  if (typedStep()) return null;
  if (st.question && st.suggestions && st.suggestions.length) return st.suggestions.map(s => ({ label: s.label, value: s.value }));
  return null;
}
function pillsUnderQuestion(el, text) {
  if (!el || stage || !/\?/.test(String(text || '')) || el.querySelector('.turnb__chips')) return;
  const chips = chipsForNow();
  if (chips) H.chips(el, chips, chip => sendText(chip.value), 'turnb__chips--answers');
}

function apply(op) {
  switch (op.op) {
    case 'user.speaking':
      lastActivity = Date.now();
      if (stage) closeStage('barge');          /* they have started talking: the show is over */
      if (sub !== 'speaking') setSub('listening');
      reserveMe();                             /* their bubble takes its place NOW, above whatever the agent answers */
      break;
    case 'user.silent':
      break;
    case 'me.committed':
      /* the turn has an id: the reserved bubble is theirs */
      if (!meBubbles[op.itemId] && hearing) { meBubbles[op.itemId] = hearing; hearing = null; }
      break;
    case 'me.interim': {
      const el = meBubble(op.itemId);
      el.classList.add('turnb--interim');
      el.classList.remove('turnb--hearing');
      el.textContent = op.text;
      if (H.follow) H.follow();
      break;
    }
    case 'me.final': {
      const el = meBubble(op.itemId);
      el.classList.remove('turnb--interim', 'turnb--hearing');
      el.textContent = op.text;
      if (!op.text) el.remove();
      else { turns++; lastActivity = Date.now(); H.settleChips(); }
      break;
    }
    case 'ai.start':
      setSub('thinking');
      break;
    case 'ai.delta': {
      let el = bubbles[op.itemId];
      if (!el) { el = bubbles[op.itemId] = H.ai('', null, null, null); if (pendingChips && !pendingChips.bubble) pendingChips.bubble = el; }
      bubbleText(el, op.text);
      if (!rstate.speaking) setSub('speaking');
      maybeOpenStage(op.text);                 /* asked aloud: the pictures rise with the words */
      if (stage && intro) {
        if (!intro.responseId && rstate.response) intro.responseId = rstate.response.id;
        followTranscript(op.text);
      }
      break;
    }
    case 'ai.done': {
      const el = bubbles[op.itemId] || (bubbles[op.itemId] = H.ai('', null, null, null));
      bubbleText(el, op.text);
      if (!op.text) el.remove();
      else if (pendingChips && (pendingChips.bubble === el || !pendingChips.bubble)) hangChips(el);
      else pillsUnderQuestion(el, op.text);
      break;
    }
    case 'ai.cutoff': {
      const el = bubbles[op.itemId];
      if (el && !el.classList.contains('turnb--cutoff')) { el.classList.add('turnb--cutoff'); track('voice_barge_in', {}); }
      break;
    }
    case 'ai.end':
      lastActivity = Date.now();
      /* the opening response is over: whatever the words did, the stage goes */
      if (stage && intro && (!intro.responseId || intro.responseId === op.responseId)) closeStage('end', 900);
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
      /* the visitor asked the agent to start again: the flow and thread are
         cleared, and the session itself is replaced — the fresh one greets */
      const HA = window.SAIHEROAGENT;
      if (HA && HA.restart) HA.restart({ fromVoice: true });
      if (fn) { try { await fn(op.args); } catch (e) { /* the flow is already reset */ } }
      toolBusy--;
      track('voice_tool_call', { name: op.name, status: 'IDLE' });
      restartSession('tool');
      return;                                  /* no result to send — that session is gone */
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
  if (stage) closeStage('typed');
  if (pendingChips) { if (pendingChips.timer) clearTimeout(pendingChips.timer); pendingChips = null; }   /* answered another way */
  H.open();
  H.me(v);
  H.settleChips();
  turns++; lastActivity = Date.now();
  if (rstate.response || rstate.speaking) sendAll(VR.clientEvents.cancel());
  sendAll(VR.clientEvents.userText(v));
  setSub('thinking');
  return true;
}

/* Start over while the voice is open STARTS THE VOICE AGENT OVER (client,
   2026-09-11): the flow and the thread are cleared by hero-agent; the session
   is replaced by a fresh one — a new secret, the greeting, the pills — rather
   than asking the old one to greet again (which left an empty, silent card). */
function restartSession(via) {
  if (!(phase === 'live' || phase === 'reconnecting' || phase === 'minting' || phase === 'connecting')) return false;
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  if (conn && (rstate.response || rstate.speaking)) sendAll(VR.clientEvents.cancel());
  teardown();
  bubbles = {}; meBubbles = {};
  phase = 'idle'; muted = false; muteReason = null; storyShown = false;
  track('voice_session_ended', { seconds, turns, reason: 'restart', via: via || 'button' });
  start();                                     /* inside the same tap, so audio stays unlocked */
  return true;
}
function onRestart() { restartSession('button'); }

/* ── wiring ── */
/* the showcase's pictures warm up while the finger is still on its way */
let warmed = false;
const warm = () => { if (warmed) return; warmed = true; const cfg = showcaseCfg(); [].concat(cfg.burst, cfg.self.img ? [cfg.self.img] : [], cfg.products.map(p => p.img)).forEach(src => { const im = new Image(); im.src = src; }); };
startBtn.addEventListener('pointerenter', warm, { passive: true });
startBtn.addEventListener('focus', warm);
startBtn.addEventListener('touchstart', warm, { passive: true });
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
  start, end, mute, sendText, onRestart, offerChips, explain,
  live: () => phase === 'live' || phase === 'reconnecting',
  phase: () => phase,
  showcase: () => (stage ? stage.state() : null),
  state: () => ({ phase, sub, muted, muteReason, turns, reconnects, model, startedAt })
};
})();
