/* ═══════════════════════════════════════════════════════════════════════════
   ROUTING — brief §49A: the seven named scenarios, one per goal pill, and the
   key routing rules of §12, all through the deterministic path (no model).
   Run: node --test tests/kimi/
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, R, Q, ROOT, readText, walk } from './_data.mjs';

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
    /* the Product Package Checklist's CORE KNOWLEDGE, 2026-09-17: every product
       carries its own short brand line, and the page builder puts it on screen
       as the headline rather than splitting `positioning` with a regex */
    assert.ok(p.tagline && p.tagline.length > 8, p.id + ' has no tagline');
    assert.ok(!/^\s|\s$/.test(p.tagline), p.id + ' tagline has loose whitespace');
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
  assert.equal(r.signals.companySize, 'large');
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
  /* media: the two monitoring products tie; the scope question is no longer
     asked (the client's order stops at the role), so the first by the goal's
     own order leads and the other rides as secondary — and a known global
     footprint still tips it to Unicepta */
  const media = walk('competition', ['media', 'mid']).reco;
  assert.equal(top(media), 'knowledge_machine');
  assert.ok(media.secondary.includes('unicepta'), 'Unicepta rides as secondary: ' + media.secondary.join(','));
  assert.equal(R.recommend({ goal: 'competition', intents: [{ id: 'competitive_media', explicit: true }], geographicScope: 'global' }, DATA).primary, 'unicepta');
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
  assert.equal(top(walk('operations', ['ops', 'os', 'large']).reco), 'machines_family');
  assert.equal(top(walk('operations', ['orchestration', 'shape', 'large']).reco), 'search_plus');
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
  assert.equal(top(walk('brand_awareness', ['creators', 'under_100', 'small']).reco), 'smb_platform');
  assert.equal(top(walk('brand_awareness', ['creators', '100_plus', 'large']).reco), 'imai');
});
test('creators: small + under 100 → SMB; 100+ → IMAI; ambiguous → one primary and the other as secondary', () => {
  /* the creator-volume question is no longer asked once an intent is known
     (the client's order stops at the role); the band still decides when it is
     known — read from the sentence or the site */
  const creators = [{ id: 'creator_discovery', explicit: true }];
  assert.equal(R.recommend({ goal: 'audience_growth', intents: creators, creatorProgramSize: 'under_100', companySize: 'small' }, DATA).primary, 'smb_platform');
  assert.equal(R.recommend({ goal: 'audience_growth', intents: creators, creatorProgramSize: '100_plus', companySize: 'large' }, DATA).primary, 'imai');
  const unsure = R.recommend({ goal: 'audience_growth', intents: creators, creatorProgramSize: 'unknown', companySize: 'mid' }, DATA);
  assert.ok(['smb_platform', 'imai'].includes(unsure.primary));
  assert.ok(unsure.secondary.some(id => id === 'smb_platform' || id === 'imai'), 'the other creator product rides as secondary');
  const w = walk('audience_growth', ['creators', 'under_100', 'small']);
  assert.ok(!w.trail.some(t => t.id === 'creator_scale'), 'no creator-volume question after the opener: ' + w.trail.map(t => t.id).join(' → '));
});

