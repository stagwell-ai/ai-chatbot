/* ═══════════════════════════════════════════════════════════════════════════
   RECOMMEND — the deterministic recommendation engine (brief §11, §12, §41).

   Pure. No DOM, no fetch, no window: signals in, ranked products out. It runs
   unchanged in the browser (as window.SAIRECOMMEND), inside the Vercel
   function that revalidates a lead, and under `node --test`. Every number it
   uses is read from data/scoring.json; every product fact from
   data/solutions.json; every intent from data/taxonomy.json. Nothing about a
   product is written here.

   The pipeline it sits in:

       visitor words → (model | keywords) → INTENT SIGNALS → this → conversation

   The model never picks a product. It normalises language into taxonomy ids;
   this file turns ids into a ranking the team can read, test and tune.

   API (all functions take a `data` bundle: { solutions, goals, taxonomy, scoring }
   — the parsed JSON files, in whatever shape the loader hands them):

     recommend(signals, data)      → { ranked, primary, secondary, confidence, candidates }
     keywordIntents(text, data)    → [{ id, explicit:false, term }]  the no-model reader
     contactRequest(text, data)    → 'call'|'demo'|'trial'|'expert'|'pricing'|null
     bandsFromText(text, data)     → { companySize, creatorProgramSize, geographicScope }
     goalForDomain(domain, data)   → goal id | null   (a routing.json domain → a goal)
     goalById(id, data)            → goal | null
     productById(id, data)         → product | null
     activeProducts(data)          → product[]

   `signals` is the visitor's structured state:
     { goal, intents:[{ id, explicit }], companySize, creatorProgramSize, geographicScope }
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.SAIRECOMMEND = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  /* ── the data, read through accessors so a half-loaded bundle degrades ── */
  const list = v => (Array.isArray(v) ? v : []);
  const solutionsOf = data => {
    const s = data && data.solutions;
    if (Array.isArray(s)) return s;
    return list(s && s.solutions);
  };
  const goalsOf = data => list(data && data.goals && data.goals.goals);
  const intentsOf = data => list(data && data.taxonomy && data.taxonomy.intents);
  const bandsOf = data => (data && data.taxonomy && data.taxonomy.bands) || {};
  const weightsOf = data => Object.assign({
    explicitPrimaryMatch: 8, primaryMatch: 5, secondaryMatch: 2, goalAlignment: 2,
    companySizeFit: 2, creatorVolumeFit: 4, geographyFit: 1,
    explicitContradiction: -8, audienceMismatch: -4, useCaseMismatch: -5
  }, (data && data.scoring && data.scoring.weights) || {});
  const confOf = data => Object.assign({ minTopScore: 7, highGap: 4, mediumGap: 2, stopAt: 'high' },
    (data && data.scoring && data.scoring.confidence) || {});
  const convOf = data => Object.assign({ maxQuestions: 4, topCandidates: 4, closeGap: 4, secondaryMax: 2, secondaryMinScore: 4, alwaysAskCompanySize: true },
    (data && data.scoring && data.scoring.conversation) || {});

  const activeProducts = data => solutionsOf(data).filter(p => p && p.id && p.active !== false);
  const productById = (id, data) => solutionsOf(data).find(p => p && p.id === id) || null;
  const goalById = (id, data) => goalsOf(data).find(g => g && g.id === id) || null;
  const goalForDomain = (domain, data) => {
    const g = goalsOf(data).find(x => x && x.domain === domain);
    return g ? g.id : null;
  };
  const intentById = (id, data) => intentsOf(data).find(i => i && i.id === id) || null;

  /* ═════════════════════════════════════════════════════════════════════════
     TEXT → SIGNALS, without a model. Same normalisation as engine.js so the
     two keyword passes agree on what a word is.
     ═════════════════════════════════════════════════════════════════════════ */
  const norm = s => String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
    .replace(/'s\b/g, '').replace(/'/g, '')
    .replace(/\s+/g, ' ').trim();
  const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* whole word or phrase, plural-tolerant, never inside a longer word */
  const kwRe = kw => new RegExp('(?<![a-z0-9+])' + escRe(norm(kw)) + 's?(?![a-z0-9])');

  /* ── ECLIPSE ──
     Every intent that hits is returned, and two intents is what puts two
     products neck and neck. So an intent whose ONLY evidence is a fragment of
     another intent's longer phrase has not found a second need — it has found
     part of the first. "answer engine optimisation" is the influence intent;
     the measuring intent's "answer engine" inside it is not a second signal.

     An intent is eclipsed only when EVERY term it matched sits, whole-word,
     inside a strictly longer term another intent matched. One term of its own
     anywhere and it survives, so a genuinely two-sided sentence still comes
     back as two intents. Strictly-longer makes mutual eclipse impossible, so
     the result can never come back empty. (engine.js carries the same rule for
     the older router; this is the same idea in the scorer.) */
  function containsPhrase(hay, needle) {
    try { return new RegExp('(?<![a-z0-9])' + escRe(needle) + '(?![a-z0-9])').test(hay); }
    catch (e) { return false; }
  }
  function eclipsed(entry, all) {
    return all.some(other => other.id !== entry.id && entry.terms.every(kw =>
      other.terms.some(t => t.length > kw.length && containsPhrase(t, kw))));
  }

  /* every intent the text touches, strongest first — the longest keyword that
     hit, then how many hit, then taxonomy order. `explicit` is false: words
     the visitor typed are read, not chosen from a list. */
  function keywordIntents(text, data) {
    const t = norm(text);
    if (!t) return [];
    const out = [];
    intentsOf(data).forEach((intent, order) => {
      let longest = 0, hits = 0, term = null;
      const terms = [];
      list(intent.keywords).forEach(kw => {
        if (!kw) return;
        const norm_kw = norm(kw);
        let re; try { re = kwRe(kw); } catch (e) { return; }
        if (re.test(t)) { hits++; terms.push(norm_kw); if (kw.length > longest) { longest = kw.length; term = kw; } }
      });
      if (hits) out.push({ id: intent.id, explicit: false, term, longest, hits, order, terms });
    });
    return out
      .filter(d => !eclipsed(d, out))
      .sort((a, b) => (b.longest - a.longest) || (b.hits - a.hits) || (a.order - b.order))
      .map(x => ({ id: x.id, explicit: false, term: x.term }));
  }

  /* ── "just call me" ──
     The visitor asking to be CONTACTED rather than advised. It is not an
     intent — it says nothing about which product fits — so it is read
     separately and it ends the questions rather than answering one (client,
     2026-09-10: "if the person just ever cuts the chase … fast-track them to
     filling out the form"). The phrases live in taxonomy.json; the longest
     match wins, so "book a demo" beats "a demo" and a message that asks for
     two things at once resolves to the more specific one. */
  function contactRequest(text, data) {
    const t = norm(text);
    if (!t) return null;
    let best = null, longest = 0;
    list(data && data.taxonomy && data.taxonomy.contactRequests).forEach(r => {
      list(r.keywords).forEach(kw => {
        if (!kw || kw.length <= longest) return;
        let re; try { re = kwRe(kw); } catch (e) { return; }
        if (re.test(t)) { longest = kw.length; best = r.id; }
      });
    });
    return best;
  }

  const contactRequestIds = data => list(data && data.taxonomy && data.taxonomy.contactRequests).map(r => r.id);

  /* "3,000 people", "500 employees", "a 40-person team" → a size band */
  const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, thousand: 1000, dozen: 12, 'a few': 3, several: 5, handful: 5 };
  function numberBefore(t, unitRe) {
    /* up to two words may sit between the number and its unit: "30 TikTok
       creators", "500 active creators", "3,000 full-time employees" */
    const re = new RegExp('(\\d[\\d,.]*)\\s*(k|thousand|million|m)?\\s*(\\+|plus)?[\\s-]*(?:[a-z][a-z-]*\\s+){0,2}(?:' + unitRe + ')');
    const m = t.match(re);
    if (m) {
      let n = parseFloat(m[1].replace(/,/g, ''));
      if (!isFinite(n)) return null;
      if (m[2] === 'k' || m[2] === 'thousand') n *= 1000;
      if (m[2] === 'million' || m[2] === 'm') n *= 1000000;
      return Math.round(n);
    }
    const w = t.match(new RegExp('\\b(hundreds|thousands|dozens|a few|several|handful|' + Object.keys(NUM_WORDS).join('|') + ')(?: of)?[\\s-]*(?:' + unitRe + ')'));
    if (w) {
      const k = w[1];
      if (k === 'hundreds') return 300;
      if (k === 'thousands') return 3000;
      if (k === 'dozens') return 36;
      return NUM_WORDS[k] || null;
    }
    return null;
  }
  const sizeBand = n => (n == null ? null : n < 250 ? 'smb' : n < 2500 ? 'mid_market' : 'enterprise');
  const creatorBand = n => (n == null ? null : n < 100 ? 'under_100' : '100_plus');

  function bandFromKeywords(t, bands) {
    let best = null, longest = 0;
    list(bands).forEach(b => list(b.keywords).forEach(kw => {
      let re; try { re = kwRe(kw); } catch (e) { return; }
      if (re.test(t) && kw.length > longest) { longest = kw.length; best = b.id; }
    }));
    return best;
  }

  function bandsFromText(text, data) {
    const t = norm(text);
    const B = bandsOf(data);
    const out = { companySize: null, creatorProgramSize: null, geographicScope: null };
    if (!t) return out;
    const creators = numberBefore(t, 'creators?|influencers?|kols?|ambassadors?');
    if (creators != null) out.creatorProgramSize = creatorBand(creators);
    const people = numberBefore(t, 'people|employees?|persons?|staff|headcount|ftes?|team|seats|strong|person team|person company');
    if (people != null) out.companySize = sizeBand(people);
    if (!out.companySize) out.companySize = bandFromKeywords(t, B.companySize);
    if (!out.creatorProgramSize) out.creatorProgramSize = bandFromKeywords(t, B.creatorVolume);
    out.geographicScope = bandFromKeywords(t, B.geographicScope);
    return out;
  }

  /* ═════════════════════════════════════════════════════════════════════════
     SCORING
     ═════════════════════════════════════════════════════════════════════════ */
  function dedupeIntents(intents) {
    const seen = {};
    list(intents).forEach(i => {
      if (!i || !i.id) return;
      const id = String(i.id);
      if (!seen[id]) seen[id] = { id, explicit: !!i.explicit };
      else if (i.explicit) seen[id].explicit = true;   /* chosen beats read */
    });
    return Object.keys(seen).map(k => seen[k]);
  }

  function scoreProduct(p, sig, goal, data, W) {
    let score = 0;
    const reasons = [];
    const matched = { primary: [], secondary: [] };
    const tags = p.intentTags || {};
    const primary = list(tags.primary), secondary = list(tags.secondary), excludes = list(p.excludesIntents);

    if (goal && list(goal.candidates).indexOf(p.id) !== -1) {
      score += W.goalAlignment; reasons.push('goal:' + goal.id);
    }
    sig.intents.forEach(i => {
      if (primary.indexOf(i.id) !== -1) {
        score += i.explicit ? W.explicitPrimaryMatch : W.primaryMatch;
        matched.primary.push(i.id); reasons.push((i.explicit ? 'chosen:' : 'read:') + i.id);
      } else if (secondary.indexOf(i.id) !== -1) {
        score += W.secondaryMatch; matched.secondary.push(i.id); reasons.push('also:' + i.id);
      }
      if (excludes.indexOf(i.id) !== -1) { score += W.useCaseMismatch; reasons.push('excludes:' + i.id); }
    });

    const aud = p.audiences || {};
    if (sig.companySize && list(aud.companySize).length) {
      if (aud.companySize.indexOf(sig.companySize) !== -1) { score += W.companySizeFit; reasons.push('size_fit:' + sig.companySize); }
      else { score += W.audienceMismatch; reasons.push('size_mismatch:' + sig.companySize); }
    }
    if (sig.creatorProgramSize && sig.creatorProgramSize !== 'unknown' && list(aud.creatorVolume).length) {
      if (aud.creatorVolume.indexOf(sig.creatorProgramSize) !== -1) { score += W.creatorVolumeFit; reasons.push('creators_fit:' + sig.creatorProgramSize); }
      else { score += W.explicitContradiction; reasons.push('creators_contradiction:' + sig.creatorProgramSize); }
    }
    if (sig.geographicScope && list(aud.geography).length) {
      if (aud.geography.indexOf(sig.geographicScope) !== -1) { score += W.geographyFit; reasons.push('geo_fit:' + sig.geographicScope); }
      else { score += W.audienceMismatch; reasons.push('geo_mismatch:' + sig.geographicScope); }
    }
    return { productId: p.id, name: p.name, score, reasons, matched };
  }

  function confidence(ranked, C) {
    const top = ranked.length ? ranked[0].score : 0;
    const second = ranked.length > 1 ? ranked[1].score : 0;
    const gap = ranked.length ? top - second : 0;
    let level = 'low';
    if (top >= C.minTopScore && gap >= C.highGap) level = 'high';
    else if (top >= C.minTopScore && gap >= C.mediumGap) level = 'medium';
    return { level, top, second, gap };
  }

  function recommend(signals, data) {
    const sig = Object.assign({ goal: null, intents: [], companySize: null, creatorProgramSize: null, geographicScope: null }, signals || {});
    sig.intents = dedupeIntents(sig.intents);
    const W = weightsOf(data), C = confOf(data), V = convOf(data);
    const goal = sig.goal ? goalById(sig.goal, data) : null;
    const candidateOrder = goal ? list(goal.candidates) : [];

    const scored = activeProducts(data).map((p, i) => Object.assign(scoreProduct(p, sig, goal, data, W), { _i: i }));
    const ranked = scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ai = candidateOrder.indexOf(a.productId), bi = candidateOrder.indexOf(b.productId);
      if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a._i - b._i;
    }).map(r => { delete r._i; return r; });

    const conf = confidence(ranked, C);
    const hasEvidence = sig.intents.length > 0 || !!goal;
    const primary = hasEvidence && ranked.length && ranked[0].score > 0 ? ranked[0].productId : null;

    /* the running: everything within closeGap of the top, positive, capped */
    const topScore = ranked.length ? ranked[0].score : 0;
    const candidates = ranked
      .filter(r => r.score > 0 && topScore - r.score <= V.closeGap)
      .slice(0, V.topCandidates)
      .map(r => r.productId);

    const secondary = primary ? ranked.slice(1)
      .filter(r => r.score >= V.secondaryMinScore)
      .slice(0, V.secondaryMax)
      .map(r => r.productId) : [];

    return { ranked, primary, secondary, confidence: conf, candidates, signals: sig };
  }

  return {
    recommend, keywordIntents, bandsFromText, contactRequest, contactRequestIds,
    goalForDomain, goalById, productById, intentById,
    activeProducts, dedupeIntents, norm,
    _config: { weightsOf, confOf, convOf }
  };
});
