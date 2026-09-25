/* ═══════════════════════════════════════════════════════════════════════════
   SELECT-QUESTION — which discriminating question to ask next, or none.

   Pure, like recommend.js: state + the current ranking in, one question (or
   null) out. The bank is data/questions.json `discovery`; the stop rule is
   data/scoring.json `confidence` / `conversation`. The UI never decides what
   to ask; the conversation engine calls this and renders the answer.

   The brief's rule (§5): keep asking only while
     1. the top product's confidence is too low, or
     2. the top two are too close, or
     3. a single known question would meaningfully improve the routing, or
     4. required lead-qualification data is missing and genuinely useful.

   Expressed here as: while confidence is below `stopAt` and fewer than
   `maxQuestions` discriminators have been asked, pick the eligible question
   whose `separates` list overlaps the products still in the running the most
   (ties → priority, then bank order). When the discriminators are done, ask
   each `required` question whose field is still unknown, once. Then null.

   API:
     selectQuestion(state, reco, data)           → question | null
     applySuggestion(state, question, suggestion) → state (mutated: intent or band)
     matchSuggestion(question, text)             → suggestion | null  (label/value/id, loosely)
     eligible(state, reco, data)                 → [{ question, value }]  for tests and the console
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.SAISELECT = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const list = v => (Array.isArray(v) ? v : []);
  const bank = data => list(data && data.questions && data.questions.discovery && data.questions.discovery.questions);
  const confOf = data => Object.assign({ stopAt: 'high' }, (data && data.scoring && data.scoring.confidence) || {});
  const convOf = data => Object.assign({ maxQuestions: 4, alwaysAskCompanySize: true }, (data && data.scoring && data.scoring.conversation) || {});
  const LEVEL = { low: 0, medium: 1, high: 2 };

  const norm = s => String(s == null ? '' : s).toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/[?.!,]+/g, ' ').replace(/\s+/g, ' ').trim();

  const knownIntentIds = state => list(state && state.intents).map(i => i && i.id).filter(Boolean);
  const fieldKnown = (state, field) => {
    if (!field || field === 'intent') return false;
    const v = state && state[field];
    return v != null && v !== '';
  };

  function passes(q, state, reco) {
    const w = q.askWhen || {};
    if (w.always) return true;
    const known = knownIntentIds(state);
    const cands = list(reco && reco.candidates);
    if (list(w.goals).length && state && state.primaryGoal && w.goals.indexOf(state.primaryGoal) !== -1) return true;
    if (list(w.intentsAny).length && w.intentsAny.some(id => known.indexOf(id) !== -1)) return true;
    if (list(w.candidatesAll).length && w.candidatesAll.every(id => cands.indexOf(id) !== -1)) return true;
    if (list(w.candidatesAny).length && w.candidatesAny.some(id => cands.indexOf(id) !== -1)) return true;
    return false;
  }

  /* a question that can only add intents the visitor has already given us
     teaches nothing — every suggestion value already in the signals */
  function exhausted(q, state) {
    if (q.field && q.field !== 'intent') return false;
    const known = knownIntentIds(state);
    const values = list(q.suggestions).map(s => s && s.value).filter(Boolean);
    return values.length > 0 && values.every(v => known.indexOf(v) !== -1);
  }

  function eligible(state, reco, data) {
    const asked = list(state && state.askedQuestionIds);
    const cands = list(reco && reco.candidates);
    return bank(data)
      .filter(q => q && q.id && !q.required && !q.first)
      .filter(q => asked.indexOf(q.id) === -1)
      .filter(q => !fieldKnown(state, q.field))
      .filter(q => !exhausted(q, state))
      .filter(q => passes(q, state, reco))
      .map((q, i) => {
        const overlap = list(q.separates).filter(id => cands.indexOf(id) !== -1).length;
        return { question: q, value: overlap, priority: q.priority || 0, i };
      })
      /* a question that separates only one product in the running adds nothing —
         unless it is the goal's own opener, which is how a bare goal becomes intents */
      .filter(e => e.value >= 2 || (e.question.askWhen && list(e.question.askWhen.goals).indexOf(state && state.primaryGoal) !== -1))
      .sort((a, b) => (b.value - a.value) || (b.priority - a.priority) || (a.i - b.i));
  }

  /* ── TWO PRODUCTS THE WORDS CANNOT TELL APART ──
     GEOPulse and Search+ both live on "AI search"; IMAI and the SMB platform
     on "influencers"; the Knowledge Machine and UNICEPTA on "reputation". When
     the top two of the ranking are such a pair (scoring.json siblingPairs) and
     the gap between them is small, the pair is returned — the caller asks the
     one question that separates them instead of guessing. */
  function siblingTie(reco, data) {
    const V = convOf(data);
    const pairs = list(V.siblingPairs);
    const ranked = list(reco && reco.ranked);
    if (!pairs.length || ranked.length < 2) return null;
    /* a goal pill alone gives every candidate the same points: that is not a
       tie between two products, it is no evidence yet */
    if (!list(reco && reco.signals && reco.signals.intents).length) return null;
    const a = ranked[0], b = ranked[1];
    if (!a || !b || !(a.score > 0) || !(b.score > 0)) return null;
    if (a.score - b.score > (V.pairGap == null ? 2 : V.pairGap)) return null;
    const hit = pairs.find(p => list(p).indexOf(a.productId) !== -1 && list(p).indexOf(b.productId) !== -1);
    return hit ? [a.productId, b.productId] : null;
  }

  function selectQuestion(state, reco, data) {
    const C = confOf(data), V = convOf(data);
    const st = state || {};
    const asked = list(st.askedQuestionIds);

    /* `first` — asked before anything else, while its field is unknown. Today
       that is the website: reading the visitor's own site is what makes every
       question after it about them rather than about marketing in general
       (client, 2026-09-10: "it should have asked me about my website, and then
       it should do a quick search … and then keep talking to me with added
       relevance"). It does not spend the discriminator budget. */
    const first = bank(data)
      .filter(q => q && q.first && asked.indexOf(q.id) === -1 && !fieldKnown(st, q.field))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    /* the typed steps — the address, the website — stay in front of everything */
    if (first && (first.field === 'email' || first.field === 'website')) return first;

    const discriminatorsAsked = asked.filter(id => { const q = bank(data).find(x => x && x.id === id); return q && !q.required && !q.first; }).length;
    const level = (reco && reco.confidence && reco.confidence.level) || 'low';
    const settled = LEVEL[level] >= (LEVEL[C.stopAt] == null ? 2 : LEVEL[C.stopAt]);

    /* ── the sibling tie-break, in ONE place: before the cards ──
       The products are shown as soon as the address step is behind us (client,
       2026-09-16), so this is the last moment a question can change what is
       shown. If the running is two siblings the words cannot separate, the one
       question that tells them apart is asked here, ahead of the size and the
       role. It is never asked later: once size and role are in, the client's
       order stands — after the role, the recommendation, and a level pair is
       shown as two cards rather than asked about again (2026-09-10). */
    const tie = first ? siblingTie(reco, data) : null;
    if (tie && !settled && discriminatorsAsked < V.maxQuestions) {
      const q = eligible(st, reco, data).find(e => tie.every(id => list(e.question.separates).indexOf(id) !== -1));
      if (q) return q.question;
    }
    if (first) return first;

    /* the client's order (2026-09-10): website, size, role, then the
       recommendation. A discriminator is asked only when there is nothing to
       recommend from — a bare goal with no intent behind it — and then once. */
    const noIntent = knownIntentIds(st).length === 0;
    if (!settled && discriminatorsAsked < V.maxQuestions && (!V.discriminateOnlyWithoutIntent || noIntent)) {
      const next = eligible(st, reco, data)[0];
      if (next) return next.question;
    }

    /* required qualification, once each, only while still unknown */
    const req = bank(data).filter(q => q && q.required && !q.first && asked.indexOf(q.id) === -1 && !fieldKnown(st, q.field));
    if (req.length) {
      if (req[0].field === 'companySize' && V.alwaysAskCompanySize === false) return null;
      return req[0];
    }
    return null;
  }

  function matchSuggestion(question, text) {
    const t = norm(text);
    if (!t || !question) return null;
    const S = list(question.suggestions);
    return S.find(s => s && (norm(s.value) === t || norm(s.label) === t || norm(s.id) === t)) ||
      S.find(s => s && norm(s.label) && (t.indexOf(norm(s.label)) !== -1 || norm(s.label).indexOf(t) !== -1) && t.length >= 3) ||
      null;
  }

  function applySuggestion(state, question, suggestion) {
    const st = state || {};
    if (!question || !suggestion) return st;
    st.intents = list(st.intents);
    st.askedQuestionIds = list(st.askedQuestionIds);
    const field = question.field || 'intent';
    if (field === 'intent') {
      const id = String(suggestion.value || '');
      const have = st.intents.find(i => i && i.id === id);
      if (have) have.explicit = true; else if (id) st.intents.push({ id, explicit: true });
    } else {
      st[field] = suggestion.value == null ? null : String(suggestion.value);
    }
    /* a suggestion may carry extra intents (rare; declared in the JSON) */
    list(suggestion.intents).forEach(id => {
      if (!st.intents.find(i => i && i.id === id)) st.intents.push({ id: String(id), explicit: true });
    });
    return st;
  }

  return { selectQuestion, applySuggestion, matchSuggestion, eligible, siblingTie, _passes: passes };
});