/* confidence + every conversation ends */
test('every goal ends in a recommendation within the question budget, and the pill alone is not enough to be confident', () => {
  DATA.goals.goals.forEach(g => {
    const bare = R.recommend({ goal: g.id, intents: [] }, DATA);
    assert.equal(bare.confidence.level, 'low', g.id + ': a bare goal is low confidence');
    /* pick the first suggestion of every question the selector puts up (the
       work email and the website have none: the walk types an answer to them
       the way the flow does, and a work address carries the website with it) */
    const firsts = DATA.questions.discovery.questions.filter(q => q.suggestions.length).map(q => q.suggestions[0].id);
    const r = walk(g.id, firsts);
    assert.ok(r.reco.primary, g.id + ' ends on a primary');
    /* the order (2026-09-16): the work email — whose domain is the website —
       then size, then role, then at most maxQuestions discriminators */
    assert.ok(r.trail.length <= DATA.scoring.conversation.maxQuestions + 4, g.id + ' asked ' + r.trail.length);
    assert.deepEqual(r.trail.slice(0, 3).map(t => t.id), ['work_email', 'company_size', 'role'], g.id + ' opens in the client\'s order');
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
  const smbWithMany = R.recommend({ goal: 'audience_growth', intents: [{ id: 'creator_discovery', explicit: true }], creatorProgramSize: '100_plus', companySize: 'small' }, DATA);
  assert.equal(smbWithMany.primary, 'imai', 'a hundred-plus creator program goes to IMAI even at SMB size');
});

test('keyword reader: the brief\'s §18 examples', () => {
  const ids = t => R.keywordIntents(t, DATA).map(i => i.id);
  assert.ok(ids('we keep missing calls and phone leads').includes('customer_voice_ai'));
  assert.ok(ids('we work with tiktok creators').includes('creator_discovery'));
  assert.ok(ids('how do we show up in ChatGPT and Gemini answers').includes('ai_search_visibility'));
  assert.deepEqual(ids('hello there'), []);
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE FAST TRACK — "if the person just ever cuts the chase that they want to
   be contacted … we should just fast-track them to filling out the form"
   (client, 2026-09-10). The reader is deterministic, so it works with no model
   at all; these are the phrasings it must and must not catch.
   ═══════════════════════════════════════════════════════════════════════════ */
test('a request to be contacted is read, with the kind they asked for', () => {
  const req = t => R.contactRequest(t, DATA);
  assert.equal(req('can you call me'), 'call');
  assert.equal(req('call me back tomorrow'), 'call');
  assert.equal(req('how do i book a demo'), 'demo');
  assert.equal(req("I'd like a demo please"), 'demo');
  assert.equal(req('can I see a demo of the targeting machine'), 'demo');
  assert.equal(req('walk me through it'), 'demo');
  assert.equal(req('I want to try it out'), 'trial');
  assert.equal(req('is there a free trial'), 'trial');
  assert.equal(req('can I talk to someone'), 'expert');
  assert.equal(req('just get in touch'), 'expert');
  assert.equal(req('have someone reach out to me'), 'expert');
  assert.equal(req('how much does it cost'), 'pricing');
  assert.equal(req('can you send me a quote'), 'pricing');
});

test('ordinary marketing talk is never mistaken for a request to be contacted', () => {
  const req = t => R.contactRequest(t, DATA);
  ['we need to track competitors', 'prove our pricing power', 'our sign-up rates are dropping',
   'we ran a demo of our own product last week', 'we need competitor pricing signals this week',
   'measure brand awareness', 'our call center misses leads overnight', 'we want to grow our audience'
  ].forEach(t => assert.equal(req(t), null, t));
});

test('the longest phrase wins, so a specific ask beats a general one', () => {
  assert.equal(R.contactRequest('can you book a demo and call me', DATA), 'demo');
  assert.equal(R.contactRequest('we need competitor tracking — can you call me', DATA), 'call');
});

test('every contact request has copy for the form it opens', () => {
  const copy = DATA.kimi.copy.fastTrack;
  R.contactRequestIds(DATA).forEach(id => {
    const b = copy[id];
    assert.ok(b && b.message && b.title && b.submit && b.closed, 'missing fastTrack copy for ' + id);
    assert.ok(b.message.length > 30 && !/\{/.test(b.title), id);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   GEOPULSE vs SEARCH+ — two products on the same ground, told apart by what
   the visitor wants DONE about it. Client, 2026-09-10: "Stagwell Search+ helps
   brands influence how they are represented and recommended inside AI search
   tools like ChatGPT, Gemini, Perplexity, Grok, etc." GEOPulse measures how
   AI answers describe you; Search+ changes it.
   ═══════════════════════════════════════════════════════════════════════════ */
test('measuring AI answers is GEOPulse; changing them is Search+', () => {
  const top = t => readText(t).primary;
  ['is ChatGPT recommending us or our rivals', 'track how AI describes our brand',
   'what does ChatGPT say about our brand', 'how do competitors appear in AI answers'
  ].forEach(t => assert.equal(top(t), 'geopulse', t));
  ['we need answer engine optimisation', 'can you help me improve my ai search results',
   'how do we get recommended by AI', 'we want to rank in ChatGPT'
  ].forEach(t => assert.equal(top(t), 'search_plus', t));
});

test('a sentence carrying both sides keeps both products in the running — and both are shown, rather than another question asked', () => {
  const r = readText('we want to influence what AI says about us');
  assert.ok(r.candidates.includes('geopulse') && r.candidates.includes('search_plus'), r.candidates.join(','));
  const st = { primaryGoal: null, intents: R.keywordIntents('we want to influence what AI says about us', DATA),
    askedQuestionIds: ['work_email', 'website', 'company_size', 'role'], email: 'a@x.com', website: 'x.com', role: 'c_suite', companySize: 'large' };
  /* the client's order (2026-09-10): after the role, the recommendation */
  assert.equal(Q.selectQuestion(st, r, DATA), null);
  const shown = R.pointers(r, null, DATA).items.map(i => i.id).sort();
  assert.deepEqual(shown, ['geopulse', 'search_plus'], 'both are pointed at');
});

test('eclipse: an intent whose only evidence sits inside another intent\'s longer phrase is a fragment, not a second need', () => {
  /* "answer engine" is a keyword of the measuring intent and sits inside the
     influence intent's "answer engine optimisation" — one need, not two */
  const ids = R.keywordIntents('we need answer engine optimisation', DATA).map(i => i.id);
  assert.deepEqual(ids, ['ai_search_influence']);
  /* but a genuinely two-sided sentence still comes back as two */
  const both = R.keywordIntents('we want to influence what AI says about us', DATA).map(i => i.id).sort();
  assert.deepEqual(both, ['ai_search_influence', 'ai_search_visibility']);
});

test('every generated product page is headed by its catalog tagline, and says it only once', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const OWN = { targeting_machine: 'targeting-machine', newvoices: 'newvoices', machines_family: 'the-machine', agent_cloud: 'agent-cloud' };
  const esc = x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  R.activeProducts(DATA).forEach(p => {
    if (OWN[p.id]) return;                    /* the four hand-built landing pages carry their own headline */
    const file = path.join(ROOT, 'next', 's', p.id + '.html');
    const html = fs.readFileSync(file, 'utf8');
    const h1 = (html.match(/<h1 class="pp-title">([^<]*)<\/h1>/) || [])[1];
    assert.equal(h1, esc(p.tagline), p.id + ' headline');
    /* the line under the film does not repeat the headline */
    const about = (html.match(/<p class="pp-about__text[^"]*">([^<]*)<\/p>/) || [])[1] || '';
    assert.ok(!about.includes(esc(p.tagline)), p.id + ' repeats its headline in the body: ' + about.slice(0, 70));
  });
});

test('the Search+ entry says what the client says it says', () => {
  const p = R.productById('search_plus', DATA);
  assert.match(p.positioning, /influence how they are represented and recommended inside AI search tools/);
  assert.match(p.cardDescription, /ChatGPT, Gemini, Perplexity and Grok/);
  /* AI-search influence leads; brand orchestration stays a lead signal so the
     paid/owned/earned path still reaches it (the one-pager's claim, not
     retracted) */
  assert.equal(p.intentTags.primary[0], 'ai_search_influence');
  assert.ok(p.intentTags.primary.includes('brand_orchestration'));
  /* the line it replaced is kept, so nothing is lost */
  assert.match(p.sourceNote, /supersedes the Stagwell Search\+ ICP one-pager/);
  assert.ok(p.capabilityTags.every(t => t.length <= 40), 'card chips stay short: ' + p.capabilityTags.join(' | '));
});

/* ── way-finding (Amy, 2026-09-10: value before profiling; a way to the product page from the chat) ── */
test('way-finding: a real need points at the product page before any question is answered', () => {
  const r = readText('I want to create my own surveys');
  const p = R.pointers(r, null, DATA);
  assert.equal(p.kind, 'reco');
  assert.equal(p.items[0].id, 'questdiy');
  assert.equal(p.items[0].url, '/s/questdiy');
  assert.ok(p.items[0].line.length > 20, 'the catalog line comes with it');
  /* a +2 side-match (NewVoices "interviews customers at scale") is not a second
     place to send someone who asked for DIY surveys */
  assert.deepEqual(p.items.map(i => i.id), ['questdiy']);
});

test('way-finding: a goal alone offers its own shortlist, never a false recommendation', () => {
  const r = R.recommend({ goal: 'competition', intents: [] }, DATA);
  assert.ok(r.primary, 'the scorer still has a top candidate on a bare goal');
  const p = R.pointers(r, 'competition', DATA);
  assert.equal(p.kind, 'goal');
  assert.deepEqual(p.items.map(i => i.id), ['newintel', 'questbrand']);
  assert.ok(p.items.every(i => i.url && i.name && i.line), 'every item has a name, a line and a page');
});

test('way-finding: once the goal has an intent behind it the shortlist becomes the running', () => {
  const r = readText('what are our competitors doing this week', 'competition');
  const p = R.pointers(r, 'competition', DATA);
  assert.equal(p.kind, 'reco');
  assert.equal(p.items[0].id, 'newintel');
});

test('way-finding: nothing to go on, nothing pointed at', () => {
  const p = R.pointers(R.recommend({ goal: null, intents: [] }, DATA), null, DATA);
  assert.equal(p.kind, null);
  assert.deepEqual(p.items, []);
});

test('way-finding: every product it can name has a page to send people to', () => {
  for (const p of R.activeProducts(DATA)) {
    const url = (p.urls && p.urls.productPage) || null;
    assert.ok(url && url.startsWith('/'), p.id + ' has no productPage');
    assert.ok((p.cardDescription || p.positioning || '').length > 20, p.id + ' has no one-liner');
  }
});
