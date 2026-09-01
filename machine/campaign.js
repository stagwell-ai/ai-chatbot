/* ═══════════════════════════════════════════════════════════════════════════
   CAMPAIGN.JS — S2 product landing (/p/:campaign), served by machine/campaign.html.

   One template renders all four product campaigns (the-machine, agent-cloud,
   targeting-machine, newvoices) from three data files, each owning one thing:

     data/campaigns.json  the agent panel — opener, chips, pending_positioning
     data/products.json   the product itself — copy, colours, assets, proof,
                          quotes, sources. Every product word on this page
                          comes from there; none is written in this file.
     data/solutions.json  the fallback product-site URL when products.json
                          has none.

   'master' is the brand campaign and belongs at "/", not here — it and any
   unknown id fall through to the not-found card.

   Every chip tap or free-text submit is a HANDOFF: this page never starts a
   conversation itself, it just hands the visitor to the master page with the
   conversation pre-armed —
     /?utm_campaign={id}&autostart=1[&q=<label-or-text>]
   engine.js on "/" is what actually consumes autostart/q.

   HONESTY — the rule this page exists to keep. These are real third-party
   brands, real published claims and real named people:
     · every proof figure carries its source line, rendered under the strip;
     · every quote carries its source line, and a quote with no named speaker
       gets no borrowed face and says so;
     · nothing here is presented as a Stagwell.AI measurement;
     · a [PLACEHOLDER] survives only where the kit genuinely supplies nothing.
   The prototype footnote at the foot of the page stays on every product.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const root = document.getElementById('campaignRoot');
  if (!root) return;

  const CROSS = 'What else fits my problem?';
  const PRODUCT_IDS = ['the-machine', 'agent-cloud', 'targeting-machine', 'newvoices'];

  /* ── helpers ──────────────────────────────────────────────────────────── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  /* a colour or gradient straight out of JSON lands in a style attribute, so
     it never gets to be anything but a colour: no quotes, no parens beyond a
     gradient's own, no semicolons, no url(). */
  const SAFE_PAINT = /^[#a-zA-Z0-9 ,.()%°-]+$/;
  const paint = (v, fallback) => {
    const s = String(v == null ? '' : v).trim();
    if (!s || s.length > 120 || !SAFE_PAINT.test(s) || /url|expression|;/i.test(s)) return fallback;
    return s;
  };

  const arr = v => (Array.isArray(v) ? v : []);
  const has = v => !!(v && String(v).trim());

  function resolveCampaignId() {
    let m;
    try { m = /^\/p\/([a-z0-9-]+)/.exec(window.location.pathname || ''); }
    catch (e) { m = null; }
    if (m) return m[1];

    try {
      const params = new URLSearchParams(window.location.search || '');
      const utm = params.get('utm_campaign');
      if (utm) return utm;
    } catch (e) { /* fine — falls through */ }

    /* dev fallback: hitting machine/campaign.html directly with no params */
    return 'targeting-machine';
  }

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /* resolve the campaign's matching solutions.json entry by name — the two
     JSON files aren't keyed alike (campaign ids use hyphens, solution ids use
     underscores), and only an exact, case-insensitive name match counts: a
     loose substring match would wrongly pair "The Machine" with "The
     Knowledge Machine (Pulse)". */
  function resolveSolution(campaign, solutions) {
    if (!Array.isArray(solutions)) return null;
    const target = norm(campaign.name);
    return solutions.find(s => norm(s.name) === target) || null;
  }

  function withUtm(url) {
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    return `${url}${sep}utm_source=stagwell-ai&utm_medium=campaign-landing`;
  }

  /* "The Targeting Machine" -> "the Targeting Machine"; "Agent Cloud" -> "the Agent Cloud" */
  function articled(name) {
    return /^the\s/i.test(name) ? name.replace(/^the\s/i, 'the ') : `the ${name}`;
  }

  function handoff(id, textOrLabel) {
    let url = `/?utm_campaign=${encodeURIComponent(id)}&autostart=1`;
    const q = String(textOrLabel == null ? '' : textOrLabel).trim();
    if (q) url += `&q=${encodeURIComponent(q)}`;
    window.location.href = url;
  }

  /* ── chip markup ──────────────────────────────────────────────────────── */
  function chipHtml(label) {
    const trimmed = String(label == null ? '' : label).trim();
    if (trimmed.charAt(0) === '[') {
      /* kit placeholder discipline: a bracketed chip set is visibly, natively disabled */
      return `<button type="button" class="chip chip--placeholder" disabled aria-disabled="true">${esc(trimmed)}</button>`;
    }
    const cls = trimmed === CROSS ? 'chip chip--cross' : 'chip';
    return `<button type="button" class="${cls}" data-label="${esc(trimmed)}">${esc(trimmed)}</button>`;
  }

  /* ── not-found state ──────────────────────────────────────────────────── */
  function renderNotFound(id) {
    document.title = 'Campaign not found — Stagwell.AI';
    root.innerHTML = `
      <section class="campNF">
        <p class="eyebrow"><i class="pulse"></i>Stagwell.AI</p>
        <h1 class="display">Campaign not found</h1>
        <p class="campNF__sub">We don't have a product landing for &ldquo;${esc(id)}&rdquo;. Head back to the main site and tell the agent what you're trying to solve instead.</p>
        <a class="btn btn--dark" href="/">Go to Stagwell.AI &rarr;</a>
      </section>`;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION BUILDERS — each returns '' when the product has nothing for it,
     so a thinner kit produces a shorter page rather than an empty frame.
     ═══════════════════════════════════════════════════════════════════════ */

  /* the lockup band: mirrors machine/path.css's .pathband idiom — a solid
     product-coloured field carrying either the real logo or, where there is
     no wordmark to use, the name set in type. */
  function lockupHtml(product, campaign) {
    const lk = product.lockup || {};
    const band = paint(lk.band || product.accent, '#003349');
    /* the band's ink, NOT the accent's: a lockup band is often a different
       surface from the accent fill (The Machine's band is its logo's own
       black, which takes white; ink on its orange accent is black) */
    const ink = paint(lk.ink || product.accentInk, '#ffffff');
    const name = product.name || campaign.name;
    const sub = has(product.officialName) && product.officialName !== name
      ? `<span class="camplock__sub">${esc(product.officialName)}</span>` : '';

    const inner = has(lk.logo)
      ? `<img class="camplock__logo" src="${esc(lk.logo)}" alt="${esc(lk.logoAlt || name)}" loading="eager" decoding="async">`
      : `<span class="camplock__word">${esc(name)}</span>${sub}`;

    /* the category rides the band as a pill — machine/path.css's value-pill
       idiom, and it stops a wide band being a metre of empty product colour.
       pillInk exists for a gradient band, where one ink can be legible at one
       end and not the other. */
    const pillInk = has(lk.pillInk) ? paint(lk.pillInk, ink) : null;
    const cat = has(product.category)
      ? `<span class="camplock__cat"${pillInk ? ` style="color:${esc(pillInk)}"` : ''}>${esc(product.category)}</span>`
      : '';

    const bleed = (lk.fit === 'bleed' && has(lk.logo)) ? ' camplock--bleed' : '';
    return `<div class="camplock${bleed}" style="background:${esc(band)};color:${esc(ink)}">${inner}${cat}</div>`;
  }

  function heroVisualHtml(product) {
    const kind = product.heroKind;
    if (kind === 'none' || !has(product.hero)) return '';

    const cap = has(product.heroCaption) || has(product.heroCredit)
      ? `<figcaption class="camphero__cap">${esc(product.heroCaption || '')}${
          has(product.heroCredit) ? ` <span class="src">${esc(product.heroCredit)}</span>` : ''}</figcaption>`
      : '';

    return `<figure class="camphero__art camphero__art--${esc(kind || 'image')}">
        <img src="${esc(product.hero)}" alt="${esc(product.heroAlt || '')}" loading="eager" decoding="async">
        ${cap}
      </figure>`;
  }

  function valueHtml(product) {
    const props = arr(product.valueProps);
    if (!props.length) return '';

    const cards = props.map((p, i) => {
      const icon = has(p.icon)
        ? `<span class="campvalue__icon"><img src="${esc(p.icon)}" alt="" loading="lazy" decoding="async"></span>`
        : `<span class="campvalue__num">${String(i + 1).padStart(2, '0')}</span>`;
      return `<li class="campvalue${has(p.icon) ? '' : ' campvalue--num'}">
          ${icon}
          <h3 class="campvalue__t">${esc(p.title)}</h3>
          <p class="campvalue__l">${esc(p.line)}</p>
        </li>`;
    }).join('');

    const powered = product.poweredBy && has(product.poweredBy.line)
      ? `<p class="camppowered">${
          has(product.poweredBy.icon)
            ? `<img src="${esc(product.poweredBy.icon)}" alt="" loading="lazy" decoding="async">` : ''
        }${esc(product.poweredBy.line)}</p>`
      : '';

    return `<section class="campsec campsec--value" aria-labelledby="valueH">
        <h2 class="campsec__h" id="valueH">What it does for you</h2>
        <ul class="campvalues">${cards}</ul>
        ${powered}
      </section>`;
  }

  /* the proof strip: big numeral + label on the product's deep band. The
     source line under it is not optional — these are the companies' own
     published figures and the page says so. */
  function proofHtml(product) {
    const figs = arr(product.proof).filter(p => has(p.figure));
    if (!figs.length) return '';

    const band = paint(product.band || product.accent, '#003349');
    const ink = paint(product.bandInk, '#ffffff');
    const fig = paint(product.bandFigure || product.bandInk, ink);

    const items = figs.map(p => `
      <li class="campproof">
        <b class="campproof__fig" style="color:${esc(fig)}">${esc(p.figure)}</b>
        <span class="campproof__lab">${esc(p.label)}</span>
      </li>`).join('');

    const src = has(product.proofSource)
      ? `<p class="campsrc campsrc--onband">Source: ${esc(product.proofSource)}</p>` : '';

    return `<section class="campstrip" style="background:${esc(band)};color:${esc(ink)}" aria-label="Published figures">
        <div class="campstrip__in">
          <ul class="campproofs">${items}</ul>
          ${src}
        </div>
      </section>`;
  }

  function shotsHtml(product) {
    const shots = arr(product.shots).filter(s => has(s.src));
    const note = has(product.shotsNote)
      ? `<p class="campph">${esc(product.shotsNote)}</p>` : '';
    if (!shots.length && !note) return '';

    const items = shots.map(s => `
      <figure class="campshot campshot--${esc(s.frame === 'light' ? 'light' : 'dark')}">
        <div class="campshot__plate"><img src="${esc(s.src)}" alt="${esc(s.alt || '')}" loading="lazy" decoding="async"></div>
        <figcaption class="campshot__cap">${esc(s.caption || '')}${
          has(s.credit) ? ` <span class="src">${esc(s.credit)}</span>` : ''}</figcaption>
      </figure>`).join('');

    return `<section class="campsec campsec--shots" aria-labelledby="shotsH">
        <h2 class="campsec__h" id="shotsH">Inside the product</h2>
        ${shots.length ? `<div class="campshots${shots.length === 1 ? ' campshots--one' : ''}">${items}</div>` : ''}
        ${note}
      </section>`;
  }

  function quoteCardHtml(q) {
    if (!q || !has(q.text)) return '';

    let who;
    if (has(q.name)) {
      const face = has(q.photo)
        ? `<img class="campquote__face" src="${esc(q.photo)}" alt="${esc(q.name)}" loading="lazy" decoding="async">`
        : (has(q.photoNote)
          ? `<span class="campquote__facegap">${esc(q.photoNote)}</span>`
          : '');
      who = `${face}<span class="campquote__who"><b>${esc(q.name)}</b><i>${esc(q.title || '')}</i></span>`;
    } else {
      /* no named speaker on the source page — so no borrowed face, and the
         page says why rather than quietly implying one */
      who = `<span class="campquote__who campquote__who--none">${
        esc(q.unattributedNote || '[SPEAKER — not named on the source page]')}</span>`;
    }

    return `<figure class="campquote">
        <blockquote class="campquote__t">&ldquo;${esc(q.text)}&rdquo;</blockquote>
        <figcaption class="campquote__by">${who}</figcaption>
        ${has(q.source) ? `<p class="campsrc">Source: ${esc(q.source)}</p>` : ''}
      </figure>`;
  }

  function quotesHtml(product) {
    const cards = [quoteCardHtml(product.quote), quoteCardHtml(product.quoteSecondary)]
      .filter(Boolean).join('');
    if (!cards) return '';
    const note = has(product.quoteNote)
      ? `<p class="campnote">${esc(product.quoteNote)}</p>` : '';
    return `<section class="campsec campsec--quotes" aria-label="What customers say">
        <div class="campquotes${cards.indexOf('</figure>') !== cards.lastIndexOf('</figure>') ? ' campquotes--two' : ''}">${cards}</div>
        ${note}
      </section>`;
  }

  function trustHtml(product) {
    const partners = arr(product.partners).filter(p => has(p.src));
    const badges = arr(product.badges).filter(b => has(b.src));
    if (!partners.length && !badges.length) return '';

    const row = (items, cls) => items.map(i =>
      `<li class="${cls}"><img src="${esc(i.src)}" alt="${esc(i.name || '')}" loading="lazy" decoding="async"><span class="vh">${esc(i.name || '')}</span></li>`
    ).join('');

    return `<section class="camptrust" aria-label="Partners and compliance">
        <div class="camptrust__in">
          ${partners.length ? `<div class="camptrust__grp">
            <p class="camptrust__lab">${esc(product.partnersLabel || 'Technology partners')}</p>
            <ul class="camptrust__row">${row(partners, 'camptrust__logo')}</ul>
          </div>` : ''}
          ${badges.length ? `<div class="camptrust__grp camptrust__grp--badges">
            <p class="camptrust__lab">${esc(product.badgesLabel || 'Compliance')}</p>
            <ul class="camptrust__row">${row(badges, 'camptrust__badge')}</ul>
          </div>` : ''}
        </div>
        ${has(product.trustSource) ? `<p class="campsrc campsrc--center">${esc(product.trustSource)}</p>` : ''}
      </section>`;
  }

  function builtByHtml(product) {
    const b = product.builtBy;
    if (!b || !has(b.line)) return '';
    /* a logo we don't have — or, here, one the kit mislabelled — is named as
       missing rather than substituted: a wrong mark under a real company's
       credit is exactly the failure this page exists not to make */
    const logo = has(b.logo)
      ? `<img class="campbuilt__logo" src="${esc(b.logo)}" alt="${esc(b.logoAlt || b.name || '')}" loading="lazy" decoding="async">`
      : (has(b.logoNote) ? `<span class="campbuilt__gap">${esc(b.logoNote)}</span>` : '');
    return `<div class="campbuilt campbuilt--${esc(b.logoOn === 'dark' ? 'dark' : 'light')}">
        ${logo}<p class="campbuilt__l">${esc(b.line)}</p>
      </div>`;
  }

  /* ── product landing ──────────────────────────────────────────────────── */
  function renderCampaign(campaign, solutions, product) {
    const id = campaign.id;
    const p = product || {};

    document.title = `${p.name || campaign.name} — ${p.tagline || 'Stagwell.AI'}`;
    const descMeta = document.getElementById('pageDesc');
    if (descMeta) descMeta.setAttribute('content', p.summary || campaign.opener || `${campaign.name} — Stagwell.AI`);

    const chips = arr(campaign.chips).slice();
    const hasCross = chips.some(c => String(c).trim() === CROSS);
    const chipList = hasCross ? chips : chips.concat([CROSS]);

    /* products.json owns the official product URL; solutions.json is the
       fallback for anything it doesn't carry. Attribution is unchanged. */
    const solution = resolveSolution(campaign, solutions);
    const siteUrl = has(p.siteUrl) ? p.siteUrl : (solution && solution.url) || '';
    const siteLabel = has(p.siteLabel) ? p.siteLabel : `Explore ${articled(campaign.name)} site`;
    const siteLinkHtml = has(siteUrl)
      ? `<a class="sitelink" href="${esc(withUtm(siteUrl))}" target="_blank" rel="noopener">${esc(siteLabel)} &rarr;</a>`
      : `<span class="sitelink sitelink--disabled" aria-disabled="true">[PRODUCT SITE — pending]</span>`;

    const pendingHtml = campaign.status === 'pending_positioning'
      ? `<p class="pendingNote">[POSITIONING PENDING — chips and route to confirm with the product team]</p>`
      : '';

    /* per-product paint, set once on the section so the CSS can lean on it */
    const vars = [
      `--accent:${paint(p.accent, '#003349')}`,
      `--accent-ink:${paint(p.accentInk, '#ffffff')}`,
      `--band:${paint(p.band || p.accent, '#003349')}`,
      `--band-ink:${paint(p.bandInk, '#ffffff')}`,
      `--band-fig:${paint(p.bandFigure || p.bandInk, '#ffffff')}`,
      `--tint:${paint(p.tint, '#F5F7F6')}`
    ].join(';');

    const parentLine = has(p.parent) ? p.parent : "One of Stagwell's Machines";

    root.innerHTML = `
      <section class="camp camp--${esc(id)}" data-campaign="${esc(id)}" style="${esc(vars)}">
        <div class="camp__in">

          <div class="camp__id">
            ${lockupHtml(p, campaign)}
            <p class="eyebrow camp__kicker"><i class="pulse"></i>${esc(parentLine)}</p>

            <h1 class="camp__h1">${esc(p.tagline || campaign.name)}</h1>
            ${has(p.kicker) ? `<p class="camp__kick">${esc(p.kicker)}</p>` : ''}
            ${has(p.summary) ? `<p class="camp__sum">${esc(p.summary)}</p>` : ''}

            ${heroVisualHtml(p)}

            ${siteLinkHtml}
          </div>

          <div class="panel" id="agentPanel">
            <div class="panel__head">
              <span class="panel__avatar">S</span>
              <b>Stagwell.AI</b>
            </div>
            <div class="bubble">${esc(campaign.opener)}</div>
            <div class="chipstack" role="group" aria-label="Suggested next steps">
              ${chipList.map(chipHtml).join('')}
            </div>
            ${pendingHtml}
            <form class="askform" id="askForm" autocomplete="off">
              <input class="askform__input" id="askInput" type="text" placeholder="Describe your problem — or paste your website…" aria-label="Describe your problem">
              <button class="btn btn--gold askform__send" type="submit">Ask the agent</button>
            </form>
          </div>

        </div>
      </section>

      <div class="campbody camp--${esc(id)}" style="${esc(vars)}">
        <div class="campbody__in">
          ${valueHtml(p)}
        </div>
        ${proofHtml(p)}
        <div class="campbody__in">
          ${shotsHtml(p)}
          ${quotesHtml(p)}
          ${builtByHtml(p)}
        </div>
        ${trustHtml(p)}
      </div>

      <section class="band">
        <div class="band__in">
          <h2 class="band__h">One of ten AI products. <span class="accent">The agent finds your fit.</span></h2>
          <div class="band__acts">
            <button class="btn btn--gold" type="button" id="bandAsk">Ask the agent</button>
            <button class="btn btn--ghost-void" type="button" data-cta="expert">Talk to an AI expert</button>
          </div>
        </div>
      </section>

      <p class="campfoot">This is a working prototype of Stagwell.AI, not a live product page. ${
        esc(p.name || campaign.name)} is a third-party product: its name, marks, copy, figures and quoted people belong to their owners and are reproduced here from published material, each line sourced above.</p>`;

    wireCampaignEvents(id);
  }

  function wireCampaignEvents(id) {
    const panel = document.getElementById('agentPanel');
    if (panel) {
      panel.addEventListener('click', e => {
        const btn = e.target.closest('.chip');
        if (!btn || btn.disabled) return;
        handoff(id, btn.dataset.label || btn.textContent);
      });
    }

    const form = document.getElementById('askForm');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const input = document.getElementById('askInput');
        const text = input ? input.value.trim() : '';
        if (!text) { input && input.focus(); return; }
        handoff(id, text);
      });
    }

    const bandAsk = document.getElementById('bandAsk');
    if (bandAsk) {
      bandAsk.addEventListener('click', () => {
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = document.getElementById('askInput');
        if (input) input.focus();
      });
    }
  }

  /* ── chrome shared with the rest of the site: mobile drawer + the "Talk to
     an AI expert" CTA, which points at the master page's own #cta section
     rather than a modal (b.js's modal machinery isn't loaded here) ── */
  function wireChrome() {
    const navMenu = document.getElementById('navMenu');
    const navScrim = document.getElementById('navScrim');
    const mnavClose = document.getElementById('mnavClose');
    const closeNav = () => document.body.classList.remove('nav-open');
    if (navMenu) navMenu.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    if (navScrim) navScrim.addEventListener('click', closeNav);
    if (mnavClose) mnavClose.addEventListener('click', closeNav);

    document.addEventListener('click', e => {
      const b = e.target.closest('[data-cta="expert"]');
      if (b) window.location.href = '/#cta';
    });
  }

  /* ── boot ─────────────────────────────────────────────────────────────── */
  function boot(data, products) {
    const campaignsList = (data && data.campaigns && Array.isArray(data.campaigns.campaigns))
      ? data.campaigns.campaigns : [];
    const solutionsList = (data && data.solutions && Array.isArray(data.solutions.solutions))
      ? data.solutions.solutions : [];
    const productList = (products && Array.isArray(products.products)) ? products.products : [];

    const id = resolveCampaignId();
    const campaign = campaignsList.find(c => c.id === id);

    if (!campaign || PRODUCT_IDS.indexOf(campaign.id) === -1) {
      renderNotFound(id);
      return;
    }
    /* a missing products.json entry degrades to the agent panel + opener
       rather than blanking the page: the conversation is still this page's job */
    renderCampaign(campaign, solutionsList, productList.find(p => p.id === campaign.id) || null);
  }

  wireChrome();

  /* data-loader.js's fixed file list predates products.json, so this page
     fetches it alongside — one extra request, no change to the shared spine. */
  const grabProducts = () => fetch('/data/products.json')
    .then(r => (r.ok ? r.json() : null)).catch(() => null);

  if (window.STAGDATA && typeof window.STAGDATA.then === 'function') {
    Promise.all([window.STAGDATA, grabProducts()])
      .then(([data, products]) => boot(data, products))
      .catch(() => renderNotFound(resolveCampaignId()));
  } else {
    /* data-loader.js failed to load entirely — fetch directly rather than blank the page */
    Promise.all([
      fetch('/data/campaigns.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/data/solutions.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
      grabProducts()
    ]).then(([campaigns, solutions, products]) => boot({ campaigns, solutions }, products))
      .catch(() => renderNotFound(resolveCampaignId()));
  }
})();
