/* ═══════════════════════════════════════════════════════════════════════════
   FIND YOUR SOLUTION — the slide-8 concierge: lead with solutions, not
   products. A scripted router, not a model: need → business size → role →
   recommendation. Deterministic on purpose — a front door should give the
   same directions twice.

   ┌─────────────────────── PLACEHOLDER BLOCK ────────────────────────┐
   │ REAL as of Aug 25, 2026 — the product names, the solution copy   │
   │ and every destination URL below come from Stagwell's product     │
   │ sheet. Those are no longer stand-ins.                            │
   │                                                                   │
   │ STILL PLACEHOLDER — the ICP axis: the three business sizes, the  │
   │ role list, and which tier is shown which product first. That is  │
   │ our guess until the ICP definitions land, and it is the only     │
   │ thing in this block still awaiting the client.                   │
   └───────────────────────────────────────────────────────────────────┘ */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* the four questions from the direction deck, verbatim */
const OPENERS = [
  { need: 'brand-health', label: 'How can I track my brand’s health?' },
  { need: 'influencer',   label: 'I need influencer marketing' },
  { need: 'ai-visibility', label: 'How do AI models describe my brand?' },
  { need: 'survey',       label: 'I want to run a quick survey' },
];

/* free text lands on a need via keywords; no match asks the visitor to pick.
   matchNeed takes the LONGEST matching keyword, so a compound phrase always
   beats the generic word it contains ('audience measurement' > 'audience'). */
const NEEDS = {
  'brand-health': { kws: ['brand health', 'health', 'tracking', 'track', 'equity', 'perception', 'awareness',
      'brand tracking', 'brand equity', 'benchmarking', 'brand roi', 'brand investment'],
    ack: 'Brand health — knowing how the brand is really doing, continuously.' },
  'influencer': { kws: ['influencer', 'creator', 'creators', 'ugc creator', 'talent',
      'creator discovery', 'campaign management'],
    ack: 'Influencer marketing — finding the right creators and running them well.' },
  'ai-visibility': { kws: ['ai model', 'ai answers', 'chatgpt', 'llm', 'gemini', 'describe my brand', 'geo', 'ai search',
      'answer engine', 'ai visibility', 'ai search platforms', 'prompt optimization', 'ai recommendations'],
    ack: 'AI visibility — how the answer engines describe you, and being the answer they give.' },
  'survey': { kws: ['survey', 'poll', 'questionnaire', 'ask the market', 'consumer research',
      'survey automation', 'consumer feedback', 'global research'],
    ack: 'Research on demand — asking the market and getting an answer today.' },
  'compintel': { kws: ['competitor', 'competitors', 'rival', 'competitive intel', 'undercutting', 'market share',
      'losing share', 'competitive', 'competitive benchmarking'],
    ack: 'Competitive intelligence — what rivals are doing, as it happens.' },
  'creative': { kws: ['video ads', 'creative', 'ugc ads', 'ad creative', 'content at scale', 'video ad'],
    ack: 'Creative at scale — publish-ready video from a brief, in minutes.' },
  'voice': { kws: ['voice', 'calls', 'call center', 'phones', 'inbound', 'customer calls'],
    ack: 'Voice — AI agents that talk to your customers and act on their behalf.' },
  'media': { kws: ['audience', 'audiences', 'media buying', 'targeting', 'dsp', 'activation',
      'audience activation', 'audience discovery', 'behavioral signals', 'id graph'],
    ack: 'Media — building custom audiences and pushing them straight to your DSP.' },
  'sampling': { kws: ['sample', 'sampling', 'respondent', 'respondents', 'panel', 'participants', 'recruit',
      'b2b respondents', 'survey respondents', 'audience sampling', 'data quality'],
    ack: 'Sampling — verified people to answer the questions, and data you can trust.' },
  'reputation': { kws: ['reputation', 'crisis', 'pr risk', 'narrative', 'stakeholder', 'sentiment',
      'media coverage', 'press coverage', 'news monitoring', 'signal detection', 'public perception'],
    ack: 'Reputation — what stakeholders are saying, and the risks moving before they land.' },
  'measurement': { kws: ['foot traffic', 'footfall', 'visitation', 'store visits', 'location intelligence',
      'ad impact', 'audience measurement', 'movement data', 'movement patterns'],
    ack: 'Measurement — who you actually reached, and what they did next.' },
};

