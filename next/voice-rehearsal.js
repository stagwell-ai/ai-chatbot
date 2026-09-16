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
  /* WPS is the rate OVERALL — words a second including every pause — which is
     the only definition that means anything to something trying to keep up
     with the voice, and the one voice.js uses. The breath/stop/comma/dash
     numbers are the SHAPE: how the time is distributed, in word-units. The
     whole is scaled so the response really does run at WPS. (They used to be
     milliseconds piled on top of a per-word rate, so &wps=2.7 actually spoke
     at 2.06, and anything calibrated against it was wrong by a third.) */
  const WPS = num('wps', 2.5);
  const BREATH = num('breath', 2.4), STOP = num('stop', 1.7), COMMA = num('comma', 0.45), DASH = num('dash', 0.8);
  /* ── THE TRANSCRIPT IS NOT THE VOICE ──
     The first version of this harness streamed the transcript at speaking pace,
     and every test passed while the real thing was badly broken: the Realtime
     API sends the transcript as fast as the model WRITES it — the whole story
     in a couple of seconds — and plays the audio at speaking pace underneath.
     Following the text ran the pictures through the entire story in seven
     seconds (client's recording, 2026-09-16). So the default here is now the
     REAL shape: text in a burst, audio on the clock. &textwps= sets the
     transcript's pace (default 18 words/s); &textwps=2.7 puts it back in step
     with the voice, which is the other thing that has to keep working. */
  /* ── WHEN THE "AUDIO STOPPED" EVENT REALLY ARRIVES ──
     output_audio_buffer.stopped is the SERVER's buffer draining, not the
     visitor's ears: the model generates audio far faster than it is heard, so
     on the real wire that event lands while the last several seconds are still
     playing out of the client's buffer. &audiostop=send models that (the
     default); &audiostop=play keeps it at the end of playback, which is what
     this harness used to do and is the shape that hid the bug. */
  const AUDIO_STOP = (q.get('audiostop') || 'send').toLowerCase();
  const TEXT_WPS = num('textwps', 18);
  const TEXT_WORD = Math.max(1, Math.round(1000 / TEXT_WPS));

  const copy = () => ((((window.SAI || {}).data || {}).kimi || {}).copy || {}).voice || {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  let onEvent = null, speaking = false, cancelled = false, n = 0, pendingUser = null, pendingTool = null;
  const emit = ev => { if (onEvent) onEvent(ev); };
  const log = [];

  /* one response, the way the wire really carries it: the transcript in a
     burst, `response.done` with it — and the AUDIO still playing underneath,
     ending at output_audio_buffer.stopped a speaking-pace later. */
  async function say(segments) {
    n++;
    const item = 'reh_a' + n, resp = 'reh_r' + n;
    cancelled = false; speaking = true;
    emit({ type: 'response.created', response: { id: resp } });
    emit({ type: 'response.output_item.added', item: { id: item, type: 'message', role: 'assistant' } });
    emit({ type: 'output_audio_buffer.started' });
    const t0 = Date.now();
    /* how long the VOICE will take — breaths and full stops included — and
       WHEN it says each word. That schedule is the thing anything watching the
       pacing has to measure against, so it is published: window.__voiced is
       [absoluteMs, word] for every word of every response. */
    let total = 0, units = 0;
    const beat = [];
    try { if (!window.__voiced) window.__voiced = []; } catch (e) {}
    segments.forEach(seg => {
      if (seg.breath) units += BREATH;
      String(seg.text).split(/\s+/).filter(Boolean).forEach(w => {
        total++;
        beat.push({ at: units, w });
        units += 1 + (/[.!?]["')\]]?$/.test(w) ? STOP : /[,;:]$/.test(w) ? COMMA : /[—–-]$/.test(w) ? DASH : 0);
      });
    });
    /* …and the shape is stretched to the real rate */
    const msPerUnit = units ? (total / WPS) * 1000 / units : 0;
    const audioMs = Math.round(units * msPerUnit);
    beat.forEach(b => { try { window.__voiced.push([t0 + Math.round(b.at * msPerUnit), b.w]); } catch (e) {} });
    /* the text, in a burst */
    let said = '';
    for (const seg of segments) {
      if (cancelled) break;
      const words = String(seg.text).split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (cancelled) break;
        const delta = (said ? ' ' : '') + w;
        said += delta;
        emit({ type: 'response.output_audio_transcript.delta', item_id: item, delta });
        await sleep(TEXT_WORD);
      }
    }
    const textMs = Date.now() - t0;
    emit({ type: 'response.output_audio_transcript.done', item_id: item, transcript: said });
    emit({ type: 'response.done', response: { id: resp, status: cancelled ? 'cancelled' : 'completed' } });
    /* …and the voice carries on, until it doesn't. A barge-in — or the visitor
       tapping a pill, which sends response.cancel — stops it mid-word, and the
       buffer is cleared, exactly as the real one is. */
    const left = Math.max(0, audioMs - textMs);
    /* the server's buffer drains about when it has finished generating */
    if (AUDIO_STOP === 'send' && !cancelled) { speaking = false; emit({ type: 'output_audio_buffer.stopped' }); }
    const until = Date.now() + left;
    while (!cancelled && Date.now() < until) await sleep(Math.min(60, until - Date.now()));
    log.push({ resp, words: total, textMs, audioMs, ms: Date.now() - t0, cancelled });
    speaking = false;
    if (AUDIO_STOP !== 'send' || cancelled) emit({ type: cancelled ? 'output_audio_buffer.cleared' : 'output_audio_buffer.stopped' });
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
    pace: { wps: WPS, textWps: TEXT_WPS, breath: BREATH, stop: STOP },
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
