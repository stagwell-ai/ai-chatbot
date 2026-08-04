/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — shared brain
   Reference data, the website inference, and the analysis maths. Version A
   (the workspace) and version B (the landing page) both read from here, so a
   copy change lands in both and they can never drift apart.
   ═══════════════════════════════════════════════════════════════════════════ */
window.SWAI = (() => {
'use strict';

const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

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


const FOCUS = {
  'Growth opportunities':    { lead:1, line:'where the next points of growth actually sit' },
  'Competitive positioning': { lead:0, line:'how you stand against the set you compete with' },
  'AI opportunities':        { lead:0, line:'what AI changes for you first' },
  'Brand perception':        { lead:2, line:'what the market — and the machines — currently believe about you' },
};

const ROLES = ['Chief Marketing Officer','VP / Head of Marketing','Founder or CEO','Communications & PR lead'];

/* Each logo file carries its own whitespace and aspect, so a single max-height
   makes some read huge and others tiny. These multipliers balance them by eye. */
const LOGO_SCALE = {
  'ad-fontes':1.3, 'free-press':1.25, guardian:1.35, 'business-insider':1.2,
  rebooting:1.2, 'usa-today':1.15, 'trade-desk':1.12, 'press-gazette':1.05,
  bbc:.95, ft:.72, huffpost:.88, 'ny-post':.88, axios:.9, politico:.9,
  newsweek:.92, teads:.9, '1440':.82, npr:.95, nyt:.95, 'washington-post':.95,
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


/* Scores are hashed off the domain, so a given company always reads the same
   and two different companies never read alike. */
function numbersFor(domain, brand) {
  const h = hash(String(domain || brand || 'stagwell').toLowerCase());
  return {
    seed: h,
    equity:   pick(h,        54, 73),
    aiVis:    pick(h >> 3,   31, 48),
    sov:      pick(h >> 6,   11, 23),
    gap:      pick(h >> 9,   34, 52),
    creators: pick(h >> 12, 640, 2400).toLocaleString(),
  };
}

/* Everything the analysis says, computed once from the answers. Both the
   report (A) and the dashboard (B) render from this object. */
function computeAnalysis(S) {
  const b = S.brand, c1 = S.comps[0] || 'the category leader', c2 = S.comps[1] || 'a challenger';
  const cat = S.data.category;
  const lead = Math.min(94, S.aiVis + S.gap);

  const models = MODELS.map((m, i) => {
    const me = pick(S.seed >> (i + 1), Math.max(12, S.aiVis - 18), Math.min(78, S.aiVis + 20));
    return { m, me, them: Math.min(96, me + pick(S.seed >> (i + 4), 14, 42)) };
  });

  const competitors = S.comps.map((c, i) => {
    const moves = ['Published category research picked up by three wire services.',
                   'Signed 18 creators to an exclusive always-on programme.',
                   'Shifted spend into news inventory at a 40% cost advantage.'];
    return {
      name: c,
      vis: Math.max(20, Math.min(94, lead - i * pick(S.seed >> (i + 2), 4, 13))),
      up: i !== 1,
      delta: pick(S.seed >> (i + 6), 2, 11),
      momentum: ['Accelerating','Steady','Accelerating'][i] || 'Steady',
      move: moves[i] || moves[0],
    };
  });

  const opps = [
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
  const leadOpp = opps.splice(S.focusLead || 0, 1)[0];
  if (leadOpp) opps.unshift(leadOpp);

  const solutions = [
    ['BERA.ai','Brand equity, priced','Ties perception movement to revenue so the board reads marketing as a P&L input, not a cost line.','Brand-to-Business'],
    ['GEOPulse / NewIndex','Visibility in AI answers','Tracks how eight models describe you against your set, daily, and shows what moves the number.','Answer-layer analytics'],
    ['SATS','The audience, resolved','A 260M identity graph turns a segment description into addressable, measurable people.','Activation'],
    ['IMAI','Creators, already yours','Finds the voices talking about you now and turns unpaid affinity into a managed programme.','Creator graph'],
    ['DoReel','Creative at the speed of insight','AI-produced UGC and presenter video, generated from the same brief you are reading.','Generative production'],
    ['NewVoices + Bestie','The conversation layer','Voice agents that arrive at a call already holding the full diagnosis.','Conversational AI'],
  ];

  const horizons = [
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

  const quotes = [
    [`“Reliable and widely available, though ${c1} is more often described as the leader in this space.”`, 'ChatGPT · verbatim'],
    [`“${b} appears in 2 of 10 answers about ${cat}; ${c1} appears in 7.”`, 'Perplexity · measured'],
    [`“Coverage of ${b} skews to product news. ${c2} owns the forward-looking narrative.”`, 'Gemini · verbatim'],
  ];

  return { b, c1, c2, cat, lead, models, competitors, opps, solutions, horizons, quotes,
           trends: [...S.data.trends, NEWS_TREND] };
}

return { esc, hash, pick, PARTNERS, EXT, partnerSrc, LOGO_SCALE, STUDIES, INDUSTRIES,
         DEFAULT_INDUSTRY, NEWS_TREND, KNOWN, ALIAS, SIGNALS, readWebsite, STATUS_LINES,
         MODELS, FOCUS, ROLES, numbersFor, computeAnalysis };
})();
