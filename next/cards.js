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
    const vars = { product: p.name, need, capability: desc, capabilities };
    let why;
    if (badge === 'BEST_FIT') why = override || tpl(need ? copy.whyFits : copy.whyFitsNoNeed, vars);
    else why = override || tpl(copy.whySecondary, vars);
    const learn = { type: 'LEARN_MORE', label: labels.LEARN_MORE || 'Learn more', url: (p.urls && p.urls.productPage) || '/s/' + encodeURIComponent(p.id) };
    return {
      productId: p.id,
      productName: p.name,
      logoUrl: (p.visual && p.visual.lockup) || p.lockup || null,
      badge,
      description: desc,
      whyThisFits: why,
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

  function renderCards(vms, copy, esc) {
    const e = esc || defaultEsc;
    const c = copy || {};
    return '<div class="reco">' + list(vms).map(vm => {
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
      return '<article class="reco__card' + (best ? ' reco__card--best' : ' reco__card--also') + '" data-product="' + e(vm.productId) + '">' +
        '<p class="reco__badge">' + e(best ? (c.bestFit || 'Best fit') : (c.alsoConsider || 'Also worth considering')) + '</p>' +
        '<div class="reco__head">' +
          (logo ? '<img class="reco__logo" src="' + e(logo) + '" alt="" loading="lazy" decoding="async">' : '<span class="reco__mark" aria-hidden="true"></span>') +
          '<div class="reco__title"><h3 class="reco__name">' + e(vm.productName) + '</h3>' +
          (best ? '<p class="reco__desc">' + e(vm.description) + '</p>' : '') + '</div>' +
        '</div>' +
        (best ? '<p class="reco__whylabel">Why this fits you</p>' : '') +
        '<p class="reco__why">' + e(vm.whyThisFits) + '</p>' +
        (best && vm.capabilities.length ? '<ul class="reco__caps">' + vm.capabilities.map(x => '<li>' + e(x) + '</li>').join('') + '</ul>' : '') +
        '<div class="reco__acts">' + primary + secondary + '</div>' +
      '</article>';
    }).join('') + '</div>';
  }

  return { buildCards, renderCards, needFor, actionFor };
});
