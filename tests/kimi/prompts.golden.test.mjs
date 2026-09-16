/* ═══════════════════════════════════════════════════════════════════════════
   THE GOLDEN SET — the client's "Stagwell AI Chatbot Prompts to Products"
   sheet (2026-09-16): 15 products × 3 prompts × 3 keywords. Every prompt is
   run through the MODEL-FREE path — keyword intents → scorer — because that
   path is what carries the conversation when the model is slow, down, or the
   visitor is mid-sentence on voice, so it has to stand on its own.

   Before this sheet was folded in: 16/45 exact, 25/45 top-3, 16 landed on
   nothing at all. The bar below is where it stands now, minus a little room.
   The table it prints is the one the sheet's authors read.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA, R, Q, ROOT, readText } from './_data.mjs';

const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prompts-golden.json'), 'utf8')).rows;
const EXACT_FLOOR = 42, TOP3_FLOOR = 45;

function judge(row) {
  const reco = readText(row.prompt);
  const ranked = (reco.ranked || []).map(r => r.productId);
  const ok = row.accept || [row.product];
  const got = reco.primary || null;
  return { got, exact: got != null && ok.indexOf(got) !== -1, top3: ok.some(id => ranked.slice(0, 3).indexOf(id) !== -1), nothing: !got, intents: R.keywordIntents(row.prompt, DATA).map(i => i.id) };
}

test('golden sheet: every prompt lands on its product, model-free', () => {
  const res = G.map(r => Object.assign({ row: r }, judge(r)));
  const exact = res.filter(x => x.exact).length, top3 = res.filter(x => x.top3).length, nothing = res.filter(x => x.nothing).length;
  const table = {};
  res.forEach(x => { (table[x.row.sheetProduct] = table[x.row.sheetProduct] || []).push(x.exact ? '✓' : x.top3 ? '~' : '✗'); });
  console.log('\n  golden sheet · ' + G.length + ' prompts · exact ' + exact + ' · top-3 ' + top3 + ' · nothing ' + nothing);
  Object.keys(table).forEach(p => console.log('    ' + p.padEnd(44) + table[p].join('')));
  res.filter(x => !x.exact).forEach(x => console.log('    ' + (x.top3 ? '~' : '✗') + ' ' + x.row.sheetProduct + ' | "' + x.row.prompt + '" → ' + (x.got || '—') + ' [' + x.intents.join(',') + ']'));
  assert.equal(nothing, 0, 'a prompt from the sheet must never land on nothing');
  assert.ok(top3 >= TOP3_FLOOR, 'top-3: ' + top3 + ' < ' + TOP3_FLOOR);
  assert.ok(exact >= EXACT_FLOOR, 'exact: ' + exact + ' < ' + EXACT_FLOOR);
});

test('golden sheet: the accepted contradiction is the only one, and it is recorded', () => {
  const wide = G.filter(r => r.accept);
  assert.equal(wide.length, 1);
  assert.ok(/improve my AI search visibility/i.test(wide[0].prompt));
  assert.ok(wide[0]._why && wide[0]._why.length > 40, 'an accepted row says why');
});

test('golden sheet: every keyword the sheet lists is a phrase the taxonomy knows', () => {
  const all = DATA.taxonomy.intents.flatMap(i => i.keywords.map(k => R.norm(k)));
  const missing = [];
  G.forEach(r => r.keywords.forEach(k => {
    const n = R.norm(k);
    /* known whole, or every word of it is inside some known phrase */
    if (all.indexOf(n) === -1 && !all.some(p => p.indexOf(n) !== -1) && !R.keywordIntents(k, DATA).length) missing.push(k);
  }));
  assert.deepEqual(missing, [], 'sheet keywords the taxonomy does not read');
});

