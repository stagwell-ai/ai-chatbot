/* ═══════════════════════════════════════════════════════════════════════════
   QUESTION SELECTION — brief §49B: inferred fields are not asked again, the
   highest-value discriminator is chosen, asking stops when confidence is high.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, R, Q, walk } from './_data.mjs';

const reco = st => R.recommend({ goal: st.primaryGoal, intents: st.intents, companySize: st.companySize, creatorProgramSize: st.creatorProgramSize, geographicScope: st.geographicScope }, DATA);
/* past the website step by default: these are tests about which DISCRIMINATOR
   is chosen, and the website is asked before all of them (see the test above) */
const fresh = (goal, extra) => Object.assign({ primaryGoal: goal, intents: [], askedQuestionIds: ['website', 'role'], website: 'acme.com', role: 'director_vp', companySize: null, creatorProgramSize: null, geographicScope: null }, extra || {});
const beforeWebsite = (goal, extra) => Object.assign({ primaryGoal: goal, intents: [], askedQuestionIds: [], website: null, companySize: null, creatorProgramSize: null, geographicScope: null }, extra || {});

test('bank shape: every discovery question has 2–5 suggestions, a purpose and a valid field; intent values exist in the taxonomy', () => {
  const intents = DATA.taxonomy.intents.map(i => i.id);
  const bands = DATA.taxonomy.bands;
  const bank = DATA.questions.discovery.questions;
  const discriminators = bank.filter(q => !q.first);
  assert.ok(discriminators.length >= 10 && discriminators.length <= 15, 'MVP asks for 10–15 discriminating questions');
  bank.forEach(q => {
    assert.ok(q.purpose && q.prompt, q.id);
    /* a `first` question (the website) is a free-text ask with one way out of
       it, not a set of discriminating pills */
    if (q.first) {
      /* asked before the discriminators: either a free-text ask with one way
         out of it (the website) or a plain set of choices (the role) */
      const skip = q.suggestions.length === 1 && q.suggestions[0].value === '__skip__';
      assert.ok(skip || (q.suggestions.length >= 2 && q.suggestions.length <= 5), q.id + ' suggestions');
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

test('every conversation opens by asking for the website, then the goal\'s own discriminator', () => {
  DATA.goals.goals.forEach(g => {
    const bare = beforeWebsite(g.id);
    assert.equal(Q.selectQuestion(bare, reco(bare), DATA).id, 'website', g.id + ' asks for the website first');
    const afterSite = beforeWebsite(g.id, { website: 'acme.com', askedQuestionIds: ['website'] });
    assert.equal(Q.selectQuestion(afterSite, reco(afterSite), DATA).id, 'role', g.id + ' then asks the role');
  });
});

test('a goal pill is followed by that goal\'s own discriminator', () => {
  DATA.goals.goals.forEach(g => {
    const st = fresh(g.id);
    const q = Q.selectQuestion(st, reco(st), DATA);
    assert.equal(q && q.id, g.firstQuestion, g.id);
  });
});

test('a field already inferred from free text is not asked again', () => {
  const st = fresh('audience_growth', { companySize: 'enterprise', creatorProgramSize: '100_plus', intents: [{ id: 'creator_management', explicit: false }] });
  const asked = [];
  for (let i = 0; i < 6; i++) {
    const q = Q.selectQuestion(st, reco(st), DATA);
    if (!q) break;
    asked.push(q.id); st.askedQuestionIds.push(q.id);
    Q.applySuggestion(st, q, q.suggestions[0]);
  }
  assert.ok(!asked.includes('company_size'), 'company size known → not asked');
  assert.ok(!asked.includes('creator_scale'), 'creator scale known → not asked');
});

test('the highest-value discriminator is selected: with two monitoring products in the running, the scope question wins', () => {
  const st = fresh('reputation', { intents: [{ id: 'media_monitoring', explicit: false }, { id: 'reputation_risk', explicit: false }], askedQuestionIds: ['website', 'role', 'reputation_scope'] });
  const r = reco(st);
  assert.ok(r.candidates.includes('knowledge_machine') && r.candidates.includes('unicepta'));
  const q = Q.selectQuestion(st, r, DATA);
  assert.equal(q.id, 'monitoring_scope');
});

test('asking stops when confidence is high; only the required size question remains, then nothing', () => {
  const st = fresh('competition', { intents: [{ id: 'competitive_activity', explicit: true }], askedQuestionIds: ['website', 'role', 'competition_type'] });
  const r = reco(st);
  assert.equal(r.confidence.level, 'high');
  const q = Q.selectQuestion(st, r, DATA);
  assert.equal(q.id, 'company_size', 'high confidence → straight to the one required question');
  st.askedQuestionIds.push(q.id); Q.applySuggestion(st, q, q.suggestions[1]);
  assert.equal(Q.selectQuestion(st, reco(st), DATA), null);
});

test('obvious intent spends no DISCRIMINATOR — only the opening qualification (brief §5)', () => {
  const r = walk(null, ['mid'], { intents: [{ id: 'customer_voice_ai', explicit: false }, { id: 'customer_chat_ai', explicit: false }] });
  assert.equal(r.reco.primary, 'newvoices');
  /* the website and the role are asked of everyone — they are what makes the
     rest of the conversation about this visitor — and company size only while
     it is still unknown. None of them is a discriminating question. */
  const bank = DATA.questions.discovery.questions;
  const kind = id => { const q = bank.find(x => x.id === id); return q.first ? 'opening' : q.required ? 'qualification' : 'discriminator'; };
  const asked = r.trail.map(t => t.id);
  assert.deepEqual(asked.filter(id => kind(id) === 'discriminator'), [], 'asked ' + asked.join(','));
  assert.ok(asked.length <= 3, 'asked ' + asked.join(','));
});

test('the question budget holds even when every answer is unhelpful', () => {
  const st = fresh('brand_awareness');
  let n = 0;
  for (;;) {
    const q = Q.selectQuestion(st, reco(st), DATA);
    if (!q) break;
    st.askedQuestionIds.push(q.id); n++;
    if (n > 12) assert.fail('never stopped');
    /* answer nothing: the question is marked asked and no signal is added */
  }
  const max = DATA.scoring.conversation.maxQuestions;
  assert.ok(n <= max + 1, 'asked ' + n + ' with a budget of ' + max + ' + 1 required');
});

test('free text on a question matches a suggestion loosely', () => {
  const q = DATA.questions.discovery.questions.find(x => x.id === 'competition_type');
  assert.equal(Q.matchSuggestion(q, 'How our brand compares').id, 'brand_compare');
  assert.equal(Q.matchSuggestion(q, 'competitive_activity').id, 'current_activity');
  assert.equal(Q.matchSuggestion(q, 'something else entirely'), null);
});
