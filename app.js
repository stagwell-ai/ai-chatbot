/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — THE MACHINE
   A scripted, high-fidelity prototype. No model is called: every path the
   visitor takes converges on the same designed journey.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

/* ─────────────────────────── REFERENCE DATA ─────────────────────────── */

/* Order and grouping mirror the Future of News page itself — 28 logos, 4 across. */
const PARTNERS = [
  ['ad-fontes','Ad Fontes Media'],['ap','Associated Press'],['axel-springer','Axel Springer'],['axios','Axios'],
  ['business-insider','Business Insider'],['bbc','BBC'],['cnn','CNN'],['ft','Financial Times'],
  ['free-press','The Free Press'],['guardian','The Guardian'],['usa-today','Gannett / USA Today'],['huffpost','HuffPost'],
  ['independent','The Independent'],['npr','NPR'],['news-corp','News Corp'],['newsweek','Newsweek'],
  ['ny-post','New York Post'],['nyt','The New York Times'],['ozone','Ozone'],['politico','Politico'],
  ['press-gazette','Press Gazette'],['rebooting','Rebooting'],['reuters','Reuters'],['trade-desk','The Trade Desk'],
  ['wsj','The Wall Street Journal'],['washington-post','The Washington Post'],['teads','Teads'],['1440','1440'],
];
const EXT = {ap:'png','axel-springer':'png',axios:'png',bbc:'png','business-insider':'png',huffpost:'png',
  independent:'png',npr:'png','ny-post':'png',politico:'png',rebooting:'png',teads:'png',wsj:'png',
  'washington-post':'jpg'};
const partnerSrc = k => `./assets/partners/${k}.${EXT[k] || 'webp'}`;

const STUDIES = [
  ['News Advertising Study — Germany','February 2026', true],
  ['Brand Safety APAC Study','October 2025', false],
  ['Brand Safety Canada Study','September 2025', false],
  ['Advertising Impact Study','June 2025', true],
  ['EMEA CEO &amp; Board Director Research','March 2025', false],
  ['Global CEO &amp; Board Director Research','January 2025', true],
  ['Post-Election Flash Poll','November 2024', false],
  ['News Advertising Study — United Kingdom','September 2024', false],
  ['News Advertising Study — United States','May 2024', false],
];

const INDUSTRIES = {
  'Consumer & Retail': { category:'consumer goods', segment:'Household decision-makers, 25–49, omnichannel',
    peers:['Unilever','Procter & Gamble','L’Oréal'],
    what:'branded consumer products sold through retail and direct channels',
    pos:'Scale and shelf presence, defended on brand equity',
    tone:'Warm, aspirational, benefit-led',
    trends:[
      ['Search is collapsing into recommendation','Shoppers are asking models to choose for them. Category entry points are being rewritten as prompts, and shelf position is now answer position.'],
      ['Creator equity outperforms paid reach','Owned creator relationships compound at roughly 3× the efficiency of equivalent paid social in tracked categories.'],
    ]},
  'Technology & Software': { category:'technology', segment:'Decision-makers, 30–54, high-intent',
    peers:['Microsoft','Salesforce','ServiceNow'],
    what:'software, platforms and technical services sold to businesses',
    pos:'Capability-led, competing on integration depth',
    tone:'Precise, technical, proof-driven',
    trends:[
      ['Procurement now starts inside an LLM','Six in ten shortlists are assembled from AI answers before a vendor site is opened. The brand a model names first wins the RFP it never saw.'],
      ['Third-party proof beats owned messaging','Models weight wire services and quality journalism far above owned content when characterising a company.'],
    ]},
  'Travel & Hospitality': { category:'travel', segment:'Frequent travellers, 28–58, high LTV',
    peers:['Booking.com','Marriott','Expedia'],
    what:'travel products and experiences booked direct and through partners',
    pos:'Experience-led, defended on loyalty economics',
    tone:'Inviting, service-forward, place-rich',
    trends:[
      ['Itineraries are being planned by agents','AI trip-planning assistants mediate a growing share of discovery. Inventory that is not machine-readable is invisible at the moment of choice.'],
      ['Loyalty is being unbundled','Members hold three or more programmes and optimise per trip — retention economics are shifting to experience proof.'],
    ]},
  'Financial Services': { category:'financial services', segment:'Affluent 30–55, mass-affluent switchers',
    peers:['JPMorgan Chase','American Express','Revolut'],
    what:'regulated financial products and advisory services',
    pos:'Trust-led, competing on service rather than rate',
    tone:'Measured, credential-heavy, risk-aware',
    trends:[
      ['Trust is being audited by machines','Models weight regulatory filings and quality journalism above owned content. Institutions with thin third-party coverage are systematically under-represented.'],
      ['Switching intent is spiking on service, not rate','Rate-led messaging is losing to service proof in every market surveyed this year.'],
    ]},
  'Media & Entertainment': { category:'media', segment:'Subscribers 18–44, high churn risk',
    peers:['Netflix','Spotify','Disney'],
    what:'content, distribution and subscription products',
    pos:'Catalogue-led, competing for attention share',
    tone:'Culturally fluent, fast-moving, talent-led',
    trends:[
      ['Discovery has moved to the answer layer','Recommendation is increasingly mediated by general-purpose models rather than platform algorithms.'],
      ['Attention is consolidating around fewer, bigger moments','Fragmented always-on calendars are underperforming concentrated cultural bets.'],
    ]},
  'Automotive & Mobility': { category:'automotive', segment:'In-market buyers, 30–60, 9-month cycle',
    peers:['Toyota','BMW','Rivian'],
    what:'vehicles, mobility services and connected software',
    pos:'Engineering-led, shifting to a software narrative',
    tone:'Confident, performance-led, increasingly technical',
    trends:[
      ['The consideration set forms before the dealership','Model-generated comparisons shape the three-brand shortlist. Absence from that list is unrecoverable downstream.'],
      ['Software narrative outranks powertrain narrative','Coverage of in-car software is growing faster than any other topic in the category.'],
    ]},
  'Healthcare & Pharma': { category:'healthcare', segment:'HCPs and informed patients, 35–64',
    peers:['Pfizer','Novartis','Roche'],
    what:'therapeutics, devices or care services',
    pos:'Evidence-led, competing on clinical credibility',
    tone:'Careful, cited, compliance-bounded',
    trends:[
      ['Patients arrive pre-briefed by a model','Consultations now start from an AI summary. The accuracy of that summary is a brand asset nobody currently owns.'],
      ['Scientific credibility is the only durable moat','Peer-reviewed and wire-service citations outweigh every owned channel.'],
    ]},
  'Marketing & Services': { category:'professional services', segment:'Enterprise buyers, 32–58, committee-led',
    peers:['WPP','Publicis','Accenture Song'],
    what:'marketing, media and communications services',
    pos:'Capability-breadth, sold on outcomes rather than craft',
    tone:'Assured, results-forward, case-led',
    trends:[
      ['Buyers audit you through a model before a call','The first pitch now happens without you in the room, assembled from whatever the model can find.'],
      ['Proof of outcome is displacing proof of craft','Case evidence with numbers is being cited by models; awards and manifestos are not.'],
    ]},
};
const DEFAULT_INDUSTRY = INDUSTRIES['Technology & Software'];