test('a product named outright tops the running — typed, or as the transcript hears it', () => {
  const cases = [
    ['tell me about GEOPulse', 'geopulse'], ['is quest brand the one for us?', 'questbrand'], ['we use unisepta today', 'unicepta'],
    ['what does bera do', 'bera'], ['I want the targeting machine', 'targeting_machine'], ['agent cloud pricing', 'agent_cloud'],
    ['new voices for our call center', 'newvoices'], ['tell me about the machine', 'machines_family'], ['search plus', 'search_plus']
  ];
  cases.forEach(([text, id]) => {
    const m = R.nameMentions(text, DATA);
    assert.equal(m[0], id, text + ' → ' + JSON.stringify(m));
    const prim = (R.productById(id, DATA).intentTags || {}).primary;
    const reco = R.recommend({ intents: prim.map(i => ({ id: i, explicit: true })) }, DATA);
    assert.equal(reco.primary, id, text + ' scores ' + reco.primary);
  });
  /* "machine" alone is not The Machine, and "the media machine" is not either */
  assert.deepEqual(R.nameMentions('our machine learning team', DATA), []);
  assert.equal(R.nameMentions('the media machine', DATA)[0], 'media_machine');
});

test('siblings: when the words leave two products level, the one question that separates them is asked before anything is shown', () => {
  const V = DATA.scoring.conversation;
  assert.ok(Array.isArray(V.siblingPairs) && V.siblingPairs.length >= 6);
  /* a tie by construction: one explicit intent each side */
  const pair = (a, b) => R.recommend({ intents: [{ id: a, explicit: false }, { id: b, explicit: false }] }, DATA);
  const tie = pair('ai_search_visibility', 'ai_search_influence');
  const t = Q.siblingTie(tie, DATA);
  assert.ok(t && t.indexOf('geopulse') !== -1 && t.indexOf('search_plus') !== -1, 'GEOPulse / Search+ read as a tie: ' + JSON.stringify(t) + ' ' + JSON.stringify(tie.ranked.slice(0, 2).map(r => r.productId + ':' + r.score)));
  const st = { primaryGoal: null, intents: tie.signals.intents, askedQuestionIds: ['work_email'], email: 'a@acme.com', website: 'acme.com' };
  const q = Q.selectQuestion(st, tie, DATA);
  assert.ok(q && q.id === 'ai_visibility_focus', 'the AI-visibility question is asked, not the size: ' + (q && q.id));
  /* a clear winner is not a tie */
  const clear = R.recommend({ intents: [{ id: 'ai_citations', explicit: true }] }, DATA);
  assert.equal(Q.siblingTie(clear, DATA), null);
  /* and the sibling question lists both products as what it separates */
  V.siblingPairs.forEach(([a, b]) => {
    const has = DATA.questions.discovery.questions.some(x => (x.separates || []).indexOf(a) !== -1 && (x.separates || []).indexOf(b) !== -1);
    assert.ok(has, 'no question separates ' + a + ' / ' + b);
  });
});

test('the interpreter is shown the sheet\'s prompts as worked examples, filed under the intent that carries the product', async () => {
  const withEx = DATA.taxonomy.intents.filter(i => Array.isArray(i.examples) && i.examples.length);
  assert.ok(withEx.length >= 18, withEx.length + ' intents carry examples');
  const src = fs.readFileSync(path.join(ROOT, 'api', 'ask.js'), 'utf8');
  assert.ok(/i\.examples/.test(src) && /match by meaning/.test(src), 'ask.js quotes the examples');
  /* every example is a real sheet prompt, and lands on the product whose intent it is filed under */
  const prompts = new Set(G.map(r => r.prompt));
  withEx.forEach(i => i.examples.forEach(e => {
    assert.ok(prompts.has(e), i.id + ' example is not from the sheet: ' + e);
    const owners = R.activeProducts(DATA).filter(p => ((p.intentTags || {}).primary || []).indexOf(i.id) !== -1).map(p => p.id);
    const row = G.find(r => r.prompt === e);
    assert.ok(owners.indexOf(row.product) !== -1 || (row.accept || []).some(id => owners.indexOf(id) !== -1), i.id + ' carries "' + e + '" but ' + row.product + ' does not own it');
  }));
});