/* who it's for — the deck's tiering axis, our placeholder ICP */
const SIZES = [
  { key: 'ent', label: 'Enterprise brand' },
  { key: 'mid', label: 'Mid-market team' },
  { key: 'smb', label: 'Small business' },
];
const ROLES = ['CMO / brand lead', 'Insights & research', 'Comms / PR', 'Growth & media', 'Founder-operator'];

/* need × size → the recommendation. family names follow the architecture
   slide: The Machines (enterprise), Point Solutions, SMB Platform.
   url:  the real product destination (client sheet, Aug 25 2026) — opens out.
   demo: where our own prototypes already show the shape of the thing working.
   Recs with no url are in-house prototypes only (creative, voice). */
const SOLUTIONS = {
  'brand-health': {
    ent: { family: 'Point Solutions', name: 'BERA.ai', line: 'Brand ROI measurement — connect brand investment to business outcomes.', url: 'https://bera.ai', demo: '/catalogue' },
    mid: { family: 'Point Solutions', name: 'QuestBrand', line: 'Monitor brand health, equity and perception daily.', url: 'https://www.harrisquest.com/suite/questbrand', demo: '/catalogue' },
    smb: { family: 'SMB Platform', name: 'QuestBrand', line: 'Daily brand tracking, self-serve — health, equity and perception without a research team.', url: 'https://www.harrisquest.com/suite/questbrand', demo: '/catalogue' },
  },
  'influencer': {
    ent: { family: 'Point Solutions', name: 'IMAI', line: 'Find creators aligned to your audiences and goals, then manage campaigns from outreach through reporting.', url: 'https://www.themarketingcloud.com/marketplace/imai', demo: '/agent' },
    mid: { family: 'Point Solutions', name: 'IMAI', line: 'Creator discovery and campaign management in one place — outreach through reporting.', url: 'https://www.themarketingcloud.com/marketplace/imai', demo: '/agent' },
    smb: { family: 'SMB Platform', name: 'IMAI', line: 'Find creators aligned to your audience and run the campaign yourself, end to end.', url: 'https://www.themarketingcloud.com/marketplace/imai', demo: '/agent' },
  },
  'ai-visibility': {
    ent: { family: 'Point Solutions', name: 'GEOPulse', line: 'Track brand visibility across AI search platforms — and improve AI recommendations through prompt-based insights.', url: 'https://www.themarketingcloud.com/marketplace/geopulse', demo: '/' },
    mid: { family: 'Point Solutions', name: 'GEOPulse', line: 'Track brand visibility across AI search platforms, day by day.', url: 'https://www.themarketingcloud.com/marketplace/geopulse', demo: '/' },
    smb: { family: 'SMB Platform', name: 'GEOPulse', line: 'See how visible your business is across AI search platforms — self-serve.', url: 'https://www.themarketingcloud.com/marketplace/geopulse', demo: '/' },
  },
  'survey': {
    ent: { family: 'Point Solutions', name: 'QuestDIY', line: 'Global research — gather consumer feedback across 100+ countries.', url: 'https://www.harrisquest.com/suite/questdiy', demo: '/catalogue' },
    mid: { family: 'Point Solutions', name: 'QuestDIY', line: 'Create and launch surveys with AI assistance — and field them across 100+ countries.', url: 'https://www.harrisquest.com/suite/questdiy', demo: '/catalogue' },
    smb: { family: 'SMB Platform', name: 'QuestDIY', line: 'Create and launch surveys with AI assistance — self-serve, no research team required.', url: 'https://www.harrisquest.com/suite/questdiy', demo: '/catalogue' },
  },
  'compintel': {
    ent: { family: 'The Machines', name: 'The Knowledge Machine', line: 'Signal detection — surface emerging risks before issues gain momentum.', url: 'https://www.themarketingcloud.com/marketplace/pulse', demo: '/' },
    mid: { family: 'Point Solutions', name: 'UNICEPTA', line: 'Monitor global news, social and media coverage on the rivals you name.', url: 'https://www.themarketingcloud.com/marketplace/unicepta', demo: '/' },
    smb: { family: 'SMB Platform', name: 'QuestBrand', line: 'Compare performance against competitors across key metrics — self-serve.', url: 'https://www.harrisquest.com/suite/questbrand', demo: '/catalogue' },
  },
  'sampling': {
    ent: { family: 'Point Solutions', name: 'Unlock', line: 'Access verified consumers and professionals for research, at enterprise scale.', url: 'https://www.themarketingcloud.com/marketplace/unlock', demo: '/catalogue' },
    mid: { family: 'Point Solutions', name: 'Unlock', line: 'Verified consumers and professionals for research — with trusted participant sourcing.', url: 'https://www.themarketingcloud.com/marketplace/unlock', demo: '/catalogue' },
    smb: { family: 'SMB Platform', name: 'Unlock', line: 'Improve data quality with trusted participant sourcing — self-serve.', url: 'https://www.themarketingcloud.com/marketplace/unlock', demo: '/catalogue' },
  },
  'reputation': {
    ent: { family: 'The Machines', name: 'The Knowledge Machine', line: 'Surface emerging risks before issues gain momentum — and understand the stakeholder sentiment driving them.', url: 'https://www.themarketingcloud.com/marketplace/pulse', demo: '/' },
    mid: { family: 'Point Solutions', name: 'UNICEPTA', line: 'Monitor global news, social and media coverage — and analyze the conversations shaping public perception.', url: 'https://www.themarketingcloud.com/marketplace/unicepta', demo: '/' },
    smb: { family: 'SMB Platform', name: 'UNICEPTA', line: 'Media monitoring across news and social — see the coverage shaping how you’re perceived.', url: 'https://www.themarketingcloud.com/marketplace/unicepta', demo: '/' },
  },
  'measurement': {
    ent: { family: 'Point Solutions', name: 'Numetrix', line: 'Measure audience reach, quality and exposure — with location intelligence behind the numbers.', url: 'https://www.themarketingcloud.com/marketplace/numetrix', demo: '/platform' },
    mid: { family: 'Point Solutions', name: 'Numetrix', line: 'Measure audience reach, quality and exposure, and analyze visitation and movement patterns.', url: 'https://www.themarketingcloud.com/marketplace/numetrix', demo: '/platform' },
    smb: { family: 'SMB Platform', name: 'Numetrix', line: 'Who came, and from where — visitation and consumer movement patterns, self-serve.', url: 'https://www.themarketingcloud.com/marketplace/numetrix', demo: '/platform' },
  },
  'creative': {
    ent: { family: 'Point Solutions', name: 'DoReel', line: 'Presenter video and UGC from a brief, in minutes — with expert support.', demo: '/agent' },
    mid: { family: 'Point Solutions', name: 'DoReel', line: 'Creative at the speed of the insight — from brief to finished cut.', demo: '/agent' },
    smb: { family: 'SMB Platform', name: 'UGC (DoReel)', line: 'AI UGC ads, one per creator, ready to publish — self-serve.', demo: '/agent' },
  },
  'voice': {
    ent: { family: 'Point Solutions', name: 'NewVoices', line: 'Enterprise-grade voice agents that talk to your customers and act on their behalf.', demo: '/agent' },
    mid: { family: 'Point Solutions', name: 'NewVoices', line: 'Voice agents that hold a real conversation — briefed on your campaign.', demo: '/agent' },
    smb: { family: 'SMB Platform', name: 'NewVoices', line: 'A voice agent on your number, answering and booking 24/7.', demo: '/agent' },
  },
  'media': {
    ent: { family: 'The Machines', name: 'The Targeting Machine', line: 'Identify high-value audiences using behavioral signals, then activate them across digital and media channels.', url: 'https://www.themarketingcloud.com/marketplace/sats', demo: '/platform' },
    mid: { family: 'Point Solutions', name: 'The Targeting Machine', line: 'Audience discovery from behavioral signals — activated across the channels you already buy.', url: 'https://www.themarketingcloud.com/marketplace/sats', demo: '/platform' },
    smb: { family: 'SMB Platform', name: 'The Targeting Machine', line: 'Find high-value audiences and reach them across digital and media channels.', url: 'https://www.themarketingcloud.com/marketplace/sats', demo: '/platform' },
  },
};

