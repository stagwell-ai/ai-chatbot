/* ═══════════════════════════════════════════════════════════════════════════
   VOICE REHEARSAL — the story's pacing, without a model or a microphone.

   Loaded by voice.js only when the page is opened with ?voicerehearse=1. It
   installs the transport seam (window.__SAIVOICE_TRANSPORT) with a peer that
   speaks the way the Realtime model does on the wire — response.created,
   the transcript word by word, output_audio_buffer.started/stopped,
   response.done — at a real speaking pace: about 2.7 words a second, a
   breath at a full stop, a longer one before each member of the team is
   named. No secret is minted; nothing leaves the browser.

   What it lets you do: tap "Chat with me", hear nothing, and WATCH the
   greeting and the pills arrive, tap "What is Stagwell AI?", and see the
   pictures land against the words as they would — the same code path the
   real session takes, with the model's half played by a metronome. The
   tests drive it headless and read the timeline back (voice_showcase_reveal).

   Tunables, on the URL: &wps=2.7 (words a second) &breath=900 (ms before a
   product line) &stop=420 (ms after a full stop).
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  const q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(); } })();
  const num = (k, d) => { const v = Number(q.get(k)); return v > 0 ? v : d; };
  const WPS = num('wps', 2.7), BREATH = num('breath', 900), STOP = num('stop', 420), COMMA = num('comma', 140), DASH = num('dash', 240);
  const WORD = Math.round(1000 / WPS);

  const copy = () => ((((window.SAI || {}).data || {}).kimi || {}).copy || {}).voice || {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  let onEvent = null, speaking = false, cancelled = false, n = 0, pendingUser = null, pendingTool = null;
  const emit = ev => { if (onEvent) onEvent(ev); };
  const log = [];

  /* one response, spoken: the transcript word by word at pace, with breaths */
  async function say(segments) {
    n++;
    const item = 'reh_a' + n, resp = 'reh_r' + n;
    cancelled = false; speaking = true;
    emit({ type: 'response.created', response: { id: resp } });
    emit({ type: 'response.output_item.added', item: { id: item, type: 'message', role: 'assistant' } });
    emit({ type: 'output_audio_buffer.started' });
    let said = '';
    const t0 = Date.now();
    for (const seg of segments) {
      if (cancelled) break;
      if (seg.breath) await sleep(seg.breath);
      const words = String(seg.text).split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (cancelled) break;
        const delta = (said ? ' ' : '') + w;
        said += delta;
        emit({ type: 'response.output_audio_transcript.delta', item_id: item, delta });
        let pause = WORD;
        if (/[.!?]$/.test(w)) pause += STOP; else if (/,$/.test(w)) pause += COMMA; else if (/^—$|—$/.test(w)) pause += DASH;
        await sleep(pause);
      }
    }
    log.push({ resp, words: said.split(/\s+/).length, ms: Date.now() - t0, cancelled });
    emit({ type: 'response.output_audio_transcript.done', item_id: item, transcript: said });
    emit({ type: 'output_audio_buffer.stopped' });
    speaking = false;
    emit({ type: 'response.done', response: { id: resp, status: cancelled ? 'cancelled' : 'completed' } });
  }

  const greeting = () => { const V = copy(); return [{ text: (V.introduction || '') + ' ' + (V.invite || '') }]; };
  const story = () => {
    const V = copy(), S = V.showcase || {};
    const segs = [];
    if (S.interrupt) segs.push({ text: S.interrupt });
    if (S.flagship) segs.push({ text: S.flagship, breath: BREATH * 0.6 });
    (S.products || []).forEach(p => segs.push({ text: p.line, breath: BREATH }));
    if (S.more) segs.push({ text: S.more, breath: BREATH * 0.8 });
    if (S.pivot) segs.push({ text: S.pivot, breath: BREATH * 0.8 });
    return segs;
  };
  const isStory = t => { const s = squash(t); return s === squash((copy().starters || {}).hero || 'What is Stagwell AI?') || /what(is|s)?(st|d)agw[ae]ll/.test(s); };

  /* what the browser sends, answered the way the model would */
  function handle(ev) {
    const t = ev && ev.type;
    if (t === 'response.cancel') { cancelled = true; return; }
    if (t === 'conversation.item.create') {
      const it = ev.item || {};
      if (it.type === 'message' && it.role === 'user') pendingUser = ((it.content || [])[0] || {}).text || '';
      if (it.type === 'function_call_output') { try { pendingTool = JSON.parse(it.output || '{}'); } catch (e) { pendingTool = {}; } }
      return;
    }
    if (t === 'response.create') {
      const instr = ev.response && ev.response.instructions;
      if (pendingTool) { const out = pendingTool; pendingTool = null; say([{ text: out.say || 'Noted.' }]); return; }
      if (pendingUser != null) {
        const u = pendingUser; pendingUser = null;
        if (isStory(u)) { say(story()); return; }
        say([{ text: 'In a rehearsal I only tell the story — tap "What is Stagwell AI?" to watch the pacing. You said: ' + u }]);
        return;
      }
      if (instr) { say([{ text: 'Rehearsal: ' + String(instr).slice(0, 60) }]); return; }
      say(greeting());
    }
  }

  window.__SAIVOICE_TRANSPORT = {
    rehearsal: true,
    /* what the mint would have said, minus the secret */
    mint: () => ({ ok: true, value: 'rehearsal', model: 'rehearsal', voice: 'none', caps: { sessionSeconds: 900, softSeconds: 600, silenceMuteSeconds: 900 }, accepted: { model: 'rehearsal' } }),
    log: () => log.slice(),
    pace: { wps: WPS, wordMs: WORD, breath: BREATH, stop: STOP },
    async connect(o) {
      onEvent = o.onEvent;
      setTimeout(() => emit({ type: 'session.created', session: { id: 'rehearsal' } }), 0);
      return {
        ready: Promise.resolve(),
        send: handle,
        close() { onEvent = null; cancelled = true; },
        setMuted() {}, setSpeakerMuted() {},
        resumeAudio: () => Promise.resolve(),
        needsTap: () => false,
        micState: () => ({ rehearsal: true }),
        pcState: () => ({ rehearsal: true }),
        levels: () => ({ user: 0, agent: speaking ? 0.3 + Math.random() * 0.35 : 0 })
      };
    }
  };
})();
