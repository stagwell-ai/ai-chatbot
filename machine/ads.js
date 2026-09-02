/* ═══════════════════════════════════════════════════════════════════════════
   ADS.JS — /ads, the campaign switchboard.

   The client's ask: "part of the project is whether or not the user came from
   a specific ad. And there are four different ads. So we need four different
   landing pages. And we need some type of like home page which you click on
   which then shows you how you got there and shows you which ad that you saw
   to get to start the flow that you are on."

   The four landings already exist at /p/{id}. This is the page in front of
   them: a presenter opens it, picks the ad a visitor would have clicked, and
   the run starts on that ad's landing with attribution captured. ribbon.js is
   the other half — it keeps the answer on screen for the rest of the journey.

   Every card is rendered FROM data/campaigns.json. That file is the contract
   (five entries: the master brand ad plus four product ads), so nothing about
   the list — order, names, openers, prefills, status — is written down twice.
   A fifth product ad added to the JSON appears here with no code change.

   THE CREATIVE SLOT. There is no campaign artwork: no agency has made any.
   What the kit does have is each product's own brand assets, and this page
   now leads every card with them — the lockup band from products.json
   (machine/campaign.js's .camplock idiom, the same product-coloured field
   carrying the same real logo) over the product's own key visual. Those are
   the PRODUCTS' visuals standing in for campaign creative that doesn't exist,
   so every one of them is labelled as a stand-in, in the product's own words
   and with the asset's own credit. A visible placeholder survives only where
   a product genuinely has nothing usable — the discipline the rest of the kit
   keeps, kept here.

   Which asset each card leads with is decided from the data, not per product:
     heroKind image | mark  → the hero, the product's own key visual
     anything else          → the first shots[] entry, which is a real
                              published product visual with its own credit
     neither                → the placeholder stays, and says so
   (heroKind "diagram" is deliberately not led with: SATS's architecture
   graphic is captioned detail that needs the room the landing page gives it —
   at card scale its type is unreadable, and unreadable is not a key visual.)

   The one event it emits is 'handoff_click', an existing type, so the console
   shows the demo's own opening move in the vocabulary it already renders.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const root = document.getElementById('adsRoot');
  if (!root) return;

  const MASTER = 'master';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  const arr = v => (Array.isArray(v) ? v : []);
  const has = v => !!(v && String(v).trim());

  /* a colour or gradient straight out of JSON lands in a style attribute, so
     it never gets to be anything but a colour — campaign.js's rule, kept
     verbatim because the same file feeds both pages */
  const SAFE_PAINT = /^[#a-zA-Z0-9 ,.()%°-]+$/;
  const paint = (v, fallback) => {
    const s = String(v == null ? '' : v).trim();
    if (!s || s.length > 120 || !SAFE_PAINT.test(s) || /url|expression|;/i.test(s)) return fallback;
    return s;
  };

  /* "targeting_machine" → "Targeting machine"; only ever a fallback for a
     value routing.json doesn't carry a label for */
  const pretty = s => String(s == null ? '' : s)
    .replace(/[_-]+/g, ' ')
    .replace(/^\s*([a-z])/, (m, c) => c.toUpperCase())
    .trim();

  const domainLabel = id => {
    let d = null;
    try { d = (window.SAI && typeof window.SAI.domain === 'function') ? window.SAI.domain(id) : null; }
    catch (e) { d = null; }
    return (d && (d.label || d.name)) || pretty(id);
  };

  /* routeBias trimmed to its first clause — but bracket-aware, because two of
     the five notes are a whole "[to confirm — …]" placeholder whose own em
     dash must not be mistaken for the end of the clause. Cut at the first ';'
     or em dash sitting at bracket depth zero. */
  function firstClause(text) {
    const s = String(text == null ? '' : text).trim();
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '[') depth++;
      else if (ch === ']') depth = Math.max(0, depth - 1);
      else if (depth === 0 && (ch === ';' || ch === '—')) return s.slice(0, i).trim();
    }
    return s;
  }

  /* ── the creative slot ───────────────────────────────────────────────────
     A plate — the product's own key visual — sitting over its lockup band.
     Four cards, one composition, four brand fields. */

  /* the lockup band: machine/campaign.js's .camplock, narrowed for a card.
     The real logo where products.json ships one, the name set in type where
     it deliberately doesn't (Agent Cloud's mark is its own band colour and
     would vanish; SATS has no wordmark at all). */
  function lockupHtml(product, campaign) {
    const lk = (product && product.lockup) || {};
    const name = (product && product.name) || campaign.name;
    const band = paint(lk.band || (product && product.accent), '#003349');
    /* the BAND's ink, not the accent's — The Machine's band is its logo's own
       black, which takes white, while ink on its orange accent is black */
    const ink = paint(lk.ink || (product && product.accentInk), '#ffffff');

    const sub = (product && has(product.officialName) && product.officialName !== name)
      ? '<span class="adlock__sub">' + esc(product.officialName) + '</span>' : '';

    const inner = has(lk.logo)
      ? '<img class="adlock__logo" src="' + esc(lk.logo) + '" alt="' + esc(lk.logoAlt || name) +
        '" loading="eager" decoding="async">'
      : '<span class="adlock__word">' + esc(name) + '</span>' + sub;

    /* pillInk exists for a gradient band, where one ink is legible at one end
       and not the other */
    const pillInk = has(lk.pillInk) ? paint(lk.pillInk, ink) : null;
    const cat = (product && has(product.category))
      ? '<span class="adlock__cat"' + (pillInk ? ' style="color:' + esc(pillInk) + '"' : '') + '>' +
        esc(product.category) + '</span>'
      : '';

    const bleed = (lk.fit === 'bleed' && has(lk.logo)) ? ' adlock--bleed' : '';
    return '<div class="adlock' + bleed + '" style="background:' + esc(band) + ';color:' + esc(ink) + '">' +
      inner + cat + '</div>';
  }

  /* the provenance line under a stand-in. A real credit (who published the
     asset) always earns its place; a caption only does when it says something
     the sentence above it has not already said — "The Agent Cloud mark." under
     "…Agent Cloud's own brand mark." is noise; the CES 2026 line is not. */
  function creditFor(name, word, caption, credit) {
    if (has(credit)) return String(credit);
    if (!has(caption)) return '';
    const rest = String(caption).toLowerCase()
      .split(String(name).toLowerCase()).join(' ')
      .split(String(word).toLowerCase()).join(' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ').filter(w => w.length > 2);
    return rest.length >= 3 ? String(caption) : '';
  }

  /* which real asset leads the card — decided off heroKind, never off the id */
  function pickVisual(product) {
    if (!product) return null;
    const kind = product.heroKind;
    const name = product.name || '';

    if ((kind === 'image' || kind === 'mark') && has(product.hero)) {
      const word = kind === 'mark' ? 'brand mark' : 'key visual';
      return {
        src: product.hero,
        alt: product.heroAlt || '',
        kind: kind,
        /* photographs get cropped to the plate; a mark is never cropped */
        photo: kind === 'image',
        word: word,
        credit: creditFor(name, word, product.heroCaption, product.heroCredit)
      };
    }

    const shot = arr(product.shots).find(s => s && has(s.src));
    if (shot) {
      const word = 'published product visual';
      return {
        src: shot.src,
        alt: shot.alt || '',
        kind: 'shot',
        photo: true,
        word: word,
        credit: creditFor(name, word, shot.caption, shot.credit)
      };
    }
    return null;
  }

  /* the honesty line. These are the PRODUCTS' visuals, not campaign creative,
     and the page says so on every card that uses one — with the asset's own
     credit line straight out of products.json underneath. */
  function standInHtml(name, vis) {
    /* NewVoices' visual, not NewVoices's visual */
    const poss = esc(name) + (/s$/i.test(String(name)) ? '&rsquo;' : '&rsquo;s');
    return '<figcaption class="adstand">' +
      '<span class="adstand__tag">Stand-in</span>' +
      '<span class="adstand__t">Standing in for the campaign creative with ' +
        poss + ' own ' + esc(vis.word) + '.' +
        (has(vis.credit) ? ' <span class="src">' + esc(vis.credit) + '</span>' : '') +
      '</span></figcaption>';
  }

  function creativeHtml(campaign, product) {
    const name = (product && product.name) || campaign.name;
    const vis = pickVisual(product);
    const lock = product ? lockupHtml(product, campaign) : '';

    if (!vis) {
      /* nothing real to show — the placeholder stays, and names what is
         missing rather than pretending a grey box is artwork */
      return '<figure class="adcreative">' +
        '<div class="adplate adplate--empty">[AD CREATIVE &mdash; no key visual in the kit for ' +
          esc(name) + ']</div>' + lock +
        '</figure>';
    }

    const fit = vis.photo ? ' data-fit="photo"' : '';
    return '<figure class="adcreative">' +
      '<div class="adplate adplate--' + esc(vis.kind) + '">' +
        '<img class="adplate__img" src="' + esc(vis.src) + '" alt="' + esc(vis.alt) +
        '" loading="eager" decoding="async"' + fit + '>' +
      '</div>' +
      lock +
      standInHtml(name, vis) +
      '</figure>';
  }

  /* the brand card's plate: the Stagwell.AI lockup itself, off the symbol
     ads.html already inlines for the nav. It is the one honest "creative" for
     an ad that names no product — and if the symbol ever goes, the band falls
     back to type rather than to an empty frame. */
  function masterCreativeHtml() {
    const hasSymbol = !!document.getElementById('sw-logo');
    const lock = hasSymbol
      ? '<svg class="adlock__sw" viewBox="0 0 185 28" role="img" aria-label="Stagwell"><use href="#sw-logo"/></svg>' +
        '<span class="adlock__ai">AI</span>'
      : '<span class="adlock__word">Stagwell.AI</span>';

    return '<figure class="adcreative adcreative--master">' +
      '<div class="adplate adplate--brand">' +
        '<div class="adlock adlock--brand">' + lock + '</div>' +
        '<span class="adlock__cat">Brand campaign</span>' +
      '</div>' +
      '<figcaption class="adstand">' +
        '<span class="adstand__tag">Stand-in</span>' +
        '<span class="adstand__t">Standing in for the brand creative with the Stagwell.AI lockup itself &mdash; ' +
          'the brand ad names no product, so neither does this.</span>' +
      '</figcaption>' +
      '</figure>';
  }

  /* ── status, as of today's data ─────────────────────────────────────────
     chips_drafted is NOT pending_positioning: those chips are drafted off
     published positioning and are live on the landing. What is still open is
     the ROUTE, and that is all the tag is allowed to say. */
  function statusTagHtml(campaign) {
    if (campaign.status === 'chips_drafted') {
      const why = has(campaign.chipsNote) ? ' title="' + esc(campaign.chipsNote) + '"' : '';
      return '<span class="adtag adtag--route"' + why + '>Route to confirm</span>';
    }
    if (campaign.status === 'pending_positioning') {
      return '<span class="adtag adtag--pending pendtag">Positioning pending</span>';
    }
    return '';
  }

  /* ── the facts row: what this entry hands the engine before question one ──
     presenter detail, so it reads as detail: hairline rows under the pitch,
     never competing with the creative or the opener. */
  function factsHtml(campaign, opts) {
    const prefill = (campaign && campaign.prefill) || {};
    const bits = [];

    if (Array.isArray(prefill.problem_domains) && prefill.problem_domains.length) {
      bits.push(prefill.problem_domains.map(domainLabel).join(' · '));
    }
    if (prefill.product_interest) {
      bits.push('product interest: <code>' + esc(prefill.product_interest) + '</code>');
    }
    const prefillHtml = bits.length
      ? bits.join(' &nbsp;·&nbsp; ')
      : '<span class="none">attribution only — no product bias</span>';

    const rows = [
      ['Pre-fills', prefillHtml],
      ['Route bias', esc(firstClause(campaign.routeBias) || 'none')],
      ['Lands on', '<code>' + esc((opts && opts.href) || '/') + '</code>']
    ];

    return '<dl class="adfacts">' + rows.map(r =>
      '<div class="adfact"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'
    ).join('') + '</dl>';
  }

  function openerHtml(campaign) {
    if (!campaign.opener) return '';
    return '<blockquote class="adcard__opener">&ldquo;' + esc(campaign.opener) + '&rdquo;</blockquote>';
  }

  /* ── a product ad ───────────────────────────────────────────────────────── */
  function productCard(campaign, index, product) {
    const href = '/p/' + campaign.id;
    const p = product || null;
    const name = (p && p.name) || campaign.name;

    /* the product's own paint, set once on the card so the CSS can lean on it */
    const vars = [
      '--ac:' + paint(p && p.accent, '#003349'),
      '--ac-ink:' + paint(p && p.accentInk, '#ffffff'),
      '--tint:' + paint(p && p.tint, '#F5F7F6')
    ].join(';');

    const tagline = (p && has(p.tagline))
      ? '<p class="adcard__line">' + esc(p.tagline) + '</p>' : '';

    return '' +
      '<article class="adcard" data-campaign="' + esc(campaign.id) + '" style="' + esc(vars) + '">' +
        '<div class="adcard__top">' +
          '<span class="adcard__slot">Ad ' + String(index + 1).padStart(2, '0') + '</span>' +
          statusTagHtml(campaign) +
        '</div>' +
        creativeHtml(campaign, p) +
        '<div class="adcard__pitch">' +
          '<h2 class="adcard__name">' + esc(name) + '</h2>' +
          tagline +
        '</div>' +
        openerHtml(campaign) +
        factsHtml(campaign, { href: href }) +
        '<a class="btn btn--gold adcard__go" href="' + esc(href) + '" data-go="' + esc(href) + '">' +
          'Click this ad &rarr;</a>' +
      '</article>';
  }

  /* ── the master brand ad — last, and visibly a different animal ─────────── */
  function masterCard(campaign) {
    return '' +
      '<div class="adhub__split">The brand campaign</div>' +
      '<article class="adcard adcard--master" data-campaign="' + esc(campaign.id) + '">' +
        '<div class="adcard__body">' +
          '<div class="adcard__top">' +
            '<span class="adcard__slot">Master</span>' +
          '</div>' +
          '<div class="adcard__pitch">' +
            '<h2 class="adcard__name">' + esc(campaign.name) + '</h2>' +
          '</div>' +
          '<p class="adcard__note">The brand ad names no product, so it carries no product bias into ' +
            'the session — the routing matrix decides, off the answers alone.</p>' +
          openerHtml(campaign) +
          factsHtml(campaign, { href: '/' }) +
        '</div>' +
        '<div class="adcard__aside">' +
          masterCreativeHtml(campaign) +
          '<a class="btn btn--gold adcard__go" href="/" data-go="/">Open the brand landing &rarr;</a>' +
        '</div>' +
      '</article>';
  }

  function renderEmpty(why) {
    root.innerHTML = '<p class="adhub__empty">[CAMPAIGNS UNAVAILABLE — ' + esc(why) +
      '. This page renders entirely from /data/campaigns.json; with the file missing there is ' +
      'nothing honest to show.]</p>';
  }

  /* ── the one event: the demo's own opening move ─────────────────────────── */
  function wire() {
    root.addEventListener('click', e => {
      const go = e.target.closest('[data-go]');
      if (!go) return;
      const url = go.getAttribute('data-go');
      try {
        if (window.SAI && window.SAI.events && typeof window.SAI.events.emit === 'function') {
          window.SAI.events.emit('handoff_click', {
            solution: 'demo-hub',
            url: url,
            route: 'ad-hub'
          });
        }
      } catch (err) { /* the click still has to work */ }
      /* no preventDefault: emit() is synchronous (memory + localStorage ring),
         so the record is written before the browser leaves the page */
    });
  }

  /* ── plate fitting, measured rather than guessed ────────────────────────
     A photograph roughly the plate's own shape is contained (its own field is
     black, so the sliver of plate either side is invisible); a distinctly
     taller one fills the plate from the top instead, because contained it
     would sit in two fat bars. A mark or a diagram is never cropped.
     An asset that fails to load takes its plate down to the placeholder —
     the page never shows a broken frame. */
  function fitPlates(scope) {
    const imgs = scope.querySelectorAll('img[data-fit="photo"]');
    const apply = img => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      if (img.naturalWidth / img.naturalHeight < 1.5) img.classList.add('is-fill');
    };
    imgs.forEach(img => {
      if (img.complete) apply(img);
      else img.addEventListener('load', () => apply(img), { once: true });
    });

    scope.querySelectorAll('.adplate__img, .adlock__logo').forEach(img => {
      img.addEventListener('error', () => {
        const plate = img.closest('.adplate');
        const fig = img.closest('.adcreative');
        if (plate && plate.contains(img)) {
          plate.className = 'adplate adplate--empty';
          plate.textContent = '[AD CREATIVE — asset unavailable]';
          const stand = fig && fig.querySelector('.adstand');
          if (stand) stand.remove();
        } else {
          /* a lockup logo that will not load falls back to the name in type */
          const band = img.closest('.adlock');
          const word = document.createElement('span');
          word.className = 'adlock__word';
          word.textContent = img.getAttribute('alt') || '';
          if (band) { band.classList.remove('adlock--bleed'); band.replaceChild(word, img); }
        }
      }, { once: true });
    });
  }

  /* ── chrome shared with campaign.html: the mobile drawer ─────────────────── */
  function wireChrome() {
    const navMenu = document.getElementById('navMenu');
    const navScrim = document.getElementById('navScrim');
    const mnavClose = document.getElementById('mnavClose');
    const closeNav = () => document.body.classList.remove('nav-open');
    if (navMenu) navMenu.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    if (navScrim) navScrim.addEventListener('click', closeNav);
    if (mnavClose) mnavClose.addEventListener('click', closeNav);
  }

  function render(list, products) {
    if (!Array.isArray(list) || !list.length) { renderEmpty('no entries loaded'); return; }

    const byId = {};
    arr(products).forEach(p => { if (p && p.id) byId[p.id] = p; });

    const items = list.filter(c => c && c.id && c.id !== MASTER);
    const master = list.find(c => c && c.id === MASTER) || null;

    if (!items.length) { renderEmpty('no product campaigns declared'); return; }

    root.innerHTML =
      '<div class="adgrid">' +
        items.map((c, i) => productCard(c, i, byId[c.id])).join('') +
      '</div>' +
      (master ? masterCard(master) : '') +
      '<p class="adfoot">This is a working prototype of Stagwell.AI. The brands, marks and key visuals on this page ' +
      'belong to their owners and stand in for campaign creative that does not exist yet; nothing here has run as an ad.</p>';

    fitPlates(root);
    wire();
  }

  wireChrome();

  /* data-loader.js's fixed file list predates products.json, so this page
     fetches it alongside — the same one extra request campaign.js makes, and
     the same degradation: no products.json means cards without brand assets,
     not a blank page. */
  const grabProducts = () => fetch('/data/products.json')
    .then(r => (r.ok ? r.json() : null))
    .then(j => (j && Array.isArray(j.products) ? j.products : []))
    .catch(() => []);

  const boot = products => {
    let list = [];
    try { list = ((window.SAI.data || {}).campaigns || {}).campaigns || []; }
    catch (e) { list = []; }
    render(list, products);
  };

  if (window.SAI && window.SAI.ready && typeof window.SAI.ready.then === 'function') {
    Promise.all([window.SAI.ready, grabProducts()])
      .then(([, products]) => boot(products))
      .catch(() => renderEmpty('engine failed to start'));
  } else {
    /* engine.js absent — the page is still worth showing, so read the contract
       directly rather than blanking */
    Promise.all([
      fetch('/data/campaigns.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
      grabProducts()
    ])
      .then(([j, products]) => render((j && j.campaigns) || [], products))
      .catch(() => renderEmpty('fetch failed'));
  }
})();