const NEWS_TREND = ['The news adjacency your competitors abandoned is cheap',
  'Stagwell’s research with HarrisX found ads adjacent to “not brand safe” stories performed on par with ads next to “brand safe” content — replicated across six markets. The avoidance is priced into the inventory.'];

/* Marquee brands the machine "already knows" — the demo lands hardest on these.
   Anything else falls through to a discovered-but-unconfirmed profile. */
const KNOWN = {
  'ldrsgroup.com': { name:'LDRS Group', legal:'LDRS Group', ind:'Marketing & Services',
                   what:'Digital marketing, influencer marketing, media and AI-driven services',
                   hq:'Tel Aviv, Israel', founded:'2015', people:'~120', markets:'EMEA and North America',
                   pos:'Integrated challenger; AI-native delivery across earned, owned and creator',
                   audience:'CMOs and heads of growth at scaling and enterprise brands',
                   tone:'Direct, practitioner-led, outcome-first',
                   peers:['Wpromote','Jellyfish','Brainlabs'], pages:21 },
  'nike.com':    { name:'Nike', legal:'Nike, Inc.', ind:'Consumer & Retail', what:'Athletic footwear, apparel and sport technology',
                   hq:'Beaverton, Oregon', founded:'1964', people:'~79,000', markets:'190+ countries',
                   pos:'Category leader; premium performance defended by athlete culture',
                   audience:'Active 16–40, sport-led, urban and suburban',
                   tone:'Declarative, athlete-first, motivational imperative',
                   peers:['Adidas','On Running','Lululemon'], pages:47 },
  'apple.com':   { name:'Apple', legal:'Apple Inc.', ind:'Technology & Software', what:'Consumer hardware, software and services',
                   hq:'Cupertino, California', founded:'1976', people:'~164,000', markets:'175+ countries',
                   pos:'Premium integrated ecosystem; margin defended by design and silicon',
                   audience:'Affluent 22–55, high device loyalty',
                   tone:'Spare, product-led, understated superlatives',
                   peers:['Samsung','Google','Microsoft'], pages:63 },
  'airbnb.com':  { name:'Airbnb', legal:'Airbnb, Inc.', ind:'Travel & Hospitality', what:'Marketplace for stays and experiences',
                   hq:'San Francisco, California', founded:'2008', people:'~7,300', markets:'220+ countries and regions',
                   pos:'Supply-side network effect; belonging as the brand idea',
                   audience:'Experience-led travellers 25–50, group bookers',
                   tone:'Human, first-person, host-and-guest framing',
                   peers:['Booking.com','Vrbo','Marriott'], pages:38 },
  'openai.com':  { name:'OpenAI', legal:'OpenAI', ind:'Technology & Software', what:'Frontier AI research and products',
                   hq:'San Francisco, California', founded:'2015', people:'~3,000', markets:'Global',
                   pos:'Frontier capability leader; distribution through consumer surface area',
                   audience:'Developers, enterprises and mainstream consumers',
                   tone:'Plain, careful, capability-and-safety balanced',
                   peers:['Anthropic','Google DeepMind','Mistral'], pages:29 },
  'tesla.com':   { name:'Tesla', legal:'Tesla, Inc.', ind:'Automotive & Mobility', what:'Electric vehicles, energy storage and solar',
                   hq:'Austin, Texas', founded:'2003', people:'~140,000', markets:'40+ countries',
                   pos:'Vertically integrated challenger; software as the product story',
                   audience:'Early-adopter buyers 28–55, high income',
                   tone:'Direct, technical, zero-advertising posture',
                   peers:['BYD','Rivian','Volkswagen'], pages:41 },
  'spotify.com': { name:'Spotify', legal:'Spotify AB', ind:'Media & Entertainment', what:'Audio streaming and podcasting',
                   hq:'Stockholm, Sweden', founded:'2006', people:'~7,400', markets:'180+ markets',
                   pos:'Discovery and personalisation as the moat; two-sided creator market',
                   audience:'Streaming natives 16–44, playlist-led',
                   tone:'Playful, data-personal, culturally current',
                   peers:['Apple Music','YouTube Music','Amazon Music'], pages:34 },
  'delta.com':   { name:'Delta', legal:'Delta Air Lines, Inc.', ind:'Travel & Hospitality', what:'Global passenger and cargo aviation',
                   hq:'Atlanta, Georgia', founded:'1925', people:'~100,000', markets:'275+ destinations',
                   pos:'Premium operational reliability; loyalty economics as the engine',
                   audience:'Business and premium leisure, high-frequency flyers',
                   tone:'Assured, service-forward, people-led',
                   peers:['United','American Airlines','Southwest'], pages:52 },
  'loreal.com':  { name:'L’Oréal', legal:'L’Oréal S.A.', ind:'Consumer & Retail', what:'Beauty, skincare and cosmetics',
                   hq:'Clichy, France', founded:'1909', people:'~90,000', markets:'150 countries',
                   pos:'House of brands with science-backed efficacy claims',
                   audience:'Beauty consumers 18–60 across mass and prestige',
                   tone:'Confident, efficacy-led, worth-it framing',
                   peers:['Estée Lauder','Unilever','Shiseido'], pages:44 },
  'stagwellglobal.com': { name:'Stagwell', legal:'Stagwell Inc.', ind:'Marketing & Services', what:'Marketing, communications and marketing technology',
                   hq:'New York, New York', founded:'2015', people:'~13,000', markets:'40+ countries',
                   pos:'Challenger network; technology-led alternative to the holding companies',
                   audience:'CMOs and marketing leadership at enterprise brands',
                   tone:'Direct, contrarian, evidence-forward',
                   peers:['WPP','Omnicom','Publicis'], pages:57 },
};
const ALIAS = { ldrs:'ldrsgroup.com', 'ldrs group':'ldrsgroup.com', nike:'nike.com', apple:'apple.com', airbnb:'airbnb.com', openai:'openai.com', tesla:'tesla.com',
  spotify:'spotify.com', delta:'delta.com', 'loreal':'loreal.com', "l'oréal":'loreal.com', stagwell:'stagwellglobal.com' };

/* One short line at a time. Nothing about engines, pages, models or sources —
   the visitor should feel attended to, not shown the machinery. */
const STATUS_LINES = [
  'Reading your website',
  'Understanding your business',
  'Mapping your market',
  'Reviewing your competitors',
  'Preparing your Executive AI Brief',
];

const MODELS = ['ChatGPT','Claude','Gemini','Perplexity','Copilot','Llama','Grok','DeepSeek'];

/* ─────────────────────────── STATE ─────────────────────────── */

const S = {
  step:0, busy:false, view:'workspace', briefReady:false,
  domain:'', brand:'', legal:'', who:'', firstName:'', industryLabel:'', data:DEFAULT_INDUSTRY,
  profile:null, comps:[], challenge:'', pages:42,
  focus:'Growth opportunities', focusLine:'where the next points of growth actually sit', focusLead:1,
  equity:62, aiVis:41, sov:18, gap:40, creators:'1,204', seed:1,
};