/* every conversation also offers the portfolio door */
const PORTFOLIO_REC = { family: 'Stagwell.AI', name: 'See the portfolio in action',
  line: 'One link in, a live dashboard out — the main page builds yours in about a minute.', demo: '/' };
/* ── END PLACEHOLDER ─────────────────────────────────────────── */

const thread = $('#thread'), form = $('#askForm'), input = $('#askInput');
const chips = $('#chips'), resetBtn = $('#resetBtn');

const S = { step: 'need', need: null, size: null, busy: false };

const wait = ms => new Promise(r => setTimeout(r, REDUCED ? Math.min(ms, 60) : ms));

function addYou(text) {
  thread.hidden = false;
  thread.insertAdjacentHTML('beforeend',
    `<div class="smsg smsg--you"><p class="smsg__t">${esc(text)}</p></div>`);
}

async function say(html) {
  thread.hidden = false;
  const el = document.createElement('div');
  el.className = 'smsg';
  el.innerHTML = `<span class="smsg__who">Stagwell.AI</span>
    <span class="sdots"><i></i><i></i><i></i></span>`;
  thread.appendChild(el);
  el.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  await wait(650);
  el.querySelector('.sdots').outerHTML = `<div class="smsg__t">${html}</div>`;
}

function setChips(list, onPick) {
  chips.innerHTML = '';
  list.forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'schip' + (item.go ? ' schip--go' : '');
    b.textContent = item.label;
    b.addEventListener('click', () => onPick(item));
    chips.appendChild(b);
  });
}

