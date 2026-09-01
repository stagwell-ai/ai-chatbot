/* ═══════════════════════════════════════════════════════════════════════════
   CAMPAIGN.JS — S2 product landing (/p/:campaign), served by machine/campaign.html.

   One template renders all four product campaigns (the-machine, agent-cloud,
   targeting-machine, newvoices) from data/campaigns.json + data/solutions.json.
   'master' is the brand campaign and belongs at "/", not here — it and any
   unknown id fall through to the not-found card.

   Every chip tap or free-text submit is a HANDOFF: this page never starts a
   conversation itself, it just hands the visitor to the master page with the
   conversation pre-armed —
     /?utm_campaign={id}&autostart=1[&q=<label-or-text>]
   engine.js on "/" (built in parallel) is what actually consumes autostart/q.
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

  /* ── product landing ──────────────────────────────────────────────────── */
  function renderCampaign(campaign, solutions) {
    const id = campaign.id;

    document.title = `${campaign.name} — Stagwell.AI`;
    const descMeta = document.getElementById('pageDesc');
    if (descMeta) descMeta.setAttribute('content', campaign.opener || `${campaign.name} — Stagwell.AI`);

    const chips = Array.isArray(campaign.chips) ? campaign.chips.slice() : [];
    const hasCross = chips.some(c => String(c).trim() === CROSS);
    const chipList = hasCross ? chips : chips.concat([CROSS]);

    const solution = resolveSolution(campaign, solutions);
    const siteLinkHtml = (solution && solution.url)
      ? `<a class="sitelink" href="${esc(withUtm(solution.url))}" target="_blank" rel="noopener">Explore ${esc(articled(campaign.name))} site &rarr;</a>`
      : `<span class="sitelink sitelink--disabled" aria-disabled="true">[PRODUCT SITE — pending]</span>`;

    const pendingHtml = campaign.status === 'pending_positioning'
      ? `<p class="pendingNote">[POSITIONING PENDING — chips and route to confirm with the product team]</p>`
      : '';

    root.innerHTML = `
      <section class="camp camp--${esc(id)}" data-campaign="${esc(id)}">
        <div class="camp__in">

          <div class="camp__id">
            <div class="lockup">
              <span class="lockup__name">${esc(campaign.name)}</span>
              <span class="lockup__tag">[LOGO LOCKUP]</span>
            </div>
            <p class="eyebrow camp__kicker"><i class="pulse"></i>One of Stagwell's Machines</p>

            <div class="phbox phbox--visual">[AD KEY VISUAL — mirrors the campaign creative when it lands]</div>
            <div class="phgrid">
              <div class="phbox">[PRODUCT UI]</div>
              <div class="phbox">[PRODUCT UI]</div>
            </div>

            ${siteLinkHtml}
          </div>

          <div class="panel" id="agentPanel">
            <div class="panel__head">
              <span class="panel__avatar">S</span>
              <b>The Stagwell.AI agent <span class="panel__sep">&middot;</span> briefed on ${esc(campaign.name)}</b>
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

      <section class="band">
        <div class="band__in">
          <h2 class="band__h">One of ten AI products. <span class="accent">The agent finds your fit.</span></h2>
          <div class="band__acts">
            <button class="btn btn--gold" type="button" id="bandAsk">Ask the agent</button>
            <button class="btn btn--ghost-void" type="button" data-cta="expert">Talk to an AI expert</button>
          </div>
        </div>
      </section>`;

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
  function boot(data) {
    const campaignsList = (data && data.campaigns && Array.isArray(data.campaigns.campaigns))
      ? data.campaigns.campaigns : [];
    const solutionsList = (data && data.solutions && Array.isArray(data.solutions.solutions))
      ? data.solutions.solutions : [];

    const id = resolveCampaignId();
    const campaign = campaignsList.find(c => c.id === id);

    if (!campaign || PRODUCT_IDS.indexOf(campaign.id) === -1) {
      renderNotFound(id);
    } else {
      renderCampaign(campaign, solutionsList);
    }
  }

  wireChrome();

  if (window.STAGDATA && typeof window.STAGDATA.then === 'function') {
    window.STAGDATA.then(boot).catch(() => renderNotFound(resolveCampaignId()));
  } else {
    /* data-loader.js failed to load entirely — fetch directly rather than blank the page */
    Promise.all([
      fetch('/data/campaigns.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/data/solutions.json').then(r => (r.ok ? r.json() : null)).catch(() => null)
    ]).then(([campaigns, solutions]) => boot({ campaigns, solutions }))
      .catch(() => renderNotFound(resolveCampaignId()));
  }
})();