const hash = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); };
const pick = (n, lo, hi) => lo + (n % (hi - lo + 1));

function deriveNumbers() {
  const h = hash((S.domain || S.brand || 'stagwell').toLowerCase());
  S.seed = h;
  S.equity   = pick(h,        54, 73);
  S.aiVis    = pick(h >> 3,   31, 48);
  S.sov      = pick(h >> 6,   11, 23);
  S.gap      = pick(h >> 9,   34, 52);
  S.creators = pick(h >> 12, 640, 2400).toLocaleString();
}

/* Signals the machine "reads off the site" to place an unfamiliar company. */
const SIGNALS = [
  [/(media|studio|agency|group|creative|brand|comms|^pr|marketing|labs?)/, 'Marketing & Services'],
  [/(bank|capital|pay|fin|invest|credit|wealth|fund|insur)/,               'Financial Services'],
  [/(health|care|med|bio|pharma|clinic|therap|dental)/,                    'Healthcare & Pharma'],
  [/(travel|trip|fly|air|hotel|stay|tour|voyage|resort)/,                  'Travel & Hospitality'],
  [/(auto|motor|drive|car|mobility|^ev|fleet)/,                            'Automotive & Mobility'],
  [/(shop|store|retail|beauty|wear|food|market|cosmet|apparel)/,           'Consumer & Retail'],
  [/(tv|film|music|play|stream|game|studio|records|sport)/,                'Media & Entertainment'],
  [/(ai|tech|soft|cloud|data|app|dev|cyber|sys|net)/,                      'Technology & Software'],
];

/* Turn whatever they typed into a full inferred profile. Never fails, never
   hands the classification work back to the visitor. */
function readWebsite(raw) {
  let t = String(raw).trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/\s+/g, '');
  if (ALIAS[t]) t = ALIAS[t];
  if (t && !t.includes('.')) t = t.replace(/[^a-z0-9-]/g, '') + '.com';
  if (!t) t = 'nike.com';

  const known = KNOWN[t];
  if (known) return { domain: t, ...known, confident: true };

  /* Unfamiliar domain — infer everything rather than asking. */
  const stem = t.split('.')[0].replace(/-/g, ' ');
  const name = stem.replace(/\b\w/g, c => c.toUpperCase());
  const tld = t.split('.').slice(1).join('.');
  const hay = `${stem} ${tld}`;
  const ind = (SIGNALS.find(([re]) => re.test(hay)) || [null, 'Technology & Software'])[1];
  const d = INDUSTRIES[ind];
  const h = hash(t);
  return {
    domain: t, name, legal: name, ind, confident: false,
    what: d.what, pos: d.pos, audience: d.segment, tone: d.tone,
    hq: null, founded: null, people: null, markets: null,
    peers: d.peers.slice(0, 3),
    pages: pick(h, 18, 64),
    entities: pick(h >> 4, 180, 940),
    mentions: pick(h >> 7, 40, 460),
  };
}

/* ─────────────────────────── TYPEWRITER ─────────────────────────── */

let skipType = null;
function typeHTML(el, html, speed = 14) {
  return new Promise(resolve => {
    el.innerHTML = html;
    const nodes = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) nodes.push({ node: n, full: n.nodeValue });
    if (REDUCED) { resolve(); return; }
    nodes.forEach(o => (o.node.nodeValue = ''));
    const caret = document.createElement('span'); caret.className = 'caret'; el.appendChild(caret);

    let ni = 0, ci = 0, stopped = false;
    const finish = () => {
      stopped = true; nodes.forEach(o => (o.node.nodeValue = o.full));
      caret.remove(); if (skipType === finish) skipType = null; resolve();
    };
    skipType = finish;
    const tick = () => {
      if (stopped) return;
      let budget = 2;
      while (budget-- > 0 && ni < nodes.length) {
        const o = nodes[ni];
        if (ci >= o.full.length) { ni++; ci = 0; continue; }
        const ch = o.full[ci];
        o.node.nodeValue += ch; ci++;
        if ('.,—:?'.includes(ch)) { setTimeout(tick, 120); return; }
      }
      if (ni >= nodes.length) return finish();
      setTimeout(tick, speed + Math.random() * 11);
    };
    setTimeout(tick, 50);
  });
}

/* ─────────────────────────── SHELL ─────────────────────────── */

const app = $('#app'), stage = $('#stage'), thread = $('#thread'), wsView = $('[data-view="workspace"]');
const dock = $('#dock'), promptForm = $('#promptForm'), promptInput = $('#promptInput'), prompt = $('.prompt');
const crumb = $('#crumb'), ctx = $('#ctx'), ctxList = $('#ctxList'), restartBtn = $('#restart');

const CRUMB = { workspace:'Workspace', run:'Preparing your brief', brief:'Executive AI Brief',
  whatwedo:'Future of News · What we do', mission:'Future of News · Our mission',
  research:'Future of News · Research', partners:'Future of News · Our partners' };

function show(view) {
  S.view = view;
  $$('.view').forEach(v => v.classList.toggle('is-shown', v.dataset.view === view));
  $$('.rail__item').forEach(b => b.classList.toggle('is-active', !!b.dataset.nav && b.dataset.nav === view));
  if (view === 'workspace' && S.step > 0) $('#railThread').classList.add('is-active');
  crumb.innerHTML = `<span>${CRUMB[view] || 'Workspace'}</span>`;
  topbar.style.transform = ''; topbar.style.opacity = '';   // reset when the view changes
  app.classList.remove('rail-open');
  /* the rail stays put through the loader so nothing reflows while we wait;
     it only steps aside for the brief, which wants the full width */
  app.classList.toggle('has-ctx', (view === 'workspace' || view === 'run') && ctxList.children.length > 0);
  document.body.dataset.state = view;
  if (view === 'workspace' && S.step < SCRIPT.length) setTimeout(() => promptInput.focus(), 320);
}

/* The topbar rides with the content rather than hovering above it. */
const topbar = $('.topbar');
function trackTopbar(el) {
  if (!el || el.dataset.topbarBound) return;
  el.dataset.topbarBound = '1';
  el.addEventListener('scroll', () => {
    if (!el.closest('.view').classList.contains('is-shown')) return;
    const y = Math.min(el.scrollTop, 64);
    topbar.style.transform = `translateY(${-y}px)`;
    topbar.style.opacity = String(1 - y / 64);
  }, { passive: true });
}
$$('.scroll, .view--partners').forEach(trackTopbar);

