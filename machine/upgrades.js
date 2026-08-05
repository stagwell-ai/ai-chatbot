/* ═══════════════════════════════════════════════════════════════════════════
   UPGRADES — the showcase page's own script.
   Deliberately self-contained: this page demonstrates rather than describes,
   so it makes the same live calls the product does, without loading the
   product's state machine.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]));

/* ── reveals ─────────────────────────────────────────────── */
if ('IntersectionObserver' in window && !REDUCED) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.rv').forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
    io.observe(el);
  });
} else {
  $$('.rv').forEach(el => el.classList.add('is-in'));
}

/* ── brand marks: the same live favicons the product uses ── */
const MARKS = [
  ['Nike','nike.com'], ['Adidas','adidas.com'], ['Apple','apple.com'],
  ['Airbnb','airbnb.com'], ['Spotify','spotify.com'], ['Netflix','netflix.com'],
  ['WPP','wpp.com'], ['Stagwell','stagwellglobal.com'], ['Delta','delta.com'],
  ['Booking.com','booking.com'],
];
const marksEl = $('#marks');
if (marksEl) {
  marksEl.innerHTML = MARKS.map(([name, domain]) =>
    `<span class="bmk" data-letter="${esc(name[0])}" title="${esc(name)}">
      <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64"
           alt="" loading="lazy" referrerpolicy="no-referrer"></span>`).join('');
  $$('img', marksEl).forEach(img => {
    img.addEventListener('error', () => img.remove());
    /* the service answers unknown domains with a 16px globe — treat it as a miss */
    img.addEventListener('load', () =>
      img.naturalWidth <= 16 ? img.remove() : img.classList.add('is-on'));
  });
}

/* ── the live model call ─────────────────────────────────── */
const form = $('#askForm'), input = $('#askInput'), go = $('#askGo'), out = $('#askOut');

/* Brands worth highlighting per example prompt — the demo passes the visitor's
   own set; here we pass a plausible one so the chips mean something. */
const BRAND_HINTS = [
  [/shoe|running|sneaker|trainer/i, ['Nike','Adidas','Brooks','ASICS','Hoka']],
  [/agency|marketing|advertis|brand/i, ['Stagwell','WPP','Publicis','Omnicom','Accenture']],
  [/crm|software|saas|tool|platform/i, ['HubSpot','Salesforce','Pipedrive','Zoho']],
  [/stay|hotel|travel|lisbon|city|trip/i, ['Airbnb','Booking.com','Marriott','Expedia']],
];
const brandsFor = q => (BRAND_HINTS.find(([re]) => re.test(q)) || [null, []])[1];

let busy = false;
async function ask(prompt) {
  if (busy || !prompt.trim()) return;
  busy = true; go.disabled = true;
  const brands = brandsFor(prompt);

  out.classList.add('is-on');
  out.innerHTML = `<p class="ask__meta"><span class="dots"><i></i><i></i><i></i></span>
    &nbsp; asking a model — verbatim, no prompt engineering</p>`;

  const started = Date.now();
  let d = null;
  try {
    const r = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim(), brands }),
    });
    d = r.ok ? await r.json() : null;
  } catch { d = null; }

  /* Never leave the reader looking at a spinner. */
  if (!d || !d.ok || !d.answer) {
    out.innerHTML = `<p class="ask__err">The model did not answer that time — which is exactly
      why the demo falls back to its scripted figures rather than showing an error.
      ${d && d.error ? `<br><span class="ask__meta">reason: ${esc(d.error)}</span>` : ''}</p>`;
    busy = false; go.disabled = false;
    return;
  }

  const named = Array.isArray(d.named) ? d.named : [];
  out.innerHTML = `
    <p class="ask__a">${esc(d.answer)}</p>
    ${brands.length ? `<div class="ask__marks">${brands.map(b => {
      const on = named.some(n => n.toLowerCase() === b.toLowerCase());
      return `<span class="ask__m${on ? ' is-on' : ''}">${esc(b)}<i>${on ? 'named' : 'not named'}</i></span>`;
    }).join('')}</div>` : ''}
    <p class="ask__meta">${esc(d.model || 'model')} ·
      answered in ${d.ms || (Date.now() - started)}ms ·
      ${named.length} of ${brands.length || '—'} brands named</p>`;

  busy = false; go.disabled = false;
}

if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    ask(input.value || input.placeholder);
  });
  $$('.ask__eg button').forEach(b => b.addEventListener('click', () => {
    input.value = b.dataset.eg;
    ask(b.dataset.eg);
  }));
}

/* ── crawl replay ────────────────────────────────────────── */
const CRAWL = [
  ['/', 44], ['/men/shoes', 132], ['/collections/new-arrivals', 88],
  ['/about', 179], ['/stores', 61], ['/newsroom', 40, 301],
  ['/sustainability', 143], ['/sitemap.xml', 200],
];
const feed = $('#cFeed'), cN = $('#cN'), cE = $('#cE'), replay = $('#cReplay');

let playing = false;
async function playCrawl() {
  if (playing || !feed) return;
  playing = true;
  feed.innerHTML = ''; cN.textContent = '0'; cE.textContent = '0';
  for (let i = 0; i < CRAWL.length; i++) {
    const [path, ms, code = 200] = CRAWL[i];
    const row = document.createElement('div');
    row.className = 'crawlrow';
    row.innerHTML = `<span class="crawlrow__m">GET</span>
      <span class="crawlrow__p">${path}</span>
      <span class="crawlrow__t">${ms}ms</span>
      <span class="crawlrow__c${code === 200 ? '' : ' r'}">${code}</span>`;
    feed.appendChild(row);
    const f = (i + 1) / CRAWL.length;
    cN.textContent = Math.round(47 * f);
    cE.textContent = Math.round(312 * f);
    await wait(REDUCED ? 0 : 110);
  }
  playing = false;
}
if (replay) replay.addEventListener('click', playCrawl);

/* Plays itself once, when it first comes into view. */
if (feed && 'IntersectionObserver' in window) {
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { cio.disconnect(); playCrawl(); }
  }), { threshold: 0.4 });
  cio.observe($('#crawlDemo'));
} else {
  playCrawl();
}

})();
