/* ═══════════════════════════════════════════════════════════════════════════
   VIDEO — the explainer, in a shadow box (client, Sep 2).

   The play button sits between the headline and the sub-line on the landing
   (machine/b.html #heroPlay); this opens #videoBox over the page, starts the
   film (a click is a user gesture, so play() is allowed), and hands control to
   the browser's own controls. Close by the X, the scrim, or Escape — the film
   pauses and rewinds so the next open starts clean, and focus goes back to
   the button that opened it. Copy and the file's path come from
   data/questions.json (hero.video); the markup carries a working fallback.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const box = document.getElementById('videoBox');
const play = document.getElementById('heroPlay');
if (!box || !play) return;

const video = box.querySelector('video');
const closeBtn = document.getElementById('videoClose');
let lastFocus = null;
let open = false;

function openBox() {
  if (open) return;
  open = true;
  lastFocus = document.activeElement;
  box.hidden = false;
  document.body.classList.add('vbox-open');
  try {
    if (video) {
      if (video.preload === 'none') video.preload = 'auto';
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* the controls are there; the visitor presses play */ });
    }
  } catch (e) { /* same */ }
  try { (closeBtn || box).focus({ preventScroll: true }); } catch (e) { /* fine */ }
  try { if (window.SAI && window.SAI.events) window.SAI.events.emit('video_opened', { id: 'explainer' }); } catch (e) { /* fine */ }
}

function closeBox() {
  if (!open) return;
  open = false;
  try { if (video) { video.pause(); video.currentTime = 0; } } catch (e) { /* fine */ }
  box.hidden = true;
  document.body.classList.remove('vbox-open');
  try { if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true }); } catch (e) { /* fine */ }
}

play.addEventListener('click', openBox);
box.addEventListener('click', e => { if (e.target.closest('[data-vbox-close]')) closeBox(); });
document.addEventListener('keydown', e => { if (open && e.key === 'Escape') { e.preventDefault(); closeBox(); } });

/* the label, duration and file come from the data contract when it is there */
function applyCopy() {
  const data = window.STAGDATA;
  if (!data || typeof data.then !== 'function') return;
  data.then(d => {
    const v = d && d.questions && d.questions.hero && d.questions.hero.video;
    if (!v) return;
    const label = document.getElementById('heroPlayLabel');
    const meta = document.getElementById('heroPlayMeta');
    if (label && v.label) label.textContent = v.label;
    if (meta && v.duration) meta.textContent = `${v.duration} · sound on`;
    if (v.title) box.setAttribute('aria-label', v.title);
    if (video && v.src) {
      const src = video.querySelector('source');
      if (src && src.getAttribute('src') !== v.src) { src.setAttribute('src', v.src); video.load(); }
      if (v.poster) video.setAttribute('poster', v.poster);
    }
    const thumb = play.querySelector('.hero2__thumb img');
    if (thumb && v.poster) thumb.setAttribute('src', v.poster);
  }).catch(() => { /* the markup's own fallback stands */ });
}
applyCopy();

window.SAIVIDEO = { open: openBox, close: closeBox, isOpen: () => open };
})();