$$('[data-nav]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); show(b.dataset.nav); }));
$('#railOpen').addEventListener('click', () => app.classList.add('rail-open'));
$('#railClose').addEventListener('click', () => app.classList.remove('rail-open'));

/* ── The composer physically lives inside the centred hero group, then flies
      to the foot of the page when the conversation starts. No measuring at
      boot, so font loading and resizes can never leave it stranded. ── */
const heroDock = $('#heroDock');

function seatComposer() {
  if (promptForm.parentElement !== heroDock) heroDock.appendChild(promptForm);
}

function undockInput() {
  const first = promptForm.getBoundingClientRect();
  dock.appendChild(promptForm);
  wsView.classList.remove('is-welcome');
  const last = promptForm.getBoundingClientRect();
  const dx = Math.round(first.left - last.left);
  const dy = Math.round(first.top - last.top);
  if (!REDUCED && (dx || dy)) {
    promptForm.animate(
      [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }],
      { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
}

/* ─────────────────────────── CONVERSATION ─────────────────────────── */

const scrollDown = () => {
  const sc = $('#wsScroll');
  requestAnimationFrame(() => sc.scrollTo({ top: sc.scrollHeight, behavior: REDUCED ? 'auto' : 'smooth' }));
};

function aiTurn() {
  const t = document.createElement('div');
  t.className = 'turn';
  t.innerHTML = `<div class="ai">
      <svg class="ai__mark"><use href="#sw-mark"/></svg>
      <div class="ai__body"><p class="ai__who">Stagwell AI</p>
        <div class="thinking"><i></i><i></i><i></i></div></div></div>`;
  thread.appendChild(t); scrollDown();
  return $('.ai__body', t);
}

function addUser(text) {
  const t = document.createElement('div');
  t.className = 'turn turn--user';
  t.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  thread.appendChild(t); scrollDown();
}

async function say(html, { options, node, delay = 620 } = {}) {
  const body = node || aiTurn();
  await wait(REDUCED ? 40 : delay + Math.random() * 260);
  $('.thinking', body)?.remove();
  const p = document.createElement('p'); p.className = 'ai__text';
  body.appendChild(p);
  await typeHTML(p, html);
  scrollDown();
  if (options) await addOptions(body, options);
  return body;
}

function addOptions(body, list) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'opts';
    list.forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opt';
      b.innerHTML = `<span class="opt__dot"></span>${label}`;
      b.style.animationDelay = `${80 + i * 60}ms`;
      b.addEventListener('click', () => submit(b.textContent.trim()));
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
    scrollDown();
    setTimeout(resolve, 120);
  });
}

function clearOptions() {
  $$('.opts', thread).forEach(o => {
    o.classList.add('is-gone');
    setTimeout(() => o.remove(), 460);
  });
}

function addCtx(tag, text) {
  const c = document.createElement('div');
  c.className = 'ctxcard';
  c.innerHTML = `<b>${tag}</b><span>${text.replace(/<\/?b>/g, '')}</span><em>captured</em>`;
  ctxList.appendChild(c);
  const pct = Math.round((ctxList.children.length / SCRIPT.length) * 100);
  $('#ctxBar').style.width = pct + '%'; $('#ctxPct').textContent = pct;
  ctx.hidden = false;
  if (S.view === 'workspace') app.classList.add('has-ctx');
}

/* What the machine worked out on its own. This card is the whole promise:
   the visitor classifies nothing. */