function matchNeed(text) {
  const s = text.toLowerCase();
  let best = null, bestLen = 0;
  for (const [key, n] of Object.entries(NEEDS)) {
    for (const kw of n.kws) {
      if (s.includes(kw) && kw.length > bestLen) { best = key; bestLen = kw.length; }
    }
  }
  return best;
}

/* the card is a div, not an anchor: with a real destination AND a prototype
   preview there are two links, and anchors don't nest. */
const ARROW_IN = `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW_OUT = `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M5.5 10.5L10.5 5.5M6 5.5h4.5V10" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function recHTML(rec, primary) {
  const preview = `<a class="rec__act rec__act--quiet" href="${esc(rec.demo)}">Preview in the prototype${ARROW_IN}</a>`;
  const acts = rec.url
    ? `<a class="rec__act rec__act--go" href="${esc(rec.url)}" target="_blank" rel="noopener">Visit ${esc(rec.name)}${ARROW_OUT}</a>${preview}`
    : `<a class="rec__act" href="${esc(rec.demo)}">Preview in the prototype${ARROW_IN}</a>`;
  return `<div class="rec${primary ? ' rec--primary' : ''}">
    <span class="rec__k">${primary ? '<b>Recommended</b> · ' : ''}${esc(rec.family)}</span>
    <span class="rec__name">${esc(rec.name)}</span>
    <p class="rec__line">${esc(rec.line)}</p>
    <div class="rec__acts">${acts}</div>
  </div>`;
}

/* ── the exchange ── */

function openerChips() {
  setChips(OPENERS.map(o => ({ label: o.label, need: o.need })), pick => {
    addYou(pick.label);
    onNeed(pick.need);
  });
}

