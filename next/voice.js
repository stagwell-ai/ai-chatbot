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
const list = v => (Array.isArray(v) ? v : []);
const track = (name, props) => { try { const a = window.SAIANALYTICS; if (a) a.track(name, props || {}); else S.events.emit(name, props || {}); } catch (e) {} };

/* ── REHEARSAL (?voicerehearse=1) ──
   The story's pacing, without a model or a microphone: voice-rehearsal.js
   installs a peer that speaks the greeting and the story at a real speaking
   pace (word by word, breaths between products), so anyone — a test, a
   reviewer, the client — can watch the pictures land against the words. */
const REHEARSE = (() => { try { return /[?&]voicerehearse=1/.test(location.search); } catch (e) { return false; } })();
if (REHEARSE && !window.__SAIVOICE_TRANSPORT) {
  const me = document.currentScript && document.currentScript.src;
  const s = document.createElement('script');
  s.src = me ? me.replace(/voice\.js(\?.*)?$/, 'voice-rehearsal.js') : '/next/voice-rehearsal.js';
  document.head.appendChild(s);
}

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
/* the earliest the story may end when the model has not named everyone: below
   this it is a model wandering into the pivot's words, not a story told */
const STORY_FLOOR_MS = 22000;

/* ── HOW FAST THIS VOICE IS ACTUALLY SPEAKING ──
   The Realtime API streams the transcript as fast as the model WRITES it,
   which is several times faster than the voice SAYS it. So the text cannot be
   the clock. The audio can: output_audio_buffer.started/stopped bracket a
   response's speech, and the transcript says how many words were in it, which
   is a real words-a-second for this voice, on this connection. The greeting is
   spoken before the story, so by the time the story starts this is measured
   rather than guessed. */
/* An unhurried Realtime voice runs about 2.5 words a second once its pauses
   are counted in. It is in the copy so it can be tuned without a deploy, and
   it is only the starting point: a response that is spoken all the way through
   measures the real thing and replaces it. */
const WPS_FALLBACK = 2.5;
/* …and the schedule leans LATE. A picture that lands a beat after its name
   reads as the screen keeping up; one that lands before it reads as broken. */
const LATE_BIAS = 1.02;
let wpsSamples = [];
let speech = { at: 0, text: '' };          /* the response being spoken right now */
const wordsIn = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
function wps() {
  /* pinned in the copy wins outright — the team can set a rate without a
     deploy, and the tests use it to run the story's clock fast */
  const pinned = Number(copy().wordsPerSecond);
  if (pinned > 0) return pinned;
  if (!wpsSamples.length) return WPS_FALLBACK;
  return wpsSamples.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, wpsSamples.length);
}
function noteSpeechEnded() {
  if (!speech.at) return;
  const secs = (Date.now() - speech.at) / 1000;
  const n = wordsIn(speech.text);
  speech = { at: 0, text: '' };
  if (secs < 1.2 || n < 6) return;                     /* too short to measure anything */
  const r = n / secs;
  if (r < 1.2 || r > 6) return;                        /* a cut-off or a stutter, not a pace */
  wpsSamples.push(r);
  dbg('wps', r.toFixed(2) + ' words/s (' + n + ' words in ' + secs.toFixed(1) + 's)');
}

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
let landed = false;      /* the story has put them down and asked its question — once */
/* …and from the moment the story decides to land, the generic answer-pill net
   stands down: the landing hangs its own pills under the team card, and the
   same six goals twice in a row is a stutter, not an offer */