function inferenceCard(p) {
  const rows = [
    ['Company', p.legal || p.name],
    ['Industry', p.ind],
    ['What you do', p.what],
    ['Positioning', p.pos],
    ['Likely audience', p.audience],
    ['Brand language', p.tone],
  ];
  if (p.confident) rows.push(['Headquarters', p.hq], ['Founded', p.founded], ['People', p.people]);
  else rows.push(['Named entities', String(p.entities)], ['Earned mentions, 30d', String(p.mentions)],
                 ['Read confidence', 'High']);
  return `<div class="site">
    <div class="site__bar"><i class="pulse"></i><b>${esc(p.domain)}</b><span class="sp"></span>
      <span>${p.pages} pages read · inferred in 1.4s</span></div>
    <div class="site__rows">
      ${rows.map(r => `<div class="site__row"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}
    </div>
    <p class="site__note"><b>Likely competitors</b> — ${p.peers.join(' · ')}</p>
  </div>`;
}

const FOCUS = {
  'Growth opportunities':    { lead:1, line:'where the next points of growth actually sit' },
  'Competitive positioning': { lead:0, line:'how you stand against the set you compete with' },
  'AI opportunities':        { lead:0, line:'what AI changes for you first' },
  'Brand perception':        { lead:2, line:'what the market — and the machines — currently believe about you' },
};

/* ── Two beats. The machine does the research, then asks the one thing
      it genuinely cannot know: what you want from it. ── */

const SCRIPT = [
  {
    key: 'website',
    placeholder: 'nike.com',
    async reply() {
      const body = aiTurn();
      await wait(REDUCED ? 40 : 460);
      $('.thinking', body)?.remove();
      const p = document.createElement('p'); p.className = 'ai__text';
      body.appendChild(p);
      await typeHTML(p, `Reading <em>${esc(S.domain)}</em>…`);
      await wait(REDUCED ? 30 : 700);

      const holder = document.createElement('div');
      holder.innerHTML = inferenceCard(S.profile);
      body.appendChild(holder.firstElementChild);
      scrollDown();
      await wait(REDUCED ? 40 : 820);

      const what = S.profile.what.charAt(0).toLowerCase() + S.profile.what.slice(1);
      const where = S.profile.confident ? `, out of ${esc(S.profile.hq)}` : '';
      await say(
        `I have reviewed <em>${esc(S.brand)}</em>. You appear to operate across ${esc(what)}${where} — positioned as ${esc(S.profile.pos.toLowerCase())}. In the answer layer you sit against ${esc(S.profile.peers.slice(0, 2).join(' and '))}. <span class="hl">I have what I need.</span> What would you like me to focus on first?`,
        { node: body, delay: 220, options: Object.keys(FOCUS) });

      addCtx('Site read', `<b>${S.brand}</b> — ${S.profile.what}`);
      addCtx('Inference', `${S.profile.ind} · <b>${S.profile.peers.length} rivals</b> identified`);
      return body;
    },
  },
  {
    key: 'focus',
    placeholder: 'Or tell me in your own words',
    async reply() {
      /* Only asked when it genuinely helps: benchmarking needs a name. */
      if (S.focus === 'Competitive positioning') {
        await say(`Then let me get the set right. I am benchmarking you against <em>${S.comps.join('</em>, <em>')}</em> — anyone else you measure yourself by?`,
          { options: [`Those three are right`, `Add someone I should watch`] });
      } else {
        await say(`Good. I will lead on ${esc(S.focusLine)}. <span class="hl">Give me forty seconds.</span>`);
      }
      addCtx('Focus', `Brief will lead on <b>${S.focus}</b>`);
    },
  },
  {
    key: 'competitors',
    skipIf: () => S.focus !== 'Competitive positioning',
    placeholder: 'A name, or press enter to keep mine',
    async reply() {
      await say(`Locked. NewIntel now has every move <em>${esc(S.comps[0])}</em> made in the last seven days. <span class="hl">Give me forty seconds.</span>`);
      addCtx('NewIntel', `<b>${S.comps.length} rivals</b> under live surveillance`);
    },
  },
];

function nextIndex(from) {
  let i = from;
  while (i < SCRIPT.length && SCRIPT[i].skipIf && SCRIPT[i].skipIf()) i++;
  return i;
}

/* The input stays locked until the next question is fully on screen, so a
   double-tap can never drop an answer into the wrong beat. */
async function askStep() {
  S.busy = true;
  S.step = nextIndex(S.step);
  const q = SCRIPT[S.step];
  if (!q) return runMachine();
  promptInput.placeholder = q.placeholder;
  if (q.question) await say(q.question(), { options: q.optionsFor ? q.optionsFor() : null });
  else if (q.optionsFor) await addOptions(thread.lastElementChild.querySelector('.ai__body'), q.optionsFor());
  promptInput.value = ''; prompt.classList.remove('is-ready');
  S.busy = false;
  promptInput.focus();
}

promptInput.addEventListener('input', () => prompt.classList.toggle('is-ready', promptInput.value.trim().length > 0));
promptForm.addEventListener('submit', e => { e.preventDefault(); submit(promptInput.value); });

async function submit(raw) {
  if (S.busy) return;
  const text = (raw || '').trim();
  const q = SCRIPT[S.step];
  if (!q) return;
  if (!text) { prompt.classList.add('is-shake'); setTimeout(() => prompt.classList.remove('is-shake'), 440); return; }

  S.busy = true;
  promptInput.value = ''; prompt.classList.remove('is-ready');
  clearOptions();

  if (q.key === 'website') {
    /* Everything is inferred here — the visitor is never asked to classify. */
    S.profile = readWebsite(text);
    S.domain = S.profile.domain; S.brand = S.profile.name; S.pages = S.profile.pages;
    S.industryLabel = S.profile.ind;
    S.data = INDUSTRIES[S.profile.ind] || DEFAULT_INDUSTRY;
    S.comps = S.profile.peers.slice(0, 3);
    deriveNumbers();
    $('#railSession').hidden = false;
    $('#railThreadLabel').textContent = S.brand;
    restartBtn.classList.add('is-on');
    undockInput();
    thread.hidden = false;
  }
  if (q.key === 'focus') {
    const match = Object.keys(FOCUS).find(k => k.toLowerCase() === text.toLowerCase())
      || Object.keys(FOCUS).find(k => text.toLowerCase().includes(k.split(' ')[0].toLowerCase()));
    S.focus = match || 'Growth opportunities';
    S.focusLine = FOCUS[S.focus].line;
    S.focusLead = FOCUS[S.focus].lead;
    if (!match) S.challenge = text.slice(0, 90);   // they typed their own goal — keep their words
  }
  if (q.key === 'competitors') {
    const keep = /^(those three|yes|correct|right|keep|no|none)/i.test(text);
    if (!keep) {
      const typed = text.split(/,|\band\b|\//).map(t => t.trim())
        .filter(t => t.length > 1 && t.length < 28 && !/^add someone/i.test(t));
      if (typed.length) S.comps = [...new Set([...typed, ...S.comps])].slice(0, 3);
    }
    S.comps = S.comps.filter(c => c.toLowerCase() !== S.brand.toLowerCase());
    if (!S.comps.length) S.comps = S.profile.peers.slice(0, 3);
  }

  addUser(text);
  await wait(REDUCED ? 30 : 200);
  await q.reply();
  S.step++;
  await wait(REDUCED ? 30 : 420);
  askStep();
}

/* Click or Enter completes an in-flight typewriter — built for live presenting. */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { app.classList.remove('rail-open'); closeModal(); }
  if (skipType && (e.key === 'Enter' || e.key === ' ')) skipType();
});
stage.addEventListener('click', e => { if (skipType && !e.target.closest('button,input,a')) skipType(); });

/* ─────────────────────────── MACHINE MODE ─────────────────────────── */

async function runMachine() {
  S.busy = true;
  restartBtn.classList.remove('is-on');

  const status = $('#runStatus'), meter = $('#runMeter');
  status.innerHTML = '';
  meter.style.width = '0';

  show('run');                       // same room, same sidebar — only the centre changes
  await wait(REDUCED ? 30 : 220);

  const STEP = REDUCED ? 30 : 880;
  for (let i = 0; i < STATUS_LINES.length; i++) {
    status.innerHTML = `<span>${STATUS_LINES[i]}…</span>`;
    meter.style.width = ((i + 1) / STATUS_LINES.length * 100) + '%';
    await wait(STEP);
  }
  await wait(REDUCED ? 20 : 260);

  buildBrief();
  show('brief');
  $('#railBrief').hidden = false;
  $('#railBriefLabel').textContent = `Executive Brief · ${S.brand}`;
  restartBtn.classList.add('is-on');
  S.briefReady = true; S.busy = false;
}

/* ─────────────────────────── THE BRIEF ─────────────────────────── */

function buildBrief() {
  const b = S.brand, c1 = S.comps[0] || 'the category leader', c2 = S.comps[1] || 'a challenger';
  const cat = S.data.category;
  const trends = [...S.data.trends, NEWS_TREND];
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const lead = Math.min(94, S.aiVis + S.gap);

  const modelScores = MODELS.map((m, i) => {
    const me = pick(S.seed >> (i + 1), Math.max(12, S.aiVis - 18), Math.min(78, S.aiVis + 20));
    return { m, me, them: Math.min(96, me + pick(S.seed >> (i + 4), 14, 42)) };
  });

  const OPPS = [
    { h:`Own the answer layer in ${cat}`,
      p:`${b} appears in roughly ${S.aiVis}% of model answers where ${c1} appears in ${lead}%. This is a citation-supply problem, not a brand problem — and it is the fastest-moving score in this brief.`,
      e:['GEOPulse','NewIndex','Earned media'], impact:92, effort:38, lift:`+${pick(S.seed, 18, 34)}pts`, l:'AI visibility, 2 quarters' },
    { h:'Convert the creator momentum you already have',
      p:`IMAI matched ${S.creators} creators already talking about ${b} with no commercial relationship. ${c2} formalised theirs last quarter. Owned creator equity compounds at roughly 3× paid social efficiency in this category.`,
      e:['IMAI','DoReel','SATS'], impact:78, effort:44, lift:`${pick(S.seed >> 2, 2, 4)}.1×`, l:'Efficiency vs paid social' },
    { h:'Buy back the news adjacency your competitors abandoned',
      p:`Stagwell’s research with HarrisX shows no measurable performance penalty for news adjacency — yet the category has retreated from it. That has left premium, high-attention inventory structurally under-priced for whoever moves first.`,
      e:['Future of News','The Trade Desk','Ozone'], impact:71, effort:22, lift:`−${pick(S.seed >> 5, 14, 28)}%`, l:'Cost per attention point' },
  ];

  const SOLUTIONS = [
    ['BERA.ai','Brand equity, priced','Ties perception movement to revenue so the board reads marketing as a P&L input, not a cost line.','Brand-to-Business'],
    ['GEOPulse / NewIndex','Visibility in AI answers','Tracks how eight models describe you against your set, daily, and shows what moves the number.','Answer-layer analytics'],
    ['SATS','The audience, resolved','A 260M identity graph turns a segment description into addressable, measurable people.','Activation'],
    ['IMAI','Creators, already yours','Finds the voices talking about you now and turns unpaid affinity into a managed programme.','Creator graph'],
    ['DoReel','Creative at the speed of insight','AI-produced UGC and presenter video, generated from the same brief you are reading.','Generative production'],
    ['NewVoices + Bestie','The conversation layer','Voice agents that arrive at a call already holding the full diagnosis.','Conversational AI'],
  ];

  const HOR = [
    ['0–30 days','Establish the baseline', [
      `Instrument ${b} on GEOPulse across all eight models and publish the weekly delta to the leadership team.`,
      `Stand up NewIntel surveillance on ${S.comps.join(', ')}.`,
      'Run the BERA equity read and translate it into a revenue sensitivity model.',
    ]],
    ['31–60 days','Correct the citation supply', [
      'Repoint earned media at the sources models actually cite — wire services and quality news.',
      'Formalise the top 40 creators IMAI has already matched.',
      'Pilot news-adjacent inventory on Trade Desk and Ozone at a controlled weight.',
    ]],
    ['61–90 days','Compound it', [
      'Publish the first quarterly AI Visibility read to the board alongside brand equity.',
      'Move DoReel creative into always-on production against the winning narratives.',
      `Open the full ${b} AI Workspace to the wider marketing team.`,
    ]],
  ];

  /* The visitor's chosen focus leads the ranking and opens the summary. */
  const leadOpp = OPPS.splice(S.focusLead || 0, 1)[0];
  if (leadOpp) OPPS.unshift(leadOpp);

  const bar = (v, cls) => `<i class="${cls}" style="--w:${v}%"></i>`;

  $('#brief').innerHTML = `
  <header class="bmast reveal">
    <div class="bmast__top">
      <span class="bmast__badge"><i class="pulse"></i>Executive AI Brief</span>
      <span class="bmast__badge">${S.firstName ? 'Prepared for ' + esc(S.firstName) : 'Confidential preview'}</span>
    </div>
    <h1>${esc(b)}.<br><span>Read, diagnosed, and priced.</span></h1>
    <div class="bmast__meta">
      <span>Source <b>${esc(S.domain)}</b></span><span>Generated <b>${today}</b></span>
      <span>Elapsed <b>41 seconds</b></span><span>Engines <b>10</b></span>
      <span>Sources read <b>41,882</b></span><span>Category <b>${esc(S.industryLabel || 'General')}</b></span>
      <span>Focus <b>${esc(S.focus)}</b></span>
    </div>
    <div class="bmast__acts">
      <button class="btn btn--dark" data-cta="workspace">Request the full workspace</button>
      <button class="btn btn--ghost" data-cta="pdf">Download as PDF</button>
      <button class="btn btn--ghost" data-cta="share">Share with my team</button>
    </div>
  </header>

  <section class="bsec reveal">
    <div class="bhead"><h2>Executive summary</h2><i></i><span class="tag">Section 01</span></div>
    <p class="bsum">You asked me to lead on ${esc(S.focusLine)}. Here is what I found. ${esc(b)} holds a defensible position in ${cat} — brand equity sits at <b>${S.equity}</b> against a category mean of 58. The machines that now mediate your category do not know it: across eight language models ${esc(b)} is named in <b>${S.aiVis}%</b> of relevant answers where ${esc(c1)} is named in <b>${lead}%</b>.${S.challenge ? ` You called it “${esc(S.challenge.slice(0, 88))}” — this brief prices it.` : ''} The gap is a supply problem in earned citation, and it is the cheapest thing on this page to fix.</p>
    <div class="kpis">
      <div class="kpi"><span class="kpi__k">Brand equity · BERA</span>
        <span class="kpi__v">${S.equity}<small>/100</small></span>
        <span class="kpi__d up">▲ 4 pts vs last quarter</span>
        <span class="kpi__bar" style="--w:${S.equity}%"><i></i></span></div>
      <div class="kpi"><span class="kpi__k">AI visibility · GEOPulse</span>
        <span class="kpi__v">${S.aiVis}<small>/100</small></span>
        <span class="kpi__d down">▼ ${S.gap} pts behind ${esc(c1)}</span>
        <span class="kpi__bar" style="--w:${S.aiVis}%"><i></i></span></div>
      <div class="kpi"><span class="kpi__k">Share of voice · NewIntel</span>
        <span class="kpi__v">${S.sov}<small>%</small></span>
        <span class="kpi__d flat">— flat, 3 quarters</span>
        <span class="kpi__bar" style="--w:${S.sov * 3}%"><i></i></span></div>
      <div class="kpi"><span class="kpi__k">Creator affinity · IMAI</span>
        <span class="kpi__v">${S.creators}</span>
        <span class="kpi__d up">▲ unpaid, unmanaged</span>
        <span class="kpi__bar" style="--w:64%"><i></i></span></div>
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>How AI describes you</h2><i></i><span class="tag">Section 02 · GEOPulse</span></div>
    <div class="vis">
      ${modelScores.map(s => `<div class="visrow">
          <span class="visrow__n">${s.m}</span>
          <span class="visrow__track">${bar(s.me, 'me')}${bar(s.them, 'them')}</span>
          <span class="visrow__v">${s.me}% · ${s.them}%</span></div>`).join('')}
    </div>
    <div class="vislegend"><span><i></i>${esc(b)}</span><span><i class="them"></i>${esc(c1)}</span>
      <span>Share of relevant answers, 30-day window</span></div>
    <div class="quotes">
      <div class="quote"><p>“Reliable and widely available, though ${esc(c1)} is more often described as the leader in this space.”</p><b>ChatGPT · verbatim</b></div>
      <div class="quote"><p>“${esc(b)} appears in 2 of 10 answers about ${cat}; ${esc(c1)} appears in 7.”</p><b>Perplexity · measured</b></div>
      <div class="quote"><p>“Coverage of ${esc(b)} skews to product news. ${esc(c2)} owns the forward-looking narrative.”</p><b>Gemini · verbatim</b></div>
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>Competitor snapshot</h2><i></i><span class="tag">Section 03 · NewIntel</span></div>
    <table class="tbl">
      <thead><tr><th>Brand</th><th>AI visibility</th><th>Equity trend</th><th>Creator momentum</th><th>Last move — this week</th></tr></thead>
      <tbody>
        <tr class="you"><td class="nm">${esc(b)}</td>
          <td><span class="mini" style="--w:${S.aiVis}%"><i></i></span> ${S.aiVis}</td>
          <td><span class="pill pill--up">▲ 4</span></td><td>Unmanaged</td><td>—</td></tr>
        ${S.comps.map((c, i) => {
          const v = Math.max(20, Math.min(94, lead - i * pick(S.seed >> (i + 2), 4, 13)));
          const up = i !== 1;
          const moves = ['Published category research picked up by three wire services.',
                         'Signed 18 creators to an exclusive always-on programme.',
                         'Shifted spend into news inventory at a 40% cost advantage.'];
          return `<tr><td class="nm">${esc(c)}</td>
            <td><span class="mini" style="--w:${v}%"><i></i></span> ${v}</td>
            <td><span class="pill pill--${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${pick(S.seed >> (i + 6), 2, 11)}</span></td>
            <td>${['Accelerating','Steady','Accelerating'][i] || 'Steady'}</td>
            <td>${moves[i] || moves[0]}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>What is moving in your industry</h2><i></i><span class="tag">Section 04 · HarrisQuest</span></div>
    <div class="cards">
      ${trends.map((t, i) => `<article class="card">
        <span class="card__k">Trend 0${i + 1}</span><h3>${t[0]}</h3><p>${t[1]}</p>
        <span class="card__foot">${i === 2 ? 'HarrisX · six markets' : 'Stagwell signal index'}</span></article>`).join('')}
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>Where the value is</h2><i></i><span class="tag">Section 05 · ranked</span></div>
    <div class="opps">
      ${OPPS.map((o, i) => `<article class="opp">
        <span class="opp__r">0${i + 1}</span>
        <div class="opp__b"><h3>${o.h}</h3><p>${o.p}</p>
          <div class="opp__engines">${o.e.map(e => `<span class="tagx">${e}</span>`).join('')}</div></div>
        <div class="opp__m">
          <span class="opp__lift">${o.lift}<small>${o.l}</small></span>
          <span class="meter"><b>Impact<span>${o.impact}</span></b><i style="--w:${o.impact}%"></i></span>
          <span class="meter"><b>Effort<span>${o.effort}</span></b><i style="--w:${o.effort}%"></i></span>
        </div></article>`).join('')}
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>What we would put on it</h2><i></i><span class="tag">Section 06 · Stagwell AI</span></div>
    <div class="cards">
      ${SOLUTIONS.map(s => `<article class="card">
        <span class="card__k">${s[0]}</span><h3>${s[1]}</h3><p>${s[2]}</p>
        <span class="card__foot">${s[3]}</span></article>`).join('')}
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>The research behind this</h2><i></i><span class="tag">Section 07 · HarrisX</span></div>
    <ul class="studies">
      ${STUDIES.map(s => `<li class="study">
        <span class="study__t">${s[0]}${s[2] ? '<span class="rel">Relevant to you</span>' : ''}</span>
        <span class="study__m">${s[1]}</span></li>`).join('')}
    </ul>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>The first ninety days</h2><i></i><span class="tag">Section 08 · suggested</span></div>
    <div class="horizons">
      ${HOR.map(h => `<div class="horizon">
        <div class="horizon__h"><b>${h[0]}</b><span>${h[1]}</span></div>
        <ul>${h[2].map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}
    </div>
  </section>

  <section class="bvideo reveal">
    <div class="bvideo__in">
      <p class="eyebrow"><i class="pulse"></i>Section 09 · DoReel</p>
      <h2>Your diagnosis, presented back to you.</h2>
      <p>An AI presenter delivers these findings — about ${esc(b)}, addressed to ${S.firstName ? esc(S.firstName) : 'you'}, produced seconds after one website was typed. This is the version your CEO watches.</p>
      <div class="player" id="player">
        <span class="player__grid"></span><span class="player__figure"></span>
        <span class="player__hud"><i></i>DoReel · rendered 41s ago</span>
        <button class="player__play" aria-label="Play">
          <svg viewBox="0 0 26 26" width="24" height="24"><path d="M8 5.2l11 6.8-11 6.8V5.2Z" fill="currentColor"/></svg>
        </button>
        <p class="player__cap" id="playerCap"></p>
        <span class="player__wave" id="playerWave">${'<i></i>'.repeat(46)}</span>
        <span class="player__bar"><i id="playerBar"></i></span>
      </div>
      <button class="btn btn--ghost-void" data-cta="video">Generate the full cut</button>
    </div>
  </section>

  <section class="binsight reveal">
    <div class="bhead"><span class="tag">Section 10 · Executive insight</span><i></i></div>
    <blockquote>
      <p>Instead of feeding the vicious cycle of news demonetization, advertisers should kickstart a virtuous cycle of investing in news.</p>
      <footer><b>Mark Penn</b><i></i><span>Chairman &amp; CEO, Stagwell</span></footer>
    </blockquote>
  </section>

  <section class="bcta">
    <div class="bcta__in">
      <h2>This is the preview.<br><span>The workspace is the product.</span></h2>
      <p class="bcta__lede">${S.firstName ? esc(S.firstName) + ', you' : 'You'} typed one website. The full ${esc(b)} workspace runs this continuously — every engine, every day, against every competitor you name.</p>
      <div class="bcta__grid">
        ${[
          ['Book a strategy session','Sixty minutes with the team that built the machine.','session'],
          ['Talk to an AI expert','A working conversation, not a pitch.','expert'],
          ['Request your full AI workspace','All ten engines, pointed at your brand.','workspace'],
          ['See what’s possible','The wider Stagwell AI product pool.','possible'],
        ].map(c => `<button class="ctacard" data-cta="${c[2]}">
          <b>${c[0]}<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></b>
          <span>${c[1]}</span></button>`).join('')}
      </div>
      <div class="callback">
        <div class="callback__t">
          <b><i class="pulse"></i>Or let the machine call you.</b>
          <span>Leave a number and a NewVoices agent calls within two minutes — already holding this diagnosis.</span>
        </div>
        <form data-cta="callback">
          <input type="tel" placeholder="+1 (555) 000-0000" aria-label="Phone number">
          <button class="btn btn--light" type="submit">Call me now</button>
        </form>
      </div>
    </div>
  </section>

  <footer class="bfoot">
    <svg><use href="#sw-logo"/></svg>
    <span>Prototype · scripted demonstration · figures illustrative · nothing leaves this page</span>
  </footer>`;

  observeReveals();
  wirePlayer();
  $('#briefScroll').scrollTop = 0;
}

/* ─────────────────────────── REVEALS ─────────────────────────── */

let io;
function observeReveals() {
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { root: $('#briefScroll'), threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
  $$('.reveal', $('#brief')).forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i, 2) * 80}ms`; io.observe(el);
  });
  setTimeout(() => $$('.reveal', $('#brief')).slice(0, 2).forEach(el => el.classList.add('is-in')), 80);
}

