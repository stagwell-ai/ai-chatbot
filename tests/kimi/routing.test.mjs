/* ═══════════════════════════════════════════════════════════════════════════
   ROUTING — brief §49A: the seven named scenarios, one per goal pill, and the
   key routing rules of §12, all through the deterministic path (no model).
   Run: node --test tests/kimi/
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, R, readText, walk } from './_data.mjs';

const top = reco => reco.primary;

test('catalog: 17 active products, every one reachable from a goal, tags valid', () => {
  const active = R.activeProducts(DATA);
  assert.equal(active.length, 17);
  const intentIds = DATA.taxonomy.intents.map(i => i.id);
  const reachable = new Set();
  DATA.goals.goals.forEach(g => g.candidates.forEach(id => reachable.add(id)));
  active.forEach(p => {
    assert.ok(reachable.has(p.id), p.id + ' is in no goal candidate list');
    assert.ok(p.intentTags && p.intentTags.primary.length > 0, p.id + ' has no primary intents');
    [].concat(p.intentTags.primary, p.intentTags.secondary).forEach(t => assert.ok(intentIds.includes(t), p.id + ' tag ' + t + ' not in taxonomy'));
    assert.ok(p.cardDescription && p.conversion && p.conversion.primaryType && p.urls, p.id + ' missing card fields');
  });
  DATA.goals.goals.forEach(g => g.candidates.forEach(id => assert.ok(R.productById(id, DATA), g.id + ' names unknown product ' + id)));
});

/* §49A — the seven scenarios */
test('"Need to know if ChatGPT recommends us" → GEOPulse', () => {
  assert.equal(top(readText('Need to know if ChatGPT recommends us')), 'geopulse');
});
test('"Call center misses leads overnight" → NewVoices', () => {
  assert.equal(top(readText('Call center misses leads overnight')), 'newvoices');
});
test('"Want to prove brand spend drives revenue" → BERA.ai', () => {
  assert.equal(top(readText('Want to prove brand spend drives revenue')), 'bera');
});
test('"Small ecommerce brand, 30 TikTok creators" → Stagwell AI for SMBs', () => {
  const r = readText('Small ecommerce brand, 30 TikTok creators');
  assert.equal(top(r), 'smb_platform');
  assert.equal(r.signals.creatorProgramSize, 'under_100');
});
test('"Enterprise program with 500 creators" → IMAI', () => {
  const r = readText('Enterprise program with 500 creators');
  assert.equal(top(r), 'imai');
  assert.equal(r.signals.creatorProgramSize, '100_plus');
  assert.equal(r.signals.companySize, 'enterprise');
});
test('"Need competitor pricing and hiring signals this week" → NewIntel', () => {
  assert.equal(top(readText('Need competitor pricing and hiring signals this week')), 'newintel');
});
test('"Need awareness and consideration tracking" → QuestBrand', () => {
  assert.equal(top(readText('Need awareness and consideration tracking')), 'questbrand');
});

