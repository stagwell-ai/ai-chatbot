/* ═══════════════════════════════════════════════════════════════════════════
   VOICE WAVE — the sound bubble: one strip of wavy lines that says who is
   talking. Ink for the visitor (their microphone level), the mark's teal for
   the agent (the remote audio level), the hero's dot motion while the agent
   thinks, a flat breathing line while it listens, dashed while reconnecting.

   create(canvas, getLevels, getState) → { start, stop, pause, resume }
     getLevels() → { user: 0..1, agent: 0..1 }
     getState()  → 'listening' | 'speaking' | 'thinking' | 'muted' | 'reconnecting' | 'connecting' | 'ended'

   Reduced motion: no waves — the state as a flat coloured line. Phones: 30 fps.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.SAIVOICEWAVE = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const INK = '#0B1220', TEAL = '#009CBD', FAINT = 'rgba(11,18,32,.22)', DIM = 'rgba(11,18,32,.12)';

  function create(canvas, getLevels, getState) {
    if (!canvas || !canvas.getContext) return { start() {}, stop() {}, pause() {}, resume() {} };
    const ctx = canvas.getContext('2d');
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const frameMs = coarse ? 1000 / 30 : 0;
    let raf = 0, running = false, paused = false, last = 0, t = 0;
    let user = 0, agent = 0;          /* smoothed levels */
    let w = 0, h = 0, dpr = 1;

    function size() {
      dpr = Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1);
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    let ro = null;
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(size); ro.observe(canvas); }

    /* a wave: amplitude from the level, three sines so it never reads as a tone */
    function wave(color, amp, phase, width) {
      ctx.beginPath();
      const mid = h / 2;
      for (let x = 0; x <= w; x += 2) {
        const k = x / w;
        const env = Math.sin(Math.PI * k);                       /* quiet at the ends */
        const y = mid + env * amp * (Math.sin(k * 9 + phase) * 0.6 + Math.sin(k * 17 - phase * 1.3) * 0.3 + Math.sin(k * 29 + phase * 0.7) * 0.1);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.lineCap = 'round'; ctx.stroke();
    }
    function flat(color, dashed) {
      ctx.beginPath(); ctx.setLineDash(dashed ? [6, 6] : []); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }
    function dots(color) {
      const n = 3, gap = 12, cx = w / 2, cy = h / 2;
      for (let i = 0; i < n; i++) {
        const lift = Math.sin(t * 3 + i * 0.9) * 3;
        ctx.beginPath(); ctx.arc(cx + (i - 1) * gap, cy - lift, 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      }
    }

    function draw(now) {
      if (!running) return;
      raf = requestAnimationFrame(draw);
      if (paused) return;
      if (frameMs && now - last < frameMs) return;
      last = now; t += 0.045;
      if (!w || !h) size();
      ctx.clearRect(0, 0, w, h);
      const L = (getLevels && getLevels()) || {};
      const uTarget = Math.max(0, Math.min(1, Number(L.user) || 0)), aTarget = Math.max(0, Math.min(1, Number(L.agent) || 0));
      user += (uTarget - user) * (uTarget > user ? 0.5 : 0.12);
      agent += (aTarget - agent) * (aTarget > agent ? 0.5 : 0.12);
      const state = (getState && getState()) || 'listening';
      const maxAmp = h * 0.42;

      if (reduced) {
        flat(state === 'speaking' ? TEAL : state === 'muted' || state === 'ended' ? DIM : state === 'reconnecting' ? FAINT : INK, state === 'reconnecting');
        return;
      }
      switch (state) {
        case 'connecting':
        case 'thinking':
          dots(state === 'thinking' ? TEAL : FAINT);
          break;
        case 'reconnecting':
          flat(FAINT, true);
          break;
        case 'muted':
        case 'ended':
          flat(DIM);
          break;
        case 'speaking':
          /* the visitor's own wave stays under the agent's, so talking over it shows */
          if (user > 0.03) wave(FAINT, maxAmp * user, t * 1.4, 1.5);
          wave(TEAL, Math.max(maxAmp * 0.08, maxAmp * agent), t, 2.2);
          break;
        default: {
          /* listening: the visitor's wave when they speak, a breath otherwise */
          const breath = (Math.sin(t * 0.8) + 1) / 2 * 0.06;
          wave(user > 0.03 ? INK : FAINT, Math.max(maxAmp * breath, maxAmp * user), t * 1.4, 2);
        }
      }
    }

    return {
      start() { if (running) return; running = true; paused = false; size(); raf = requestAnimationFrame(draw); },
      stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; if (ro) ro.disconnect(); ctx.clearRect(0, 0, w, h); },
      pause() { paused = true; },
      resume() { paused = false; },
      _levels: () => ({ user, agent })
    };
  }

  return { create };
});