/* ─────────────────────────── VIDEO PREVIEW ─────────────────────────── */

function wirePlayer() {
  const p = $('#player'); if (!p) return;
  const cap = $('#playerCap'), barEl = $('#playerBar'), bars = $$('#playerWave i');
  const script = [
    `${S.firstName ? S.firstName + ', here' : 'Here'} is ${S.brand}'s diagnosis — generated forty seconds ago.`,
    `Your brand equity is strong. Your visibility inside AI answers is not.`,
    `${S.comps[0] || 'Your closest rival'} is named ${S.gap} points more often than you are.`,
    `Three moves close that gap. The first one costs almost nothing.`,
  ];
  let playing = false, timers = [];
  const stop = () => {
    playing = false; p.classList.remove('is-playing');
    timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers = [];
    cap.textContent = ''; barEl.style.transition = 'none'; barEl.style.width = '0';
  };
  p.addEventListener('click', () => {
    if (playing) return stop();
    playing = true; p.classList.add('is-playing');
    timers.push(setInterval(() => bars.forEach(x => (x.style.height = (12 + Math.random() * 88) + '%')), 90));
    let t = 0;
    script.forEach(line => { timers.push(setTimeout(() => { cap.textContent = line; }, t)); t += 2600; });
    barEl.style.transition = `width ${t + 600}ms linear`;
    requestAnimationFrame(() => (barEl.style.width = '100%'));
    timers.push(setTimeout(stop, t + 600));
  });
}