async function onNeed(need) {
  if (S.busy) return;
  S.busy = true;
  S.need = need;
  S.step = 'size';
  chips.innerHTML = '';
  await say(`${esc(NEEDS[need].ack)} One question so I point you right: <em>who is this for?</em>`);
  setChips(SIZES.map(z => ({ label: z.label, key: z.key })), pick => {
    addYou(pick.label);
    onSize(pick.key);
  });
  input.placeholder = 'Or tell me about the team…';
  S.busy = false;
}

async function onSize(size) {
  if (S.busy) return;
  S.busy = true;
  S.size = size;
  S.step = 'role';
  chips.innerHTML = '';
  await say('And what’s your seat? It changes what I’d show first.');
  setChips(ROLES.map(r => ({ label: r })), pick => {
    addYou(pick.label);
    onRole(pick.label);
  });
  input.placeholder = 'Or type your role…';
  S.busy = false;
}

async function onRole(role) {
  if (S.busy) return;
  S.busy = true;
  S.step = 'done';
  chips.innerHTML = '';
  const rec = SOLUTIONS[S.need][S.size];
  const sizeLabel = SIZES.find(z => z.key === S.size).label.toLowerCase();
  await say(`Here’s where I’d start for a ${esc(sizeLabel)} — and it’s built to stand alone or work with everything else in the portfolio.`);
  thread.insertAdjacentHTML('beforeend',
    `<div class="recs">${recHTML(rec, true)}${recHTML(PORTFOLIO_REC, false)}</div>`);
  thread.lastElementChild.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  setChips([{ label: 'Talk to an AI expert', go: true, href: '/#cta' },
            { label: 'Ask something else' }], pick => {
    if (pick.href) { location.href = pick.href; return; }
    resetAll();
  });
  resetBtn.hidden = false;
  input.placeholder = 'Describe another problem…';
  S.busy = false;
}

function resetAll() {
  S.step = 'need'; S.need = null; S.size = null; S.busy = false;
  thread.innerHTML = '';
  thread.hidden = true;
  resetBtn.hidden = true;
  input.value = '';
  input.placeholder = 'Describe the problem in your own words';
  openerChips();
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || S.busy) return;
  input.value = '';

  if (S.step === 'need' || S.step === 'done') {
    if (S.step === 'done') { thread.innerHTML = ''; resetBtn.hidden = true; S.step = 'need'; }
    addYou(text);
    const need = matchNeed(text);
    if (need) { onNeed(need); return; }
    S.busy = true;
    await say('I want to route you right, and I didn’t catch the problem in that. Pick the closest below — or try again in different words.');
    openerChips();
    S.busy = false;
    return;
  }
  if (S.step === 'size') {
    addYou(text);
    const s = text.toLowerCase();
    const key = /enterprise|global|fortune/.test(s) ? 'ent'
      : /small|smb|local|shop|solo/.test(s) ? 'smb' : 'mid';
    onSize(key);
    return;
  }
  if (S.step === 'role') {
    addYou(text);
    onRole(text);
  }
});

resetBtn.addEventListener('click', resetAll);

openerChips();

/* ── arriving with the question already asked ──────────────────
   The home fold hands over here: ?need=<key> is one of the four chips
   chosen there, ?q=<text> is whatever was typed. Either way the words
   appear as the visitor's own turn and the exchange continues. */
const params = new URLSearchParams(location.search);
const pNeed = params.get('need');
const pQ = (params.get('q') || '').trim();
if (pNeed && NEEDS[pNeed]) {
  const opener = OPENERS.find(o => o.need === pNeed);
  addYou(opener ? opener.label : NEEDS[pNeed].ack);
  onNeed(pNeed);
} else if (pQ) {
  addYou(pQ);
  const need = matchNeed(pQ);
  if (need) onNeed(need);
  else say('I want to route you right, and I didn’t catch the problem in that. Pick the closest below — or try again in different words.');
}

})();