let landing = false;
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
/* is this the question that asks for the story, in some form? */
function isStoryQuestion(text) {
  const t = squash(text);
  if (!t) return false;
  const hero = squash((c().starters || {}).hero || 'What is Stagwell AI?');
  /* "Dagwell", "Stagwall": the transcription of a name it has never heard */
  return t === hero || /^(so|ok|okay|um)?(what|whats|who|tellmeabout|explain)(is|are)?(st|d)agw[ae]ll(ai)?(exactly|actually|about|then)?$/.test(t);
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
    moreLabel: sc.moreLabel || '',
    moreOn: sc.moreOn || 'more than ten',
    /* each member of the team carries its emblem (an icon key the stage
       draws) and its own mark — the catalog's lockup, when it has one
       ("when each of them is named, display the logo, or some kind of SVG
       icon … like introducing a team of superheroes", client 2026-09-11) */
    products: (sc.products || []).map(p => { const P = byId(p.id); return P ? { id: p.id, name: P.name, line: p.line, img: p.img, icon: p.icon || null, lockup: P.lockup || null, url: (P.urls && P.urls.productPage) || '/s/' + encodeURIComponent(p.id) } : null; }).filter(Boolean),
    selfUrl: sc.selfUrl || '/newvoices',
    moreUrl: sc.moreUrl || '/products',
    peekHint: sc.peekHint || 'Hover a member to meet them — tap to read more.',
    moreLine: sc.moreLine || '', moreGo: sc.moreGo || '',
    readLabel: ((c().pointers || {}).read) || 'Read about {product}',
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
  dbg('stage.open', via || 'voice');
  intro = { responseId: null, text: '', cfg, fallback: null, started: Date.now(),
            plan: {}, audioAt: 0, ended: false, beat: 0 };
  /* the conductor's beat: it reads the score against the audio clock. 120 ms is
     a third of a word at speaking pace — closer than anyone can see. */
  intro.beat = setInterval(conduct, 120);
  timers.push(intro.beat);
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
  /* words are flowing: trust them — the clock is only for a model that has
     gone quiet (the rehearsal QA caught the clock landing every card 4–8 s
     before its name was spoken) */
  if (intro.lastDeltaAt && Date.now() - intro.lastDeltaAt < 8000) { intro.fallback = setTimeout(revealByClock, 4000); timers.push(intro.fallback); return; }
  /* …and it never overtakes: a member the words DID land stays lit for its own
     line before the clock moves on to the next one */
  if (intro.lastRevealAt && Date.now() - intro.lastRevealAt < 4000) { intro.fallback = setTimeout(revealByClock, 1500); timers.push(intro.fallback); return; }
  const next = intro.cfg.products.find(p => stage.state().revealed.indexOf(p.id) === -1);
  if (!next) return;
  intro.lastRevealAt = Date.now();
  stage.reveal(next.id);
  dbg('stage.reveal', next.id + ' by the clock @' + (Date.now() - intro.started) + 'ms');
  track('voice_showcase_reveal', { id: next.id, atMs: Date.now() - intro.started, via: 'clock' });
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
const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');   /* "GEO Pulse" = "GEOPulse" = "geopulse" */
/* ── THE SCORE ──
   Where each name falls in the story — not in words, but in the TIME the voice
   will take to reach it. Words are not evenly spaced: a voice rests at a full
   stop, breathes at a dash, dips at a comma. Counting words alone put every
   reveal a few seconds early and the error grew with every product, because
   the pauses it ignored were all in front of it. So each word costs a unit
   plus what its punctuation is worth, and the whole is scaled to the time this
   voice takes for this many words. The transcript arrives early and whole, so
   the score is complete long before the voice needs it. */
const PAUSE_UNITS = { stop: 1.7, comma: 0.45, dash: 0.8 };
function wordUnits(w) {
  if (/[.!?]["')\]]?$/.test(w)) return 1 + PAUSE_UNITS.stop;
  if (/[,;:]$/.test(w)) return 1 + PAUSE_UNITS.comma;
  if (/[—–-]$/.test(w)) return 1 + PAUSE_UNITS.dash;
  return 1;
}
function planFrom(text, cfg) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const marks = list(cfg.products).map(p => ({ key: p.id, s: squash(p.name) }));
  if (cfg.moreOn) marks.push({ key: '__more', s: squash(cfg.moreOn) });
  if (cfg.closeOn) marks.push({ key: '__land', s: squash(cfg.closeOn) });
  const at = {};
  let acc = '', units = 0;
  for (let i = 0; i < words.length; i++) {
    acc += squash(words[i]);
    units += wordUnits(words[i]);
    for (let m = 0; m < marks.length; m++) {
      if (at[marks[m].key] == null && marks[m].s && acc.indexOf(marks[m].s) !== -1) at[marks[m].key] = units;
    }
  }
  return { at, units, words: words.length };
}
/* ── THE CONDUCTOR ──
   "it still is not focusing on the company when it says the name" (client's
   recording, 2026-09-16). It was following the TEXT, and on the wire the whole
   story arrives in a couple of seconds while the voice is still on the first
   product — so the pictures ran the entire story in seven seconds and the
   voice was left behind. Now the text is the score and the AUDIO is the clock:
   elapsed time since the voice started, at this voice's measured pace, gives
   the word it is on, and a name lights up when the voice reaches it. Two gates,
   both required: never before the name has been transcribed (it is real, and
   in order), and never before the voice has said it. */
function conduct() {
  if (!intro || !stage) return;
  const plan = intro.plan;
  if (!plan || !plan.units) return;
  const from = intro.audioAt || intro.started;
  /* how long this voice takes for the whole story, spread over the score's
     units — so the reveals keep the shape of the speech, not of the word count */
  const msPerUnit = (plan.words / wps()) * 1000 * LATE_BIAS / plan.units;
  const elapsed = Date.now() - from;
  const reached = key => plan.at[key] != null && plan.at[key] * msPerUnit <= elapsed;
  let passed = 0;
  list(intro.cfg.products).forEach(p => {
    if (!reached(p.id)) return;
    passed++;
    if (stage.reveal(p.id)) {
      if (intro.fallback) { clearTimeout(intro.fallback); intro.fallback = null; }
      intro.lastRevealAt = Date.now();
      const at = Date.now() - intro.started;
      dbg('stage.reveal', p.id + ' @' + at + 'ms (voice at ' + Math.round(elapsed / 1000) + 's)');
      track('voice_showcase_reveal', { id: p.id, atMs: at, via: 'voice', wps: Math.round(wps() * 100) / 100 });
    }
  });
  const all = passed >= list(intro.cfg.products).length;
  if (all && reached('__more') && stage.revealMore) {
    if (stage.revealMore()) dbg('stage.more', '@' + (Date.now() - intro.started) + 'ms');
  }
  /* the landing: the voice has reached the closing question, and the story was
     really told (or has run long enough that a skipped name is not worth
     waiting for) */
  const longEnough = Date.now() - intro.started > STORY_FLOOR_MS;
  if ((all || longEnough) && reached('__land')) {
    if (stage.assemble) stage.assemble();
    closeStage('pivot', 2400);
  }
}
function followTranscript(text) {
  if (!intro || !stage) return;
  intro.text = text; intro.lastDeltaAt = Date.now();
  /* the score is rewritten as more of it arrives; the conductor reads it on
     its own beat. Nothing is revealed from here — the words are minutes ahead
     of the voice. */
  intro.plan = planFrom(text, intro.cfg);
  stage.caption(text);
}
function closeStage(why, delay) {
  if (!stage) return;
  const s = stage; stage = null;
  if (intro && intro.beat) { clearInterval(intro.beat); intro.beat = 0; }
  if (s.state().revealed.length && (why === 'pivot' || why === 'end' || why === 'timeout')) landing = true;
  const seconds = intro ? Math.round((Date.now() - intro.started) / 1000) : 0;
  dbg('stage.close', why + ' after ' + seconds + 's, ' + s.state().revealed.length + ' revealed');
  /* closed before a single member was named (an interruption, a drop): the
     story was not told — asking again may raise the pictures again */
  if (!s.state().revealed.length && why !== 'pivot' && why !== 'end') storyShown = false;
  const revealed = s.state().revealed.slice();
  const cfg = intro ? intro.cfg : showcaseCfg();
  intro = null;
  const go = () => {
    /* the team stays: not gone, but a card in the conversation — each member a
       door to its page, a hover shows who they are (client, 2026-09-11:
       "instead of having it disappear … have it be part of the chat history").
       It is put in FIRST, while the thread is still hidden behind the stage, so
       that when the stage lifts the card is already there. Docking it after the
       lift left a beat of empty white card between the two — the jump in the
       client's recording (2026-09-16). */
    if (revealed.length && STAGE.teamCard) dockTeam(cfg, revealed);
    if (revealed.length && (why === 'pivot' || why === 'end' || why === 'timeout')) landStory(cfg);
    s.close(why);
  };
  if (delay) timers.push(setTimeout(go, delay)); else go();
  track('voice_showcase_ended', { why, seconds, revealed: revealed.length });
}
function dockTeam(cfg, revealed) {
  if (document.querySelector('#agentThread .turnb--team')) return;      /* once */
  const bubble = H.ai(null, null, null, null);
  bubble.classList.add('turnb--team');
  const card = STAGE.teamCard(cfg, revealed, {
    onOpen: (id, url) => { try { K.clicked('LEARN_MORE', id, url, 'team'); } catch (e) {} track('voice_team_open', { id }); },
    onPeek: id => track('voice_team_peek', { id })
  });
  bubble.appendChild(card);
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-in')));
  if (H.follow) H.follow();
}

/* ── WHERE THE STORY PUTS THEM DOWN ──
   "It should end after it talks about IMAI … it should scroll up and have
   pills about the next step and reintroduce the original question: what do
   you need help with today?" (client, 2026-09-16).

   The stage lifts, the team card stays in the thread, and the conversation is
   handed back with its first question — the six starting points as pills,
   under the agent's own words. Tapping one is step 1, and the very next thing
   the flow asks for is the work email (flags.emailFirst), which is the whole
   point of landing them here rather than leaving them on a picture.

   The page goes to the TOP of the team card, not the foot of the thread: they
   have just been introduced to a team and should see it, then read down to
   the question. */
function landStory(cfg) {
  if (landed) return;
  landed = true;
  const s = K.state ? K.state() : null;
  /* they got on with it during the story — nothing to reintroduce */
  if (s && s.status !== 'IDLE' && s.status !== 'DISCOVERY') return;
  if (s && s.primaryGoal) return;
  const team = document.querySelector('#agentThread .turnb--team');
  /* ── THE ASK COMES FIRST ──
     "once we get to this point we need to pitch to get the customer's email and
     then to ask them what problem they want to solve with pills" (client,
     2026-09-16). The story's last line IS the pitch — the agent has just said
     it aloud — so all this does is stand the conversation on that question: the
     composer goes to email, no pills, because an address is typed. The moment
     it is answered (or answered with a problem instead, which the flow takes
     just as happily) the ordinary order resumes and the six starting points
     arrive as pills under the agent's next question. */
  if (pendingChips) { if (pendingChips.timer) clearTimeout(pendingChips.timer); pendingChips = null; }
  let asked = false;
  if (K.askWorkEmail) { const after = K.askWorkEmail(); asked = !!(after && after.question && after.question.field === 'email'); }
  if (!asked) {
    /* no email step on this build (flags.emailFirst off, or it is already
       known): fall back to the question itself, with its pills */
    const gs = (((window.SAI || {}).data || {}).goals || {}).goals || [];
    const chips = gs.map(g => ({ label: g.label, value: g.label }));
    const onChip = chip => { track('voice_land_tapped', { label: String(chip.label).slice(0, 60) }); sendText(chip.value); };
    if (chips.length) {
      if (team && H.chips) H.chips(team, chips, onChip, 'turnb__chips--answers');
      else offerChips(chips, onChip, { cls: 'turnb__chips--answers' });
    }
  }
  track('voice_showcase_landed', { products: ((cfg && cfg.products) || []).length, ask: asked ? 'email' : 'goal' });
  /* then the page goes UP to the head of the card — "it should scroll up" — so
     the team is read from the top and the ask is under it.
     …and it takes a couple of tries: the agent is often still finishing the
     sentence, and every word of transcript asks the thread to follow it. The
     head lock (home.js) holds each attempt for a beat; the last one, once the
     voice has stopped, is the one that sticks. */
  [800, 1600, 2600].forEach(ms => timers.push(setTimeout(() => {
    if (!team) { if (H.follow) H.follow(); return; }
    if (ms > 800 && sub === 'speaking') return;      /* still talking: let the words scroll */
    if (H.settle) H.settle(team, { head: true });
  }, ms)));
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
  const f = st && st.question && st.question.field;
  return !!(st && (f === 'website' || f === 'email' || st.status === 'CAPTURE_EMAIL' || st.status === 'CAPTURE_PHONE'));
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
    const T = fakeTransport();
    /* a rehearsal (?voicerehearse=1): no secret, no model — the built-in peer
       speaks the greeting and the story at a real speaking pace, so the
       timing of the pictures can be watched and measured */
    const m = (T && T.rehearsal) ? T.mint() : await mint(resumeSummary('join'), { showcase: !startedFromText });
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
    storyShown = false; landed = false; landing = false;
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
  clearFalseBarge();
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

/* ── A FALSE ALARM IS NOT AN INTERRUPTION ──
   The server cuts the agent off the instant its VAD thinks someone spoke, and
   a door, a cough or a noisy room trips it. Left alone the agent simply stops
   mid-sentence and never comes back, which reads as broken. So a cut-off arms
   a short watch: if real words land, the interruption stands; if the transcript
   comes back empty, or nothing arrives at all, the agent is asked to carry on
   from where it stopped. Once per cut-off, never in a loop. */
const FALSE_BARGE_MS = 2200;
let falseBarge = null;
function armFalseBarge(itemId) {
  clearFalseBarge();
  if (phase !== 'live') return;
  const said = (rstate.items[itemId] && rstate.items[itemId].text) || '';
  falseBarge = { itemId, said, resumed: false, timer: setTimeout(() => resumeAfterNoise('silence'), FALSE_BARGE_MS) };
  timers.push(falseBarge.timer);
}
function clearFalseBarge() { if (falseBarge) { clearTimeout(falseBarge.timer); falseBarge = null; } }
/* ── AN ECHO IS NOT A TURN ──
   On a laptop with speakers the microphone hears the AGENT, and the server
   hands those words straight back as the visitor's. Mid-story that read as a
   real interruption and took the pictures away in the middle of a sentence
   ("it suddenly cuts out when it starts talking about IMAI", client,
   2026-09-16 — reproduced in tests/kimi/story.funnel.mjs).

   The tell is that what came back is what the agent has just been saying. Not
   verbatim — transcription garbles it — so this counts how much of it is the
   agent's own recent words: four or more of them, and most of what was heard,
   and it is the room rather than a person. Short utterances are never judged
   this way; "yes", "go on", "IMAI?" are things a visitor really says. */
function isEcho(said, agentText) {
  const heard = String(said || '').toLowerCase().match(/[a-z0-9']{4,}/g) || [];
  if (heard.length < 4) return false;
  const mine = ' ' + String(agentText || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ') + ' ';
  let hit = 0;
  heard.forEach(w => { if (mine.indexOf(' ' + w + ' ') !== -1) hit++; });
  return hit / heard.length >= 0.7;
}
function resumeAfterNoise(why) {
  const fb = falseBarge;
  if (!fb || fb.resumed || phase !== 'live') { clearFalseBarge(); return; }
  /* the model is already saying something new — leave it alone */
  if (rstate.response || rstate.speaking) { clearFalseBarge(); return; }
  fb.resumed = true; clearFalseBarge();
  const tail = String(fb.said || '').slice(-160);
  const line = c().resumed || 'That was background noise, not the visitor. Carry on from exactly where you stopped, in the same sentence. Do not greet them, do not start again and do not repeat what you have already said.';
  dbg('false-barge', why + ' → resuming');
  track('voice_false_barge', { why });
  sendAll([{ type: 'response.create', response: { instructions: line + (tail ? ' You had got as far as: "' + tail + '"' : '') } }]);
  setSub('thinking');
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
  if (landing || landed) return;      /* the landing hangs its own, under the team card */
  if (!el || stage || !/\?/.test(String(text || '')) || el.querySelector('.turnb__chips')) return;
  const chips = chipsForNow();
  if (chips) H.chips(el, chips, chip => sendText(chip.value), 'turnb__chips--answers');
}

function apply(op) {
  switch (op.op) {
    case 'user.speaking':
      lastActivity = Date.now();
      /* NOT the end of the show by itself: speech_started also fires on echo
         and noise. The story stops when the server actually cuts the agent
         off (ai.cutoff) or when real words arrive (me.final) */
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
      if (!op.text) { el.remove(); resumeAfterNoise('empty'); }   /* the mic heard something; it was not words */
      else if (stage && intro && isEcho(op.text, intro.text)) {
        /* the room hearing itself: no turn, no bubble, and the agent picks up
           where it stopped — the story carries on */
        el.remove();
        dbg('echo', op.text.slice(0, 60));
        track('voice_echo_ignored', { words: (op.text.match(/\S+/g) || []).length });
        resumeAfterNoise('echo');
      }
      else {
        turns++; lastActivity = Date.now(); H.settleChips();
        clearFalseBarge();                     /* they really did speak: the interruption stands */
        if (stage) closeStage('barge');
      }
      break;
    }
    case 'ai.start':
      setSub('thinking');
      break;
    case 'ai.delta': {
      let el = bubbles[op.itemId];
      if (!el) { el = bubbles[op.itemId] = H.ai('', null, null, null); if (pendingChips && !pendingChips.bubble) pendingChips.bubble = el; }
      bubbleText(el, op.text);
      speech.text = op.text;                   /* what this response is saying, for the pace */
      if (!rstate.speaking) setSub('speaking');
      maybeOpenStage(op.text);                 /* asked aloud: the pictures rise with the words */
      if (stage && intro) {
        if (!intro.responseId && rstate.response) intro.responseId = rstate.response.id;
        /* THE ANCHOR. output_audio_buffer.started would be the honest one, but
           the reducer only reports the rising edge and a response that follows
           a cancelled one does not get a new edge — so it never arrived and the
           clock started when the PICTURES opened, seconds before the voice.
           The first word of the story is the reliable anchor: the model streams
           the audio and its transcript together, so they begin as one. */
        if (!intro.audioAt) { intro.audioAt = Date.now(); dbg('stage.audio', 'the voice started (first word)'); }
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
      /* NOT the end of the show yet. The server truncates the answer the moment
         it thinks someone spoke, and a cough or a room does that too. We wait
         to see whether real words arrive; if none do, we pick the answer back
         up (client, 2026-09-13: "any background noise will have it just pause
         and then it feels like it's broken"). */
      armFalseBarge(op.itemId);
      break;
    }
    case 'ai.end':
      lastActivity = Date.now();
      /* the STORY's response is over — as TEXT. The voice is still speaking it:
         the model finishes writing most of a minute before it finishes saying,
         and closing here took the stage away mid-sentence (client's recording,
         2026-09-16: "there is a strange jump in the animation"). Mark it, and
         let agent.silent — output_audio_buffer.stopped — end the story. */
      if (stage && intro && intro.responseId && intro.responseId === op.responseId && op.status !== 'cancelled') {
        intro.ended = true;
        /* a response with no audio at all still has to end */
        if (!rstate.speaking && !intro.audioAt) closeStage('end', 900);
      }
      if (!rstate.speaking) setSub(muted ? 'muted' : 'listening');
      break;
    case 'agent.speaking':
      setSub('speaking');
      /* the voice has started: this is the only honest clock for the story */
      speech = { at: Date.now(), text: speech.text || '' };
      if (intro && !intro.audioAt) { intro.audioAt = Date.now(); dbg('stage.audio', 'the voice started'); }
      break;
    case 'agent.silent':
      noteSpeechEnded();
      /* …and when it STOPS, the story really is over — not when the model
         finished writing it, which is most of a minute earlier. Only the
         STORY's own silence counts, and only once the story was actually told:
         the greeting's audio running out behind it used to put the pictures
         away before the first product had been named. */
      if (stage && intro && intro.ended && intro.audioAt && !op.cleared &&
          stage.state().revealed.length >= list(intro.cfg.products).length) {
        if (stage.assemble) stage.assemble();
        closeStage('end', 900);
      }
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
    } else if (op.name === 'submit_answer' && isStoryQuestion((op.args || {}).text)) {
      /* "What is Stagwell AI?" is not what they want to solve: the flow is not
         started on it; the model is pointed back at the story instead */
      out = { status: 'IDLE', step: 'what they want to solve', say: 'That was a question about Stagwell AI, not a problem to solve. Tell the Stagwell AI story now, exactly as your brief describes — slowly — and do not call submit_answer for it.', question: null, shown: 'the story is on screen' };
      if (!stage && !storyShown) openStage('voice');
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
  clearFalseBarge();                           /* they typed: a real turn, not noise */
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
  phase = 'idle'; muted = false; muteReason = null; storyShown = false; landed = false; landing = false;
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