/* ─────────────────────────── RESTART ─────────────────────────── */

async function restart() {
  if (S.busy) return;
  restartBtn.classList.remove('is-on');
  show('workspace');
  await wait(REDUCED ? 20 : 240);

  Object.assign(S, {
    step:0, busy:false, briefReady:false, domain:'', brand:'', legal:'', who:'', firstName:'',
    industryLabel:'', data:DEFAULT_INDUSTRY, profile:null, comps:[], challenge:'',
    focus:'Growth opportunities', focusLine:'where the next points of growth actually sit', focusLead:1,
  });
  thread.innerHTML = ''; thread.hidden = true;
  ctxList.innerHTML = ''; ctx.hidden = true; app.classList.remove('has-ctx');
  $('#ctxBar').style.width = '0'; $('#ctxPct').textContent = '0';
  $('#brief').innerHTML = '';
  $('#railSession').hidden = true; $('#railBrief').hidden = true;
  $('#railThreadLabel').textContent = 'New analysis';
  promptInput.value = ''; promptInput.placeholder = SCRIPT[0].placeholder;
  prompt.classList.remove('is-ready');

  wsView.classList.add('is-welcome');
  seatComposer();
  requestAnimationFrame(() => promptInput.focus());
}
restartBtn.addEventListener('click', restart);
$('#newAnalysis').addEventListener('click', restart);

