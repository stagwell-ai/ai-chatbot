/* ═══════════════════════════════════════════════════════════════════════════
   CARDS — recommendation cards from view models, and view models from data
   (brief §20–§23, §44). Pure: no routing in here, and nothing about a product
   that is not in data/solutions.json.

     buildCards(reco, signals, data, copy, opts) → ProductCardViewModel[]
     renderCards(vms, copy, esc)                → HTML string

   ProductCardViewModel:
     { productId, productName, logoUrl, badge:'BEST_FIT'|'ALSO_CONSIDER',
       description, whyThisFits, capabilities:[],
       primaryAction:{ type:'DEMO'|'SELF_SERVICE'|'EXPERT_CALL', label, url|null, cta },
       secondaryAction:{ type:'LEARN_MORE', label, url } }

   A null `url` on the primary action means "open the site's own lead modal"
   (lead.js listens for [data-cta]); the renderer writes the button with
   data-cta so the modal owns the booking, as it does everywhere else.

   "Why this fits" is deterministic: the visitor's need (taxonomy.json `need`
   for the strongest intent this product matched) + the product's approved
   card copy. A model may rephrase it (opts.why[productId], produced server-
   side from the same facts); the template is always the fallback.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.SAICARDS = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const list = v => (Array.isArray(v) ? v : []);
  const solutionsOf = data => { const s = data && data.solutions; return Array.isArray(s) ? s : list(s && s.solutions); };
  const product = (id, data) => solutionsOf(data).find(p => p && p.id === id) || null;
  const intent = (id, data) => list(data && data.taxonomy && data.taxonomy.intents).find(i => i && i.id === id) || null;
  /* "First-party data onboarding" → "first-party data onboarding"; "AI visibility"
     and "ChatGPT, Gemini…" keep their capital (second letter is upper-case) */
  const lowerFirst = s => { const t = String(s || '').trim(); return t.length > 1 && t.charAt(1) === t.charAt(1).toLowerCase() && /[A-Z]/.test(t.charAt(0)) ? t.charAt(0).toLowerCase() + t.slice(1) : t; };
  const joinAnd = arr => arr.length < 2 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  const tpl = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? '' : String(vars[k])));
  const CTA_KIND = { DEMO: 'demo', EXPERT_CALL: 'expert', SELF_SERVICE: null };

  /* the visitor's need this product answers: the explicit intent it matched
     first, else the strongest read one, else the goal's first intent */
  function needFor(entry, signals, data) {
    const matched = (entry && entry.matched) || { primary: [], secondary: [] };
    const sig = list(signals && signals.intents);
    const order = id => { const i = sig.findIndex(x => x && x.id === id); return i === -1 ? 999 : i; };
    const pick = list(matched.primary).concat(list(matched.secondary))
      .map(id => ({ id, explicit: !!(sig.find(x => x && x.id === id) || {}).explicit, i: order(id) }))
      .sort((a, b) => (Number(b.explicit) - Number(a.explicit)) || (a.i - b.i))[0];
    const it = pick ? intent(pick.id, data) : null;
    return it ? it.need : null;
  }

  function actionFor(p, copy) {
    const conv = p.conversion || {};
    const urls = p.urls || {};
    const type = conv.primaryType || 'DEMO';
    const labels = (copy && copy.ctaLabels) || {};
    let url = null;
    if (type === 'SELF_SERVICE') url = urls.selfService || urls.externalWebsite || null;
    else if (type === 'DEMO') url = urls.demo || null;
    return { type, label: conv.primaryLabel || labels[type] || 'Book a demo', url, cta: url ? null : (CTA_KIND[type] || 'demo') };
  }

  function card(entry, signals, data, copy, badge, opts) {
    const p = product(entry.productId, data);
    if (!p) return null;
    const need = needFor(entry, signals, data);
    const desc = p.cardDescription || p.positioning || '';
    const labels = (copy && copy.ctaLabels) || {};
    const override = opts && opts.why && opts.why[p.id];
    /* the approved capability tags as a phrase: "brand tracking, competitive
       benchmarking and campaign impact" — the card's one-liner is not repeated */
    const caps = list(p.capabilityTags || p.valueProps).slice(0, 3).map(lowerFirst);
    const capabilities = caps.length ? joinAnd(caps) : desc.replace(/[.!]\s*$/, '');
    const vars = { product: p.displayName || p.name, need, capability: desc, capabilities };   /* never the routing label */
    let why;
    if (badge === 'BEST_FIT') why = override || tpl(need ? copy.whyFits : copy.whyFitsNoNeed, vars);
    else why = override || tpl(copy.whySecondary, vars);
    const learn = { type: 'LEARN_MORE', label: labels.LEARN_MORE || 'Learn more', url: (p.urls && p.urls.productPage) || '/s/' + encodeURIComponent(p.id) };
    const v = p.visual || {};
    return {
      productId: p.id,
      productName: p.displayName || p.name,      /* never the routing label */
      logoUrl: v.lockup || p.lockup || null,
      /* the product PAGE's own opening, brought into the card: its hero picture
         where Julian set one, the white lockup that sits over it, and otherwise
         the Stagwell ground that page stands on (client, 2026-09-17: "more
         images and animation… use the content from the product pages") */
      heroUrl: v.hero || null,
      wordmarkUrl: v.wordmark || null,
      /* "screen": a lockup drawn on black, so the black falls away on the dark
         ground — next/product.css .pp-logo--screen, the same asset */
      wordmarkBlend: v.wordmarkBlend || null,
      markIconUrl: v.markIcon || null,
      ground: v.ground || 'g1',
      tagline: p.tagline || null,
      audience: p.whoFor || null,
      badge,
      description: desc,
      whyThisFits: why,
      /* the page's "How it works" steps: the Machines' proof points where the
         messaging document gave them, the capability tags everywhere else */
      proof: list(p.proofPoints).slice(0, 3),
      capabilities: list(p.capabilityTags || p.valueProps).slice(0, 3),
      primaryAction: badge === 'BEST_FIT' ? actionFor(p, copy) : null,
      secondaryAction: learn,
      score: entry.score,
      reasons: list(entry.reasons)
    };
  }

  function buildCards(reco, signals, data, copy, opts) {
    const o = opts || {};
    const c = copy || {};
    if (!reco || !reco.primary) return [];
    const byId = id => list(reco.ranked).find(r => r.productId === id) || { productId: id, score: 0, reasons: [], matched: {} };
    const out = [];
    const primary = card(byId(reco.primary), signals, data, c, 'BEST_FIT', o);
    if (primary) out.push(primary);
    if (o.secondary !== false) {
      list(reco.secondary).forEach(id => {
        const vm = card(byId(id), signals, data, c, 'ALSO_CONSIDER', o);
        if (vm) out.push(vm);
      });
    }
    return out;
  }

  /* ── HTML. Text is escaped; URLs come only from the catalog. ─────────── */
  const defaultEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const safeUrl = u => { const s = String(u || ''); return /^(https?:\/\/|\/)/i.test(s) ? s : null; };

  /* one of the five grounds the product pages stand on (next/product.css) */
  const GROUND = { g1: 1, g2: 1, g3: 1, imai: 1, unicepta: 1, own: 1 };
  const ground = g => (GROUND[g] ? g : 'g1');

  /* THE BEST-FIT CARD IS THE PRODUCT'S PAGE, IN ONE BREATH
     A band carrying that page's own hero — its picture where there is one, its
     Stagwell ground where there is not — with the lockup and the tagline over
     it; then why it fits, the page's own "How it works" lines, the capability
     tags and the way on. Nothing here is invented: every string and every URL
     comes out of data/solutions.json.

     Each element carries its own --d, and the whole card waits for [data-cue]
     (hero-agent.js / home.js): the stagger begins when the answer has finished
     writing itself, not when the HTML is set — a card revealing itself under an
     opacity of 0 is not a reveal. */
  function bandHtml(vm, e, c) {
    const shot = safeUrl(vm.heroUrl);
    const mark = safeUrl(vm.wordmarkUrl);
    const icon = safeUrl(vm.markIconUrl);
    const cls = 'reco__band reco__band--' + e(ground(vm.ground)) + (shot ? ' reco__band--shot' : '');
    /* the name, set the way its page sets it: its wordmark, its mark beside its
       name, or its name alone. It is the card's ONE heading — the body used to
       repeat it underneath, which on a gradient card was the same words twice.
       A wordmark still carries the name in text, for a reader who cannot see it. */
    const name = '<h3 class="reco__name reco__name--band">' + (mark
      ? '<img class="reco__wordmark' + (vm.wordmarkBlend === 'screen' ? ' reco__wordmark--screen' : '') + '" src="' + e(mark) + '" alt="" loading="lazy" decoding="async"><span class="vh">' + e(vm.productName) + '</span>'
      : (icon ? '<img class="reco__markicon" src="' + e(icon) + '" alt="" loading="lazy" decoding="async">' : '') +
        '<span>' + e(vm.productName) + '</span>') + '</h3>';
    return '<div class="' + cls + '">' +
      (shot ? '<img class="reco__shot" src="' + e(shot) + '" alt="" loading="lazy" decoding="async">' : '') +
      '<span class="reco__veil" aria-hidden="true"></span>' +
      '<span class="reco__sheen" aria-hidden="true"></span>' +
      '<div class="reco__bandin">' +
        name +
        (vm.tagline ? '<p class="reco__tagline">' + e(vm.tagline) + '</p>' : '') +
      '</div>' +
      '<p class="reco__badge">' + e(c.bestFit || 'Best fit') + '</p>' +
    '</div>';
  }

  function renderCards(vms, copy, esc) {
    const e = esc || defaultEsc;
    const c = copy || {};
    return '<div class="reco">' + list(vms).map((vm, ci) => {
      const best = vm.badge === 'BEST_FIT';
      const logo = safeUrl(vm.logoUrl);
      const learn = vm.secondaryAction && safeUrl(vm.secondaryAction.url);
      let primary = '';
      if (vm.primaryAction) {
        const a = vm.primaryAction, url = safeUrl(a.url);
        const attrs = ' data-kimi-cta="' + e(a.type) + '" data-kimi-product="' + e(vm.productId) + '"';
        primary = url
          ? '<a class="btn btn--ink reco__go" href="' + e(url) + '" target="_blank" rel="noopener"' + attrs + '>' + e(a.label) + '</a>'
          : '<button type="button" class="btn btn--ink reco__go" data-cta="' + e(a.cta || 'demo') + '"' + attrs + '>' + e(a.label) + '</button>';
      }
      const secondary = learn
        ? '<a class="' + (best ? 'btn btn--line reco__learn' : 'reco__learn reco__learn--quiet') + '" href="' + e(learn) + '" target="_blank" rel="noopener" data-kimi-cta="LEARN_MORE" data-kimi-product="' + e(vm.productId) + '">' + e(vm.secondaryAction.label) + '</a>' : '';
      /* the order things arrive in, as a step each */
      let d = 0;
      const at = () => ' style="--d:' + (d++ * 70) + 'ms"';
      const proof = best && vm.proof.length
        ? '<ul class="reco__proof">' + vm.proof.map(x => '<li class="reco__rv"' + at() + '><span class="reco__tick" aria-hidden="true"></span><span>' + e(x) + '</span></li>').join('') + '</ul>' : '';
      if (!best) {
        return '<article class="reco__card reco__card--also" data-cue data-product="' + e(vm.productId) + '" style="--cd:' + (ci * 140) + 'ms">' +
          '<span class="reco__edge reco__edge--' + e(ground(vm.ground)) + '" aria-hidden="true"></span>' +
          '<p class="reco__badge reco__badge--quiet">' + e(c.alsoConsider || 'Also worth considering') + '</p>' +
          '<div class="reco__head">' +
            (logo ? '<img class="reco__logo" src="' + e(logo) + '" alt="" loading="lazy" decoding="async">' : '<span class="reco__mark reco__mark--' + e(ground(vm.ground)) + '" aria-hidden="true"></span>') +
            '<div class="reco__title"><h3 class="reco__name">' + e(vm.productName) + '</h3></div>' +
          '</div>' +
          '<p class="reco__why">' + e(vm.whyThisFits) + '</p>' +
          '<div class="reco__acts">' + secondary + '</div>' +
        '</article>';
      }
      return '<article class="reco__card reco__card--best" data-cue data-product="' + e(vm.productId) + '" style="--cd:' + (ci * 140) + 'ms">' +
        bandHtml(vm, e, c) +
        '<div class="reco__body">' +
          '<p class="reco__desc reco__rv"' + at() + '>' + e(vm.description) + '</p>' +
          (vm.audience ? '<p class="reco__who reco__rv"' + at() + '>' + e(vm.audience) + '</p>' : '') +
          '<p class="reco__whylabel reco__rv"' + at() + '>' + e(c.whyLabel || 'Why this fits you') + '</p>' +
          '<p class="reco__why reco__rv"' + at() + '>' + e(vm.whyThisFits) + '</p>' +
          proof +
          (vm.capabilities.length ? '<ul class="reco__caps reco__rv"' + at() + '>' + vm.capabilities.map(x => '<li>' + e(x) + '</li>').join('') + '</ul>' : '') +
          '<div class="reco__acts reco__rv"' + at() + '>' + primary + secondary + '</div>' +
        '</div>' +
      '</article>';
    }).join('') + '</div>';
  }

  return { buildCards, renderCards, needFor, actionFor };
});
