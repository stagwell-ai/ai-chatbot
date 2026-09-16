/* ═══════════════════════════════════════════════════════════════════════════
   QUESTION SELECTION — the client's order (2026-09-10):
     1) what they want to solve  2) their website  3) what was found about it
     4) how large the org is  5) their role  6) the recommendation
   The opening questions carry `first` and are asked in that order while their
   field is unknown; a discriminating question is asked only when there is no
   intent to recommend from (a bare goal), and then once. Inferred fields are
   never asked again.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, R, Q, walk } from './_data.mjs';

const reco = st => R.recommend({ goal: st.primaryGoal, intents: st.intents, companySize: st.companySize, creatorProgramSize: st.creatorProgramSize, geographicScope: st.geographicScope }, DATA);
const blank = (goal, extra) => Object.assign({ primaryGoal: goal, intents: [], askedQuestionIds: [], website: null, role: null, companySize: null, creatorProgramSize: null, geographicScope: null }, extra || {});
/* past the three opening questions: these are tests about what comes AFTER them */
const opened = (goal, extra) => blank(goal, Object.assign({ askedQuestionIds: ['website', 'company_size', 'role'], website: 'acme.com', companySize: 'mid', role: 'director_vp' }, extra || {}));

test('bank shape: every discovery question has a purpose, a prompt and a valid field; intent values exist in the taxonomy', () => {
  const intents = DATA.taxonomy.intents.map(i => i.id);
  const bands = DATA.taxonomy.bands;
  const bank = DATA.questions.discovery.questions;
  const discriminators = bank.filter(q => !q.first);
  assert.ok(discriminators.length >= 10 && discriminators.length <= 15, 'MVP asks for 10–15 discriminating questions');
  bank.forEach(q => {
    assert.ok(q.purpose && q.prompt, q.id);
    if (q.first) {
      /* the website is a free-text ask with NO chip out of it — "we really want
         to get their company" (client); size and role are plain sets of choices */
      if (q.field === 'website') assert.equal(q.suggestions.length, 0, 'no skip chip on the website');
      else assert.ok(q.suggestions.length >= 2 && q.suggestions.length <= 5, q.id + ' suggestions');
      return;
    }
    assert.ok(q.suggestions.length >= 2 && q.suggestions.length <= 5, q.id + ' pill count');
    if (!q.field || q.field === 'intent') q.suggestions.forEach(s => assert.ok(intents.includes(s.value), q.id + ' → ' + s.value));
    else {
      const bandName = { companySize: 'companySize', creatorProgramSize: 'creatorVolume', geographicScope: 'geographicScope' }[q.field];
      const ids = bands[bandName].map(b => b.id).concat(['unknown']);
      q.suggestions.forEach(s => assert.ok(ids.includes(s.value), q.id + ' band ' + s.value));
    }
    (q.separates || []).forEach(id => assert.ok(R.productById(id, DATA), q.id + ' separates unknown ' + id));
  });
});

test('the opening order is website → company size → role, for every goal', () => {
  DATA.goals.goals.forEach(g => {
    const s0 = blank(g.id);
    assert.equal(Q.selectQuestion(s0, reco(s0), DATA).id, 'website', g.id + ': the website first');
    const s1 = blank(g.id, { website: 'acme.com', askedQuestionIds: ['website'] });
    assert.equal(Q.selectQuestion(s1, reco(s1), DATA).id, 'company_size', g.id + ': then how large the org is');
    const s2 = blank(g.id, { website: 'acme.com', companySize: 'small', askedQuestionIds: ['website', 'company_size'] });
    assert.equal(Q.selectQuestion(s2, reco(s2), DATA).id, 'role', g.id + ': then the role');
  });
});

test('what the site lookup already found is not asked again: size known → straight to the role', () => {
  const s = blank('operations', { website: 'acmehotels.com', companySize: 'large', askedQuestionIds: ['website'] });
  assert.equal(Q.selectQuestion(s, reco(s), DATA).id, 'role');
});

test('a declined website ("__skip__") still counts as answered — the order carries on', () => {
  const s = blank('competition', { website: '__skip__', askedQuestionIds: ['website'] });
  assert.equal(Q.selectQuestion(s, reco(s), DATA).id, 'company_size');
});

test('a bare goal — no intent to recommend from — gets that goal\'s own opener once, then the recommendation', () => {
  DATA.goals.goals.forEach(g => {
    const st = opened(g.id);
    const q = Q.selectQuestion(st, reco(st), DATA);
    assert.equal(q && q.id, g.firstQuestion, g.id + ' asks its own opener');
    st.askedQuestionIds.push(q.id);
    Q.applySuggestion(st, q, q.suggestions[0]);
    assert.equal(Q.selectQuestion(st, reco(st), DATA), null, g.id + ': one discriminator, then the recommendation');
  });
});

test('with an intent known the recommendation follows the role directly — no discriminator, whatever the confidence', () => {
  /* two AI-search intents tie GEOPulse and Search+: low confidence, and the
     client still wants the recommendation now, not another question */
  const st = opened(null, { intents: [{ id: 'ai_search_visibility', explicit: false }, { id: 'ai_search_influence', explicit: false }] });
  const r = reco(st);
  assert.notEqual(r.confidence.level, 'high');
  assert.equal(Q.selectQuestion(st, r, DATA), null);
  /* and an obvious one, the same */
  const st2 = opened('competition', { intents: [{ id: 'competitive_activity', explicit: true }] });
  assert.equal(Q.selectQuestion(st2, reco(st2), DATA), null);
});

test('the whole walk, from a bare goal: three openers, one discriminator, done', () => {
  const r = walk('competition', ['small', 'manager', 'current_activity']);
  assert.deepEqual(r.trail.map(t => t.id), ['website', 'company_size', 'role', 'competition_type']);
  assert.equal(r.reco.primary, 'newintel');
});

test('the whole walk, from a typed need: three openers and straight to the recommendation', () => {
  const r = walk(null, ['mid', 'director_vp'], { intents: [{ id: 'customer_voice_ai', explicit: false }, { id: 'customer_chat_ai', explicit: false }] });
  assert.deepEqual(r.trail.map(t => t.id), ['website', 'company_size', 'role']);
  assert.equal(r.reco.primary, 'newvoices');
});

test('the question budget holds even when every answer is unhelpful', () => {
  const st = blank('brand_awareness');
  let n = 0;
  for (;;) {
    const q = Q.selectQuestion(st, reco(st), DATA);
    if (!q) break;
    st.askedQuestionIds.push(q.id); n++;
    if (n > 12) assert.fail('never stopped');
    /* answer nothing: the question is marked asked and no signal is added */
  }
  const max = DATA.scoring.conversation.maxQuestions;
  assert.ok(n <= max + 3, 'asked ' + n + ' with a budget of ' + max + ' + 3 openers');
});

test('free text on a question matches a suggestion loosely', () => {
  const q = DATA.questions.discovery.questions.find(x => x.id === 'competition_type');
  assert.equal(Q.matchSuggestion(q, 'How our brand compares').id, 'brand_compare');
  assert.equal(Q.matchSuggestion(q, 'competitive_activity').id, 'current_activity');
  assert.equal(Q.matchSuggestion(q, 'something else entirely'), null);
});
