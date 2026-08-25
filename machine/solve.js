/* ═══════════════════════════════════════════════════════════════════════════
   FIND YOUR SOLUTION — the slide-8 concierge: lead with solutions, not
   products. A scripted router, not a model: need → business size → role →
   recommendation. Deterministic on purpose — a front door should give the
   same directions twice.

   ┌─────────────────────── PLACEHOLDER BLOCK ────────────────────────┐
   │ Everything between here and END PLACEHOLDER is standing in for   │
   │ Stagwell's ICPs, value props and destinations. When the content  │
   │ map arrives, this block is the only thing that changes.          │
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

/* free text lands on a need via keywords; no match asks the visitor to pick */
const NEEDS = {
  'brand-health': { kws: ['brand health', 'health', 'tracking', 'track', 'equity', 'perception', 'awareness'],
    ack: 'Brand health — knowing how the brand is really doing, continuously.' },
  'influencer': { kws: ['influencer', 'creator', 'creators', 'ugc creator', 'talent'],
    ack: 'Influencer marketing — finding the right creators and running them well.' },
  'ai-visibility': { kws: ['ai model', 'ai answers', 'chatgpt', 'llm', 'gemini', 'describe my brand', 'geo', 'ai search', 'answer engine', 'ai visibility'],
    ack: 'AI visibility — how the answer engines describe you, and being the answer they give.' },
  'survey': { kws: ['survey', 'poll', 'questionnaire', 'ask the market', 'consumer research'],
    ack: 'Research on demand — asking the market and getting an answer today.' },
  'compintel': { kws: ['competitor', 'competitors', 'rival', 'competitive intel', 'undercutting', 'market share', 'losing share'],
    ack: 'Competitive intelligence — what rivals are doing, as it happens.' },
  'creative': { kws: ['video ads', 'creative', 'ugc ads', 'ad creative', 'content at scale', 'video ad'],
    ack: 'Creative at scale — publish-ready video from a brief, in minutes.' },
  'voice': { kws: ['voice', 'calls', 'call center', 'phones', 'inbound', 'customer calls'],
    ack: 'Voice — AI agents that talk to your customers and act on their behalf.' },
  'media': { kws: ['audience', 'audiences', 'media buying', 'targeting', 'dsp', 'activation'],
    ack: 'Media — building custom audiences and pushing them straight to your DSP.' },
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
   demo: where our prototypes already show the thing working. */
const SOLUTIONS = {
  'brand-health': {
    ent: { family: 'Point Solutions', name: 'BERA.ai', line: 'Brand equity, priced in dollars — always-on tracking your CFO can read.', demo: '/catalogue' },
    mid: { family: 'Point Solutions', name: 'HarrisQuest', line: 'Brand tracking with The Harris Poll’s rigor, at product speed.', demo: '/catalogue' },
    smb: { family: 'SMB Platform', name: 'Surveys (Quest DIY)', line: 'Self-serve brand pulse — field a check today, read it tomorrow.', demo: '/catalogue' },
  },
  'influencer': {
    ent: { family: 'Point Solutions', name: 'IMAI', line: '400M creator profiles with expert support — shortlists with cleared rights.', demo: '/agent' },
    mid: { family: 'Point Solutions', name: 'IMAI', line: '400M creator profiles, vetted and searchable — run campaigns end to end.', demo: '/agent' },
    smb: { family: 'SMB Platform', name: 'Influencer (IMAI)', line: 'The same creator intelligence, self-serve — no enterprise integration needed.', demo: '/agent' },
  },
  'ai-visibility': {
    ent: { family: 'Point Solutions', name: 'NewIndex + GEOPulse', line: 'How AI answers rank you, tracked daily — and the moves that change it.', demo: '/' },
    mid: { family: 'Point Solutions', name: 'NewIndex', line: 'How AI answers describe you, tracked daily against the rivals you name.', demo: '/' },
    smb: { family: 'SMB Platform', name: 'LLM Visibility (NewIndex)', line: 'See how ChatGPT and Gemini describe your business — self-serve.', demo: '/' },
  },
  'survey': {
    ent: { family: 'Point Solutions', name: 'HarrisQuest', line: 'Ask the market, get an answer today — fielded with The Harris Poll.', demo: '/catalogue' },
    mid: { family: 'Point Solutions', name: 'HarrisQuest', line: 'Ask the market, get an answer today — surveys at product speed.', demo: '/catalogue' },
    smb: { family: 'SMB Platform', name: 'Surveys (Quest DIY)', line: 'Write a survey in plain language, field it today, read it tomorrow.', demo: '/catalogue' },
  },
  'compintel': {
    ent: { family: 'The Machines', name: 'The Knowledge Machine', line: 'Competitor pricing, hiring and coverage — watched around the clock, briefed daily.', demo: '/' },
    mid: { family: 'Point Solutions', name: 'UNICEPTA', line: 'Global media intelligence on the rivals you name, as it happens.', demo: '/' },
    smb: { family: 'SMB Platform', name: 'Competitive Intel (NewIntel)', line: 'What your competitors did this week — self-serve, no analysts required.', demo: '/' },
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
    ent: { family: 'The Machines', name: 'The Media Machine', line: 'Custom audiences from proprietary data, activated across your stack.', demo: '/platform' },
    mid: { family: 'Point Solutions', name: 'SATS + Activate', line: 'Build custom audiences and push them straight to your DSP.', demo: '/platform' },
    smb: { family: 'SMB Platform', name: 'Activate', line: 'Audiences from your own data, pushed to the platforms you already buy on.', demo: '/platform' },
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

function recHTML(rec, primary) {
  return `<a class="rec${primary ? ' rec--primary' : ''}" href="${esc(rec.demo)}">
    <span class="rec__k">${primary ? '<b>Recommended</b> · ' : ''}${esc(rec.family)}</span>
    <span class="rec__name">${esc(rec.name)}</span>
    <p class="rec__line">${esc(rec.line)}</p>
    <span class="rec__act">Preview in the prototype
      <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </span></a>`;
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
