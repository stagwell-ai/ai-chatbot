/* ═══════════════════════════════════════════════════════════════════════════
   ABOUT — "What is Stagwell.AI", on the landing under the chooser.

   The one thing the demo did not say out loud (client, Sep 2, after a
   conversation with Amy: "we didn't really explain what is Stagwell AI
   enough"). Everything here renders from data/messaging.json — the client's
   own messaging framework — into #about (machine/b.html). The section is
   part of the landing: machine/snapshot.js and machine/path.js hide it with
   the hero the moment a snapshot or a path is on screen.

   Deliberately below the chooser, not above it: the client's other ask is
   that a visitor comes into the conversation quickly. The chooser stays the
   first thing on the page; this is what they read while deciding, and where
   the page earns the click for anyone who scrolled past.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const root = document.getElementById('about');
if (!root) return;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* the tagline with its accent word coloured, or plain if the accent is not in it */
function taglineHTML(m) {
  const t = String(m.tagline || '');
  const a = String(m.taglineAccent || '');
  if (!a || t.indexOf(a) !== 0) return esc(t);
  return `<span class="accent">${esc(a)}</span>${esc(t.slice(a.length))}`;
}

/* Two versions of the same data. The landing carries the SHORT one — the
   headline, one paragraph, the three tiers, the four numbers — because the
   full framework read as a wall of text next to the chooser (designer, Sep 2).
   The full version — promises, reasons to believe, audience lines — lives on
   /why (machine/why.html), where it has the room. */
const FULL = root.dataset.mode === 'full';

function render(m) {
  const tiers = Array.isArray(m.tiers) ? m.tiers : [];
  const promises = FULL && Array.isArray(m.promises) ? m.promises : [];
  const proofs = Array.isArray(m.proofPoints) ? m.proofPoints : [];
  const reasons = FULL && Array.isArray(m.reasons) ? m.reasons : [];
  const aud = FULL && m.audience ? m.audience : null;
  const cta = m.cta || {};

  root.innerHTML = `
    <div class="about__in">
      <div class="about__mark" aria-hidden="true">
        <span class="markfx">
          <span class="markfx__face">
            <svg viewBox="0 0 28.44 28"><use href="#sw-mark"/></svg>
          </span>
        </span>
      </div>
      <header class="about__head">
        <p class="eyebrow"><i class="pulse"></i>${esc(m.eyebrow || 'What is Stagwell.AI')}</p>
        <h2 class="about__title display">${taglineHTML(m)}</h2>
        <p class="about__lede">${esc(m.whoWeAre || m.positioning || '')}</p>
        ${(m.cta && m.cta.label) ? `<p class="about__act">
          <button type="button" class="btn btn--gold" data-scrollto="#hero2">${esc(m.cta.label)}</button>
        </p>` : ''}
      </header>

      ${promises.length ? `<ul class="about__promises" aria-label="Customer promises">
        ${promises.map(p => `<li><b>${esc(p.title)}</b><span>${esc(p.line)}</span></li>`).join('')}
      </ul>` : ''}

      ${tiers.length ? `<div class="about__portfolio">
        <h3 class="about__h3">${esc(m.portfolioTitle || '')}</h3>
        <p class="about__line">${esc(m.portfolioLine || '')}</p>
        <div class="about__tiers">
          ${tiers.map(t => `<article class="tier tier--${esc(t.color || 'cyan')}">
            <p class="tier__cat">${esc(t.sub || '')}</p>
            <h4 class="tier__name">${esc(t.name)}</h4>
            <p class="tier__head">${esc(t.headline || '')}</p>
            <p class="tier__line">${esc(t.line || '')}</p>
            <dl class="tier__facts">
              <div><dt>Best for</dt><dd>${esc(t.bestFor || '')}</dd></div>
              <div><dt>Core value</dt><dd>${esc(t.coreValue || '')}</dd></div>
            </dl>
          </article>`).join('')}
        </div>
      </div>` : ''}

      ${reasons.length ? `<div class="about__why">
        <h3 class="about__h3">Why Stagwell.AI</h3>
        <ul class="about__reasons">
          ${reasons.map(r => `<li><b>${esc(r.title)}</b><span>${esc(r.line)}</span></li>`).join('')}
        </ul>
      </div>` : ''}

      ${proofs.length ? `<div class="about__proof">
        <div class="proof__say">
          <h3 class="proof__h">${esc(m.portfolioTitle ? 'Built on Stagwell\u2019s own scale' : '')}</h3>
          <p class="about__proofnote">${esc(m.proofNote || '')}</p>
          <div class="about__cta">
            <button type="button" class="btn btn--gold" id="aboutAsk">${esc(cta.label || 'Ask the agent')}</button>
            <span>${esc(cta.line || '')}</span>
            ${FULL ? '' : `<a class="about__more" href="/next/why">Read why Stagwell.AI →</a>`}
          </div>
        </div>
        <dl class="about__stats">
          ${proofs.map((p, i) => `<div class="stat${i === 0 ? ' stat--wide' : ''}${
            /[0-9]/.test(String(p.value)) ? '' : ' stat--words'}">
            <dt>${esc(p.value)}</dt><dd>${esc(p.label)}</dd></div>`).join('')}
        </dl>
      </div>` : ''}

      ${aud ? `<div class="about__aud">
        <h3 class="about__h3">Built for every marketing model</h3>
        <div class="about__audgrid">
          <article class="aud"><p class="tier__cat" style="--tier:var(--orange)">Enterprise</p><p>${esc(aud.enterprise || '')}</p></article>
          <article class="aud"><p class="tier__cat" style="--tier:var(--cyan)">Mid-market</p><p>${esc(aud.midMarket || '')}</p></article>
          <article class="aud"><p class="tier__cat" style="--tier:var(--amber)">Small business</p><p>${esc(aud.smallBusiness || '')}</p></article>
        </div>
      </div>` : ''}

    </div>`;

  const ask = document.getElementById('aboutAsk');
  if (ask) ask.addEventListener('click', () => {
    /* back to the chooser at the top — it is the front door, and the first
       row is where the answer starts */
    const pick = document.getElementById('heroPick') || document.getElementById('hero2');
    if (!pick) { location.href = '/next'; return; }   /* on /why the chooser is a page away */
    pick.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const row = document.querySelector('#heroPick .pick__row');
    if (row) { try { row.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  });
}

function boot() {
  const data = window.STAGDATA;
  if (!data || typeof data.then !== 'function') return;
  data.then(d => { if (d && d.messaging) render(d.messaging); else root.hidden = true; })
      .catch(() => { root.hidden = true; });
}
boot();
})();

/* scrollto-wire: the section CTA takes you back to the chooser */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-scrollto]');
  if (!b) return;
  const t = document.querySelector(b.dataset.scrollto);
  if (!t) return;
  e.preventDefault();
  window.scrollTo({
    top: t.getBoundingClientRect().top + window.scrollY - 60,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
  setTimeout(() => document.getElementById('pickSite')?.focus({ preventScroll: true }), 600);
});