/* §12 — the key routing rules, through the pills */
test('competition: current activity → NewIntel; compare → QuestBrand; media → Knowledge Machine; AI → GEOPulse', () => {
  assert.equal(top(walk('competition', ['current_activity', 'mid']).reco), 'newintel');
  assert.equal(top(walk('competition', ['brand_compare', 'mid']).reco), 'questbrand');
  assert.equal(top(walk('competition', ['media', 'single', 'mid']).reco), 'knowledge_machine');
  assert.equal(top(walk('competition', ['media', 'global', 'mid']).reco), 'unicepta');
  assert.equal(top(walk('competition', ['ai', 'mid']).reco), 'geopulse');
});
test('brand impact: awareness → QuestBrand; revenue → BERA; behaviour → Numetrix; new research → QuestDIY', () => {
  assert.equal(top(walk('brand_impact', ['awareness', 'mid']).reco), 'questbrand');
  assert.equal(top(walk('brand_impact', ['revenue', 'mid']).reco), 'bera');
  assert.equal(top(walk('brand_impact', ['behavior', 'mid']).reco), 'numetrix');
  assert.equal(top(walk('brand_impact', ['research', 'diy', 'mid']).reco), 'questdiy');
});
test('audience: target → Targeting Machine; identity → ID Graph; media → Media Machine', () => {
  assert.equal(top(walk('audience_growth', ['targeting', 'activate', 'buying', 'mid']).reco), 'targeting_machine');
  assert.equal(top(walk('audience_growth', ['identity', 'mid']).reco), 'id_graph');
  assert.equal(top(walk('audience_growth', ['media', 'planning', 'mid']).reco), 'media_machine');
});
test('operations: conversations → NewVoices; AI access → Agent Cloud; unify ops → Machines; paid+owned+earned → Search+', () => {
  assert.equal(top(walk('operations', ['conversations', 'phone', 'mid']).reco), 'newvoices');
  assert.equal(top(walk('operations', ['ai_access', 'access', 'mid']).reco), 'agent_cloud');
  assert.equal(top(walk('operations', ['ops', 'os', 'ent']).reco), 'machines_family');
  assert.equal(top(walk('operations', ['orchestration', 'shape', 'ent']).reco), 'search_plus');
});
test('reputation: early warning → Knowledge Machine; global → UNICEPTA; AI answers → GEOPulse', () => {
  assert.equal(top(walk('reputation', ['early', 'single', 'mid']).reco), 'knowledge_machine');
  assert.equal(top(walk('reputation', ['monitor', 'global', 'mid']).reco), 'unicepta');
  assert.equal(top(walk('reputation', ['ai', 'mid']).reco), 'geopulse');
});
test('brand awareness: measure → QuestBrand; media → Media Machine; AI search → GEOPulse; creators → SMB / IMAI by scale', () => {
  assert.equal(top(walk('brand_awareness', ['measure', 'tracking', 'mid']).reco), 'questbrand');
  assert.equal(top(walk('brand_awareness', ['media', 'planning', 'mid']).reco), 'media_machine');
  assert.equal(top(walk('brand_awareness', ['ai_search', 'recommends', 'mid']).reco), 'geopulse');
  assert.equal(top(walk('brand_awareness', ['creators', 'under_100', 'smb']).reco), 'smb_platform');
  assert.equal(top(walk('brand_awareness', ['creators', '100_plus', 'ent']).reco), 'imai');
});
test('creators: small + under 100 → SMB; 100+ → IMAI; ambiguous → one primary and the other as secondary', () => {
  const small = walk('audience_growth', ['creators', 'under_100', 'smb']);
  assert.equal(top(small.reco), 'smb_platform');
  assert.ok(small.trail.some(t => t.id === 'creator_scale'), 'creator scale is asked when creator intent is present');
  const big = walk('audience_growth', ['creators', '100_plus', 'ent']);
  assert.equal(top(big.reco), 'imai');
  const unsure = walk('audience_growth', ['creators', 'unknown', 'mid']);
  assert.ok(['smb_platform', 'imai'].includes(top(unsure.reco)));
  assert.ok(unsure.reco.secondary.some(id => id === 'smb_platform' || id === 'imai'), 'the other creator product rides as secondary');
});

/* confidence + every conversation ends */
test('every goal ends in a recommendation within the question budget, and the pill alone is not enough to be confident', () => {
  DATA.goals.goals.forEach(g => {
    const bare = R.recommend({ goal: g.id, intents: [] }, DATA);
    assert.equal(bare.confidence.level, 'low', g.id + ': a bare goal is low confidence');
    /* pick the first suggestion of every question the selector puts up */
    const firsts = DATA.questions.discovery.questions.map(q => q.suggestions[0].id);
    const r = walk(g.id, firsts);
    assert.ok(r.reco.primary, g.id + ' ends on a primary');
    assert.ok(r.trail.length <= DATA.scoring.conversation.maxQuestions + 1, g.id + ' asked ' + r.trail.length);
    assert.ok(r.trail.some(t => t.id === 'company_size'), g.id + ' asked company size once');
  });
});

test('a recommendation always names an active product, never Unlock', () => {
  DATA.goals.goals.forEach(g => {
    g.candidates.forEach(() => {});
    const r = walk(g.id, ['current_activity', 'awareness', 'measure', 'targeting', 'early', 'conversations', 'phone', 'activate', 'buying', 'tracking', 'single', 'mid']);
    assert.ok(r.reco.primary, g.id + ' reached a primary');
    assert.notEqual(r.reco.primary, 'unlock');
    assert.ok(r.reco.confidence.level !== 'low' || r.trail.length >= 2, g.id + ': ended low after fewer than two questions');
  });
});

test('signals score explicit choices above read text, and contradictions push a product out', () => {
  const read = R.recommend({ goal: null, intents: [{ id: 'competitive_activity', explicit: false }] }, DATA);
  const chosen = R.recommend({ goal: null, intents: [{ id: 'competitive_activity', explicit: true }] }, DATA);
  assert.ok(chosen.ranked[0].score > read.ranked[0].score);
  const smbWithMany = R.recommend({ goal: 'audience_growth', intents: [{ id: 'creator_discovery', explicit: true }], creatorProgramSize: '100_plus', companySize: 'smb' }, DATA);
  assert.equal(smbWithMany.primary, 'imai', 'a hundred-plus creator program goes to IMAI even at SMB size');
});

test('keyword reader: the brief\'s §18 examples', () => {
  const ids = t => R.keywordIntents(t, DATA).map(i => i.id);
  assert.ok(ids('we keep missing calls and phone leads').includes('customer_voice_ai'));
  assert.ok(ids('we work with tiktok creators').includes('creator_discovery'));
  assert.ok(ids('how do we show up in ChatGPT and Gemini answers').includes('ai_search_visibility'));
  assert.deepEqual(ids('hello there'), []);
});