/* ─────────────────────────── MODAL ─────────────────────────── */

const modal = $('#modal'), modalBody = $('#modalBody');
const closeModal = () => { modal.hidden = true; };
$$('[data-close]', modal).forEach(e => e.addEventListener('click', closeModal));

const CTA_COPY = {
  session:   ['Book a strategy session','Sixty minutes with the team that built the machine. We arrive with your diagnosis already open.'],
  expert:    ['Talk to an AI expert','A working conversation about what the machine found — and what it would take to fix it.'],
  workspace: ['Request your full AI workspace','All ten engines, pointed at your brand, running continuously. We provision in five working days.'],
  possible:  ['See what’s possible','A walkthrough of the wider Stagwell AI product pool and the work it is already doing.'],
  video:     ['Generate the full cut','A three-minute presenter video of this diagnosis, rendered by DoReel and delivered to your inbox.'],
  pdf:       ['Download this brief','We will send the full Executive AI Brief as a designed PDF, plus the raw engine outputs.'],
  share:     ['Share with your team','We will generate a private link to this brief that your team can open without signing in.'],
  callback:  ['The machine will call you','A NewVoices agent will call within two minutes, already holding this diagnosis.'],
};

function openModal(kind) {
  const [t, p] = CTA_COPY[kind] || CTA_COPY.expert;
  modalBody.innerHTML = `
    <p class="eyebrow"><i class="pulse"></i>Stagwell AI</p>
    <h3>${t}</h3><p>${p}</p>
    <form class="modal__form" id="leadForm">
      <input type="text" placeholder="Full name" value="${esc(S.who || '')}" required>
      <input type="email" placeholder="Work email" required>
      <input type="text" placeholder="Role — e.g. CMO, VP Marketing" required>
      <button class="btn btn--dark" type="submit">${kind === 'callback' ? 'Call me now' : 'Continue'}</button>
    </form>
    <p class="modal__fine">Prototype only — nothing is submitted or stored.</p>`;
  modal.hidden = false;
  $('#leadForm').addEventListener('submit', e => {
    e.preventDefault();
    modalBody.innerHTML = `
      <div class="modal__ok">
        <span class="modal__tick"><svg viewBox="0 0 20 20" width="20" height="20"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <h3>The machine has your brief.</h3>
        <p>Your ${esc(S.brand || 'brand')} diagnosis has been enriched by SATS and scored. Someone who already understands the account will be in touch — not an SDR reading a script.</p>
        <button class="btn btn--dark" data-close>Back to the brief</button>
      </div>`;
    $$('[data-close]', modalBody).forEach(x => x.addEventListener('click', closeModal));
  });
  setTimeout(() => $('#leadForm input')?.focus(), 120);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-cta]');
  if (t && t.tagName !== 'FORM') { e.preventDefault(); openModal(t.dataset.cta); }
});
document.addEventListener('submit', e => {
  if (e.target.matches('form[data-cta]')) { e.preventDefault(); openModal(e.target.dataset.cta); }
});

/* ─────────────────────────── STATIC VIEWS ─────────────────────────── */

$('#partners').innerHTML = PARTNERS.map(([k, n]) =>
  `<div class="partner" title="${n}"><img src="${partnerSrc(k)}" alt="${n}" loading="lazy"></div>`).join('');
$('#studies').innerHTML = STUDIES.map(s =>
  `<li class="study"><span class="study__t">${s[0]}</span><span class="study__m">${s[1]}</span></li>`).join('');

/* Placeholder breathes through a few inspiring examples — the only hint on screen. */
const IDEAS = ['nike.com','airbnb.com','openai.com','yourcompany.com'];
let ideaI = 0;
setInterval(() => {
  if (S.step !== 0 || document.activeElement === promptInput || S.view !== 'workspace') return;
  ideaI = (ideaI + 1) % IDEAS.length;
  promptInput.style.transition = 'opacity 280ms';
  promptInput.style.opacity = '0';
  setTimeout(() => { promptInput.placeholder = IDEAS[ideaI]; promptInput.style.opacity = '1'; }, 280);
}, 3600);

/* ─────────────────────────── BOOT ─────────────────────────── */

function jumpToBrief(params) {
  const p = readWebsite(params.get('brief') || 'nike.com');
  S.profile = p; S.domain = p.domain; S.brand = p.name; S.pages = p.pages;
  S.industryLabel = p.ind || 'Consumer & Retail';
  S.data = INDUSTRIES[S.industryLabel] || DEFAULT_INDUSTRY;
  S.comps = (params.get('vs') || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!S.comps.length) S.comps = p.peers.length ? p.peers.slice(0, 3) : ['Northbeam','Aperture Group','Meridian'];
  S.firstName = params.get('who') || '';
  S.focus = params.get('focus') || 'Growth opportunities';
  S.focusLine = (FOCUS[S.focus] || FOCUS['Growth opportunities']).line;
  S.focusLead = (FOCUS[S.focus] || FOCUS['Growth opportunities']).lead;
  S.step = SCRIPT.length;
  deriveNumbers();
  buildBrief();
  $('#railSession').hidden = false; $('#railBrief').hidden = false;
  $('#railThreadLabel').textContent = S.brand;
  $('#railBriefLabel').textContent = `Executive Brief · ${S.brand}`;
  restartBtn.classList.add('is-on');
  wsView.classList.remove('is-welcome');
  S.briefReady = true;
  show('brief');
}

(async function boot() {
  const params = new URLSearchParams(location.search);
  await wait(REDUCED || params.has('brief') ? 60 : 1650);
  if (params.has('brief')) { jumpToBrief(params); return; }
  show('workspace');
  seatComposer();
  requestAnimationFrame(() => promptInput.focus());
  if (params.has('view')) show(params.get('view'));
})();

})();
