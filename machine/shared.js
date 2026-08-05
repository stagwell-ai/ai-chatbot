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
  /* The peers named above are the brands a visitor is most likely to type into
     the head-to-head beat. Without a profile each one falls through to the
     Technology default, which reads as an obvious mistake on a famous name. */
  'adidas.com':  { name:'Adidas', legal:'adidas AG', ind:'Consumer & Retail', what:'Athletic footwear, apparel and sport lifestyle',
                   hq:'Herzogenaurach, Germany', founded:'1949', people:'~59,000', markets:'160+ countries',
                   pos:'Heritage performance brand competing on design collaborations',
                   audience:'Sport and streetwear 16–40, style-led',
                   tone:'Collaborative, culture-forward, design-led',
                   peers:['Nike','Puma','New Balance'], pages:45 },
  'lululemon.com':{ name:'Lululemon', legal:'lululemon athletica inc.', ind:'Consumer & Retail', what:'Technical athletic apparel and accessories',
                   hq:'Vancouver, Canada', founded:'1998', people:'~38,000', markets:'25+ countries',
                   pos:'Premium technical apparel defended by community and fit',
                   audience:'Affluent active 22–45, studio-led',
                   tone:'Considered, wellness-forward, community-first',
                   peers:['Nike','Alo Yoga','Vuori'], pages:31 },
  'samsung.com': { name:'Samsung', legal:'Samsung Electronics Co., Ltd.', ind:'Technology & Software', what:'Consumer electronics, displays and semiconductors',
                   hq:'Suwon, South Korea', founded:'1969', people:'~267,000', markets:'Global',
                   pos:'Breadth-led hardware leader competing on innovation cadence',
                   audience:'Mainstream 18–60 across every price tier',
                   tone:'Feature-forward, ambitious, technology-proud',
                   peers:['Apple','Google','Xiaomi'], pages:71 },
  'google.com':  { name:'Google', legal:'Google LLC', ind:'Technology & Software', what:'Search, advertising, cloud and consumer software',
                   hq:'Mountain View, California', founded:'1998', people:'~183,000', markets:'Global',
                   pos:'Distribution-led incumbent defending search economics',
                   audience:'Effectively everyone online',
                   tone:'Plain, helpful, capability-led',
                   peers:['Microsoft','OpenAI','Meta'], pages:88 },
  'microsoft.com':{ name:'Microsoft', legal:'Microsoft Corporation', ind:'Technology & Software', what:'Cloud platforms, productivity software and devices',
                   hq:'Redmond, Washington', founded:'1975', people:'~228,000', markets:'190+ countries',
                   pos:'Enterprise incumbent competing on integration and AI distribution',
                   audience:'IT decision-makers and knowledge workers',
                   tone:'Measured, enterprise-credible, outcome-led',
                   peers:['Google','Amazon','Salesforce'], pages:94 },
  'amazon.com':  { name:'Amazon', legal:'Amazon.com, Inc.', ind:'Consumer & Retail', what:'Online retail, marketplace, logistics and cloud',
                   hq:'Seattle, Washington', founded:'1994', people:'~1,550,000', markets:'Global',
                   pos:'Scale and convenience, defended by logistics and Prime',
                   audience:'Household buyers across every segment',
                   tone:'Functional, selection-led, relentlessly practical',
                   peers:['Walmart','Alibaba','Target'], pages:96 },
  'netflix.com': { name:'Netflix', legal:'Netflix, Inc.', ind:'Media & Entertainment', what:'Subscription streaming film and television',
                   hq:'Los Gatos, California', founded:'1997', people:'~14,000', markets:'190+ countries',
                   pos:'Originals-led scale, competing on retention economics',
                   audience:'Household subscribers 16–54',
                   tone:'Confident, talent-led, culturally quick',
                   peers:['Disney','Amazon Prime Video','Max'], pages:26 },
  'starbucks.com':{ name:'Starbucks', legal:'Starbucks Corporation', ind:'Consumer & Retail', what:'Coffee retail, beverages and packaged goods',
                   hq:'Seattle, Washington', founded:'1971', people:'~381,000', markets:'80+ markets',
                   pos:'Premium daily ritual defended by footprint and loyalty',
                   audience:'Urban and suburban 18–54, habit-led',
                   tone:'Warm, craft-forward, community-framed',
                   peers:['Dunkin’','Costa Coffee','Tim Hortons'], pages:37 },
  'unilever.com':{ name:'Unilever', legal:'Unilever PLC', ind:'Consumer & Retail', what:'Household, personal care and food brands',
                   hq:'London, United Kingdom', founded:'1929', people:'~128,000', markets:'190 countries',
                   pos:'House of brands competing on distribution and purpose',
                   audience:'Household decision-makers across all tiers',
                   tone:'Purpose-forward, brand-led, sustainability-framed',
                   peers:['Procter & Gamble','Nestlé','L’Oréal'], pages:58 },
  'wpp.com':     { name:'WPP', legal:'WPP plc', ind:'Marketing & Services', what:'Advertising, media investment and communications services',
                   hq:'London, United Kingdom', founded:'1985', people:'~108,000', markets:'100+ countries',
                   pos:'Scale holding company defending on integrated offer',
                   audience:'CMOs and procurement at global advertisers',
                   tone:'Corporate, scale-led, transformation-framed',
                   peers:['Omnicom','Publicis','Stagwell'], pages:49 },
  'booking.com': { name:'Booking.com', legal:'Booking Holdings Inc.', ind:'Travel & Hospitality', what:'Online accommodation and travel booking',
                   hq:'Amsterdam, Netherlands', founded:'1996', people:'~24,000', markets:'220+ countries',
                   pos:'Supply breadth and performance marketing at scale',
                   audience:'Price-aware travellers across every segment',
                   tone:'Direct, offer-led, urgency-framed',
                   peers:['Airbnb','Expedia','Agoda'], pages:42 },
  'stagwellglobal.com': { name:'Stagwell', legal:'Stagwell Inc.', ind:'Marketing & Services', what:'Marketing, communications and marketing technology',
                   hq:'New York, New York', founded:'2015', people:'~13,000', markets:'40+ countries',
                   pos:'Challenger network; technology-led alternative to the holding companies',
                   audience:'CMOs and marketing leadership at enterprise brands',
                   tone:'Direct, contrarian, evidence-forward',
                   peers:['WPP','Omnicom','Publicis'], pages:57 },
};
const ALIAS = { ldrs:'ldrsgroup.com', 'ldrs group':'ldrsgroup.com', nike:'nike.com', apple:'apple.com', airbnb:'airbnb.com', openai:'openai.com', tesla:'tesla.com',
  spotify:'spotify.com', delta:'delta.com', 'loreal':'loreal.com', "l'oréal":'loreal.com', stagwell:'stagwellglobal.com',
  adidas:'adidas.com', lululemon:'lululemon.com', samsung:'samsung.com', google:'google.com',
  microsoft:'microsoft.com', amazon:'amazon.com', netflix:'netflix.com', starbucks:'starbucks.com',
  unilever:'unilever.com', wpp:'wpp.com', booking:'booking.com', 'booking.com':'booking.com' };

/* One short line at a time — but naming what it is actually looking at. A
   generic wait proves nothing; a wait that says "Watching Adidas" is the
   evidence the read happened. */
function statusLines(S, kind = 'Executive AI Brief') {
  const V = voiceFor(S);
  const moves = pick(S.seed >> 11, 2, 6);
  return [
    `Reading ${S.domain} · ${S.pages} pages`,
    `Understanding ${S.brand} — ${String(S.industryLabel || 'the business').toLowerCase()}`,
    S.comps.length
      ? `Watching ${S.comps[0]} — ${moves} moves this week`
      : `Mapping the ${S.data.category} category`,
    S.query
      ? `Testing “${S.query.slice(0, 42)}” across eight models`
      : `Scoring ${V.pos} share of AI answers`,
    S.firstName
      ? `Writing for ${S.firstName}${S.role ? ` — ${S.roleArticle} altitude` : ''}`
      : `Preparing your ${kind}`,
  ];
}

/* Kept for anything still reading the old constant. */
const STATUS_LINES = ['Reading your website','Understanding your business',
  'Mapping your market','Reviewing your competitors','Preparing your Executive AI Brief'];

/* ── The crawl ──
   Paths the machine "fetched". Plausible per industry, picked deterministically
   off the seed so a given company always reads the same way twice. */
const CRAWL_COMMON = ['/', '/about', '/newsroom', '/careers', '/contact', '/sitemap.xml'];
const CRAWL_BY_IND = {
  'Consumer & Retail':     ['/products','/collections/new-arrivals','/men','/women','/stores','/sustainability'],
  'Technology & Software': ['/platform','/pricing','/docs','/integrations','/security','/customers'],
  'Travel & Hospitality':  ['/destinations','/stays','/deals','/loyalty','/experiences','/help'],
  'Financial Services':    ['/accounts','/cards','/rates','/investors','/security','/legal/terms'],
  'Media & Entertainment': ['/browse','/originals','/shows','/subscribe','/devices','/press'],
  'Automotive & Mobility': ['/models','/build-your-own','/dealers','/charging','/software','/warranty'],
  'Healthcare & Pharma':   ['/therapies','/pipeline','/patients','/healthcare-professionals','/research'],
  'Marketing & Services':  ['/work','/services','/case-studies','/insights','/team','/offices'],
};

function crawlFor(S) {
  const pool = [...CRAWL_COMMON, ...(CRAWL_BY_IND[S.industryLabel] || CRAWL_BY_IND['Technology & Software'])];
  const out = [];
  let h = S.seed || 1;
  const seen = new Set();
  while (out.length < 8 && seen.size < pool.length) {
    h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
    const i = h % pool.length;
    if (seen.has(i)) continue;
    seen.add(i);
    const path = pool[i];
    out.push({
      path,
      code: out.length === 5 ? 301 : 200,
      /* >>> not >>: h is an unsigned 32-bit hash, and a signed shift turns
         anything above 2^31 negative — which surfaced as "-103ms" on screen. */
      ms: pick(h >>> 4, 24, 210),
    });
  }
  return out;
}

/* ── Brand marks ──
   Real favicons, fetched live from the domain. This is the one place the demo
   genuinely reaches the internet, and it is what sells the rest of the fiction:
   the actual logo of the actual company they typed. */
const BRAND_DOMAIN = {
  'nike':'nike.com','adidas':'adidas.com','puma':'puma.com','new balance':'newbalance.com',
  'on running':'on-running.com','lululemon':'lululemon.com','alo yoga':'aloyoga.com','vuori':'vuoriclothing.com',
  'apple':'apple.com','samsung':'samsung.com','google':'google.com','microsoft':'microsoft.com',
  'xiaomi':'mi.com','meta':'meta.com','openai':'openai.com','anthropic':'anthropic.com',
  'google deepmind':'deepmind.google','mistral':'mistral.ai','salesforce':'salesforce.com',
  'servicenow':'servicenow.com','amazon':'amazon.com','walmart':'walmart.com','alibaba':'alibaba.com',
  'target':'target.com','netflix':'netflix.com','disney':'disney.com','spotify':'spotify.com',
  'apple music':'music.apple.com','youtube music':'music.youtube.com','amazon music':'music.amazon.com',
  'amazon prime video':'primevideo.com','max':'max.com','airbnb':'airbnb.com','booking.com':'booking.com',
  'expedia':'expedia.com','vrbo':'vrbo.com','marriott':'marriott.com','agoda':'agoda.com',
  'delta':'delta.com','united':'united.com','american airlines':'aa.com','southwest':'southwest.com',
  'tesla':'tesla.com','byd':'bydglobal.com','rivian':'rivian.com','volkswagen':'vw.com',
  'toyota':'toyota.com','bmw':'bmw.com','unilever':'unilever.com','procter & gamble':'pg.com',
  'l’oréal':'loreal.com',"l'oréal":'loreal.com','estée lauder':'elcompanies.com','shiseido':'shiseido.com',
  'nestlé':'nestle.com','starbucks':'starbucks.com','dunkin’':'dunkindonuts.com',
  'costa coffee':'costa.co.uk','tim hortons':'timhortons.com','jpmorgan chase':'jpmorganchase.com',
  'american express':'americanexpress.com','revolut':'revolut.com','pfizer':'pfizer.com',
  'novartis':'novartis.com','roche':'roche.com','wpp':'wpp.com','omnicom':'omnicomgroup.com',
  'publicis':'publicisgroupe.com','accenture song':'accenture.com','stagwell':'stagwellglobal.com',
  'wpromote':'wpromote.com','jellyfish':'jellyfish.com','brainlabs':'brainlabsdigital.com',
  'ldrs group':'ldrsgroup.com',
};

/* Name or domain in, best-guess domain out. A slug fallback is wrong sometimes,
   which is why every mark degrades to a monogram rather than a broken image. */
function domainFor(nameOrDomain) {
  const raw = String(nameOrDomain || '').trim();
  if (!raw) return '';
  const low = raw.toLowerCase();
  if (BRAND_DOMAIN[low]) return BRAND_DOMAIN[low];
  if (ALIAS[low]) return ALIAS[low];
  if (/^[a-z0-9-]+(\.[a-z]{2,})+$/.test(low)) return low;
  const slug = low.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  return slug ? slug + '.com' : '';
}

const faviconURL = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;

/* Monogram underneath, real favicon on top. wireMarks() strips the image if it
   never loads, so an unknown brand shows a letter instead of a broken box. */
function brandMark(nameOrDomain, size = 22) {
  const d = domainFor(nameOrDomain);
  const letter = String(nameOrDomain || '?').trim().charAt(0).toUpperCase() || '?';
  return `<span class="bmk" style="--bmk:${size}px" data-letter="${esc(letter)}">${
    d ? `<img src="${faviconURL(d)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''
  }</span>`;
}

function wireMarks(root) {
  (root || document).querySelectorAll('.bmk img:not([data-wired])').forEach(img => {
    img.dataset.wired = '1';
    img.addEventListener('error', () => img.remove());
    img.addEventListener('load', () => {
      /* the service answers unknown domains with a generic globe at 16px —
         treat that as a miss so the monogram wins instead */
      if (img.naturalWidth && img.naturalWidth <= 16) img.remove();
      else img.classList.add('is-on');
    });
  });
}

const MODELS = ['ChatGPT','Claude','Gemini','Perplexity','Copilot','Llama','Grok','DeepSeek'];


/* ═══════════════════ THE CONVERSATION ═══════════════════
   Three answers to "is this yours?" produce four report modes. The mode
   decides the pronouns, who the subject is, and which questions get asked —
   so the branches change WHICH questions you get, never how many. */

const RELATIONSHIP = [
  { key:'owner',    label:'That’s us' },
  { key:'rival',    label:'They’re a competitor' },
  { key:'observer', label:'Neither — I’m looking at the category' },
];

/* owner    one site, theirs                          — second person
   duel     two sites, head-to-head                   — second person, rival named
   recon    a rival's site, they kept theirs back     — third person
   category no stake, reading the market              — third person */
function modeFor(S) {
  if (S.rel === 'rival')    return S.viewerProfile ? 'duel' : 'recon';
  if (S.rel === 'observer') return 'category';
  return 'owner';
}
const FIRST_PERSON = m => m === 'owner' || m === 'duel';

/* Pronouns for every line the machine speaks and every line it writes. */
function voiceFor(S) {
  const m = S.mode || modeFor(S);
  return FIRST_PERSON(m)
    ? { m, sub:'you',  Sub:'You',  pos:'your',  Pos:'Your',  obj:'you',  mine:true  }
    : { m, sub:'they', Sub:'They', pos:'their', Pos:'Their', obj:'them', mine:false };
}

/* Six lenses. Labels shift with the mode so every one of them reads correctly
   whether the subject is you, a rival, or a category. */
const FOCUS = {
  ai: { lead:0, engine:'GEOPulse', section:'visibility', tab:'visibility',
    label:{ us:'How AI describes us', them:'How AI describes them', cat:'How AI describes this category' },
    line: { us:'how the machines describe you', them:'how the machines describe them', cat:'how the machines describe this category' },
    hint:/\bai\b|model|llm|chatgpt|gpt|answer|prompt|search|geo|visib/ },
  versus: { lead:0, engine:'NewIntel', section:'competitors', tab:'competitors',
    label:{ us:'How we stack up against rivals', them:'How they stack up against rivals', cat:'Who actually leads this category' },
    line: { us:'how you stand against the set you compete with', them:'how they stand against their set', cat:'who is actually winning this category' },
    hint:/compet|rival|versus|\bvs\b|stack|benchmark|against|share/ },
  perception: { lead:2, engine:'BERA', section:'visibility', tab:'visibility',
    label:{ us:'What people believe about us', them:'What people believe about them', cat:'What people believe about this category' },
    line: { us:'what the market currently believes about you', them:'what the market currently believes about them', cat:'what the market currently believes' },
    hint:/percept|believ|equity|reputat|think|feel|sentiment|trust/ },
  recent: { lead:0, engine:'NewIntel', section:'competitors', tab:'overview',
    label:{ us:'What we’ve been doing lately', them:'What they’ve been doing lately', cat:'What’s been moving lately' },
    line: { us:'what you have actually been doing lately', them:'what they have actually been doing lately', cat:'what has been moving in this category lately' },
    hint:/recent|lately|late|news|post|activ|month|week|day|moves?|launch/ },
  growth: { lead:1, engine:'SATS', section:'opps', tab:'opportunities',
    label:{ us:'Where the growth is', them:'Where their growth is', cat:'Where the growth is' },
    line: { us:'where the next points of growth actually sit', them:'where their next points of growth sit', cat:'where the growth in this category sits' },
    hint:/grow|revenue|opportun|expand|acquisi|scale|upside/ },
  risk: { lead:2, engine:'Future of News', section:'trends', tab:'market',
    label:{ us:'Where we’re exposed', them:'Where they’re exposed', cat:'Where this category is exposed' },
    line: { us:'where you are exposed', them:'where they are exposed', cat:'where this category is exposed' },
    hint:/risk|expos|safe|crisis|threat|worr|vulner|backlash|boycott/ },
};
const FOCUS_KEYS = Object.keys(FOCUS);
const voiceKey = m => FIRST_PERSON(m) ? 'us' : (m === 'category' ? 'cat' : 'them');
const focusLabel = (k, m) => FOCUS[k].label[voiceKey(m)];
const focusLine  = (k, m) => FOCUS[k].line[voiceKey(m)];

/* One beat, six mutually exclusive questions. Maximum apparent bespokeness for
   zero added length — whichever lens they lead with picks the question. */
const FOLLOWUPS = {
  ai: { capture:'query', placeholder:'best running shoes for flat feet',
    q:(S,V) => `One thing that will sharpen this. What should someone be able to ask a model and get <em>${esc(S.brand)}</em> as the answer?`,
    options:() => ['I’ll leave that to you'],
    ack:(S,V) => S.query
      ? `Good. I will run <em>“${esc(S.query)}”</em> across all eight models and show you exactly where ${V.sub} ${V.mine ? 'land' : 'land'}.`
      : `Fine — I will pick the prompts that matter most in this category.` },
  versus: { capture:'comps', placeholder:'A name, or press enter to keep mine',
    q:(S) => `I am benchmarking against <em>${S.comps.join('</em>, <em>')}</em> — anyone else you measure by?`,
    options:() => ['Those are right', 'Add someone I should watch'],
    ack:(S) => `Locked. NewIntel now has every move <em>${esc(S.comps[0] || 'the leader')}</em> made in the last seven days.` },
  perception: { capture:'belief', placeholder:'The belief you want to shift',
    q:(S,V) => `Is there a belief about <em>${esc(S.brand)}</em> ${V.mine ? 'you are' : 'you would want'} trying to change?`,
    options:() => ['Nothing specific — just read it'],
    ack:(S) => S.belief
      ? `Understood. I will price <em>“${esc(S.belief)}”</em> against what the market actually believes.`
      : `Then I will tell you what the market believes without being led.` },
  recent: { capture:'window', placeholder:'A window',
    q:() => `How far back should I look?`,
    options:() => ['Last 30 days','Last 90 days','The past year'],
    ack:(S) => `Right — <em>${esc(S.windowLabel)}</em>. That is the window on every figure in here.` },
  growth: { capture:'growthMode', placeholder:'Where growth should come from',
    q:(S,V) => `Where is the growth meant to come from?`,
    options:() => ['A new audience','A new market','More from the ones we already have'],
    ack:(S) => `Noted — <em>${esc(S.growthMode)}</em>. I will rank the plays against that.` },
  risk: { capture:'worry', placeholder:'What worries you',
    q:(S,V) => `Anything specific ${V.mine ? 'worrying you' : 'you are watching for'}?`,
    options:() => ['Nothing specific — show me'],
    ack:(S) => S.worry
      ? `Understood. I will look hardest at <em>“${esc(S.worry)}”</em>.`
      : `Then I will show you the exposure the category keeps missing.` },
};

const WINDOWS = { 'Last 30 days':'30 days', 'Last 90 days':'90 days', 'The past year':'12 months' };

const ROLES = ['Chief Marketing Officer','VP / Head of Marketing','Founder or CEO','Communications & PR lead'];

/* Turn whatever came back from the focus beat into one or two lens keys.
   Free text is matched on intent, then kept verbatim for the report. */
function parseFocus(text, mode) {
  const parts = String(text).split(/\s·\s|\s*,\s*|\s+and\s+/i).map(t => t.trim()).filter(Boolean);
  const keys = [];
  parts.forEach(p => {
    const low = p.toLowerCase();
    let k = FOCUS_KEYS.find(x => focusLabel(x, mode).toLowerCase() === low)
         || FOCUS_KEYS.find(x => FOCUS[x].hint.test(low));
    if (k && !keys.includes(k)) keys.push(k);
  });
  return keys.slice(0, 2);
}

/* A loose check — enough to catch a typo, never enough to trap anyone. */
const okEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s).trim());
function nameFromEmail(addr) {
  const local = String(addr).split('@')[0] || '';
  const first = local.split(/[._\-+0-9]+/).filter(Boolean)[0] || '';
  const clean = first.replace(/[^\p{L}'’-]/gu, '');
  /* A single letter is an initial, not a name — better to address nobody. */
  return clean.length > 1 ? clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() : '';
}

/* ── The one real call ──
   Everything else in this prototype is scripted. This asks a live model the
   visitor's own prompt through /api/ask, which holds the key server-side.
   Returns null on any failure so the caller falls back to the script — a demo
   must never hang or show a stack trace. */
async function askLive(prompt, brands) {
  try {
    const r = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, brands }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.ok && d.answer ? d : null;
  } catch { return null; }
}

/* ── Live quotes ──
   Three real questions about the subject, fired in parallel while the loader
   runs, so "What the models say" stops being fiction. Each resolves to
   {q, answer, model, ms} or null; the caller keeps scripted copy for any gap. */
function liveQuoteQuestions(S) {
  const b = S.brand, c1 = S.comps[0] || 'its closest rival';
  return [
    `What is ${b} known for?`,
    `Who is the leader in ${S.data.category} right now — ${b} or ${c1}?`,
    `What are ${b}'s biggest weaknesses?`,
  ];
}
function fetchLiveQuotes(S) {
  const guard = p => Promise.race([p, new Promise(r => setTimeout(() => r(null), 9500))]);
  return Promise.all(liveQuoteQuestions(S).map(q =>
    guard(askLive(q, [S.brand, S.comps[0]].filter(Boolean)))
      .then(d => d ? { q, answer: d.answer, model: d.model, ms: d.ms } : null)
  ));
}

/* ── GEOPulse mini-audit ──
   The share-of-answers figure is modelled; this is the same question asked for
   real. Three buying-intent prompts, no brand named in them — unprompted recall
   is the only version of the number worth quoting — fired at one live model
   while the loader runs. The category is clamped so the prompts stay short
   enough to read in a single line. */
function auditPrompts(S) {
  const cat = String(S.data.category || 'the category').slice(0, 34);
  return [
    `best ${cat} brands`,
    `which ${cat} brand should I buy from`,
    `most recommended ${cat} companies`,
  ];
}
/* Resolved calls only: a prompt that never came back is left out rather than
   counted as an absence, so hits/total is always over answers we actually saw.
   Nothing back at all returns null and the audit leaves no trace. */
function fetchAudit(S) {
  const guard = p => Promise.race([p, new Promise(r => setTimeout(() => r(null), 9500))]);
  const brands = [S.brand, S.comps[0]].filter(Boolean);
  const mine = String(S.brand || '').toLowerCase();
  return Promise.all(auditPrompts(S).map(prompt =>
    guard(askLive(prompt, brands)).then(d => d ? {
      prompt, answer: d.answer, model: d.model, ms: d.ms,
      hit: (d.named || []).some(n => String(n).toLowerCase() === mine),
    } : null)
  )).then(all => {
    const rows = all.filter(Boolean);
    if (!rows.length) return null;
    return { rows, hits: rows.filter(r => r.hit).length, total: rows.length };
  });
}

/* ── Follow-up chat ──
   The composer under a finished brief answers in character. The context is
   typed fields — the server composes the actual system prompt from them. */
function chatContext(S) {
  const A = { lead: Math.min(94, S.aiVis + S.gap) };
  return {
    brand: S.brand, domain: S.domain, industry: S.industryLabel,
    reader: S.firstName, role: S.role, mine: voiceFor(S).mine,
    equity: String(S.equity), aiVis: String(S.aiVis), sov: String(S.sov),
    lead: String(A.lead), creators: S.creators,
    rival: S.comps[0] || '',
    query: S.query || '',
    hit: !!(S.live && S.live.named && S.live.named.some(
      n => n.toLowerCase() === String(S.brand).toLowerCase())),
  };
}
async function chatAsk(question, S) {
  try {
    const r = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: question, brands: [S.brand, ...S.comps].filter(Boolean),
                             chat: true, context: chatContext(S) }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.ok && d.answer ? d : null;
  } catch { return null; }
}

/* ── The live executive summary ──
   The summary paragraph is the most-read sentence-and-a-half in the brief, and
   it has always been a template. This asks the model to write it for this
   session instead, down the same chat path — the server's system prompt already
   carries every figure, so the instruction only has to say what the paragraph
   is for. It runs while the loader talks and falls back to the template. */
function summaryPrompt(S) {
  const lens = focusLine(S.focus[0] || 'ai', S.mode || modeFor(S));
  const who = S.firstName || 'the reader';
  /* whichever of the three the visitor actually gave us — the same cascade the
     scripted paragraph uses, so the live one never acknowledges less */
  const said = (S.challenge || S.belief || S.worry || '').slice(0, 90);
  return [
    `Write the executive summary paragraph of this brief for ${who}.`,
    `Lead on ${lens}.`,
    `Cover the tension between strong brand equity and weak AI visibility using the exact figures you hold.`,
    said ? `The reader described the problem as “${said}” — acknowledge it.` : '',
    `End on the cheapest fix.`,
    `70 to 100 words, one paragraph, plain text, no greeting, no markdown.`,
  ].filter(Boolean).join(' ');
}

/* The judgement call. A weak or off-shape paragraph in the first thing anyone
   reads is worse than the template, so anything that smells wrong is thrown
   away rather than shown: it has to be the right length, it has to name the
   subject, it has to carry at least one of the figures it was given, and it
   must not open like a chat assistant or wander into links and markdown. */
function validSummary(text, S) {
  const t = String(text || '').trim();
  if (t.length < 200 || t.length > 900) return false;
  if (/https?:\/\/|www\.\w|\S+@\S+\.\w/i.test(t)) return false;
  if (/[*#|]|^\s*[-–•]\s/.test(t)) return false;
  if (/\n/.test(t)) return false;                                  // one paragraph
  if (/^(i\s|i’|i'|as stagwell|as an ai|sure[,!.]|certainly|here('s| is)|hi\b|hello\b|dear\b)/i.test(t)) return false;
  if (/\b(i cannot|i can’t|i can't|i do not have|i don’t have|as a language model)\b/i.test(t)) return false;
  const low = t.toLowerCase();
  const brand = String(S.brand || '').toLowerCase();
  if (brand.length > 1 && !low.includes(brand)) return false;
  /* at least one real number out of the brief, not just any digit */
  const figures = [S.equity, S.aiVis, S.sov, Math.min(94, S.aiVis + S.gap)].map(String);
  if (!figures.some(n => new RegExp(`(^|\\D)${n}(\\D|$)`).test(t))) return false;
  return true;
}

function fetchSummary(S) {
  const guard = p => Promise.race([p, new Promise(r => setTimeout(() => r(null), 9500))]);
  /* composing the instruction happens inside the chain on purpose: a surprise in
     the state object then resolves to null like any other miss, instead of
     throwing into the loader that is waiting on it */
  return Promise.resolve()
    .then(() => guard(chatAsk(summaryPrompt(S), S)))
    .then(d => (d && validSummary(d.answer, S))
      ? { text: d.answer, model: d.model, ms: d.ms } : null)
    .catch(() => null);
}

/* Three safe questions so there is always something to tap in the room. */
function chatChips(S) {
  const V = voiceFor(S), b = S.brand, c1 = S.comps[0] || 'the leader';
  return V.mine
    ? [`Why is ${c1} ahead of us in AI answers?`,
       `What should we do first?`,
       `What does this cost us if we do nothing?`]
    : [`Why is ${c1} ahead of ${b}?`,
       `What should ${b} do first?`,
       `Where is ${b} most exposed?`];
}

/* The read-back. Every row the visitor steered, in the order they steered it. */
function specRows(S) {
  const V = voiceFor(S);
  const rows = [['Subject', `${S.brand} · ${S.domain}`, null]];
  if (S.mode === 'duel')  rows.push(['Head to head', `${S.rivalProfile.name} · ${S.rivalProfile.domain}`, 'viewerSite']);
  if (S.mode === 'recon') rows.push(['Angle', 'Straight read on a competitor', 'viewerSite']);
  if (S.mode === 'category') rows.push(['Angle', `${S.industryLabel} — category read`, null]);
  rows.push(['Leading on', S.focus.map(k => focusLabel(k, S.mode)).join(', then '), 'focus']);
  if (S.query)      rows.push(['Tested prompt', `“${S.query}”`, 'followup']);
  if (S.belief)     rows.push(['Belief to shift', `“${S.belief}”`, 'followup']);
  if (S.worry)      rows.push(['Watching for', `“${S.worry}”`, 'followup']);
  if (S.growthMode) rows.push(['Growth from', S.growthMode, 'followup']);
  if (S.windowLabel)rows.push(['Window', S.windowLabel, 'followup']);
  if (S.focus.includes('versus') && S.comps.length) rows.push(['Benchmark set', S.comps.join(', '), 'followup']);
  if (S.role)       rows.push(['Written for', S.firstName ? `${S.firstName}, ${S.role}` : S.role, 'role']);
  else if (S.firstName) rows.push(['Written for', S.firstName, 'email']);
  rows.push(['Sending to', S.email || '—', 'email']);
  return rows;
}

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

/* Signals the machine "reads off the site" to place an unfamiliar company. */
const SIGNALS = [
  /* "studio" used to live here too, which meant rule 7 could never claim a film
     studio — the word was spoken for before Media & Entertainment was tested. */
  [/(media|agency|group|creative|brand|comms|^pr|marketing|labs?)/,        'Marketing & Services'],
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
  const V = voiceFor(S);
  const win = S.windowLabel ? (WINDOWS[S.windowLabel] || '30 days') : '30 days';
  const primary = (S.focus && S.focus[0]) || 'ai';

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

  /* Live quotes when the loader managed to fetch them, scripted stand-ins for
     any that failed. The third element marks a quote as genuinely live so the
     renderers can badge it — the two claims must stay distinguishable. */
  const scriptedQuotes = [
    [`“Reliable and widely available, though ${c1} is more often described as the leader in this space.”`, 'ChatGPT · verbatim', false],
    [`“${b} appears in 2 of 10 answers about ${cat}; ${c1} appears in 7.”`, 'Perplexity · measured', false],
    [`“Coverage of ${b} skews to product news. ${c2} owns the forward-looking narrative.”`, 'Gemini · verbatim', false],
  ];
  const liveQ = (S.liveQuotes || []).filter(Boolean).map(x => [
    `“${esc(x.answer)}”`,
    `${esc(x.model)} · asked “${esc(x.q)}” · ${x.ms}ms`,
    true,
  ]);
  const quotes = [...liveQ, ...scriptedQuotes].slice(0, 3);

  /* The prompt they typed, run back at them. Deterministic off the same seed so
     the answer is stable, and always a loss — that is the whole point of it. */
  const tested = S.query ? {
    prompt: S.query,
    rank: pick(S.seed >> 8, 4, 9),
    named: MODELS.filter((m, i) => pick(S.seed >> (i + 3), 0, 9) > 6),
    winner: c1,
    /* live is the genuine answer from /api/ask when one came back. It names
       brands; the chart above names models. Never merge the two. */
    live: S.live || null,
  } : null;

  /* Hoist the section they asked to lead with. Everything else keeps its order. */
  const SECTIONS = ['visibility','competitors','trends','opps','solutions','studies','horizons'];
  const want = FOCUS[primary].section;
  const order = [want, ...SECTIONS.filter(s => s !== want)];

  return { b, c1, c2, cat, lead, models, competitors, opps, solutions, horizons, quotes,
           trends: [...S.data.trends, NEWS_TREND],
           V, win, primary, tested, order,
           leadLine: focusLine(primary, S.mode || modeFor(S)) };
}

/* ─────────────────────── WHAT-IF SLIDER ───────────────────────
   "What closing the gap is worth" — a client-side projection, not a fresh
   read. t (0..1) stands in for two quarters of corrected citation supply;
   the maths below is the only place the projection is defined, so the
   report (A) and the dashboard (B) can never disagree with each other. */

/* Deterministic, no randomness: closes 85% of the visibility gap at full
   slide and never lets the projection pass the rival it is chasing. */
function whatIfAt(S, A, t) {
  const projAiVis = Math.round(S.aiVis + (A.lead - S.aiVis) * 0.85 * t);
  const projSov = Math.round(S.sov + 14 * t);
  const gapRemaining = Math.max(0, A.lead - projAiVis);
  const gapClosed = Math.round(85 * t);
  return { projAiVis, projSov, gapRemaining, gapClosed };
}

/* Markup only — no numbers are wired here, so re-rendering it never resets
   a visitor's place on the slider. Pass wrap:true to size it as a full
   dashboard panel (B); omit it to sit inside the brief's opportunity list (A). */
function whatIfHTML(S, A, opts = {}) {
  const start = whatIfAt(S, A, 0);
  return `
  <div class="whatif${opts.wrap ? ' pnl g12' : ''}">
    <div class="whatif__head">
      <span class="whatif__flag"><i></i>Projection · modelled</span>
      <h3 class="whatif__title">What closing the gap is worth</h3>
    </div>
    <div class="whatif__slide">
      <input type="range" class="whatif__range" min="0" max="100" value="0" step="1"
        aria-label="Quarters of corrected citation supply">
      <div class="whatif__ends"><span>Today</span><span>Two quarters of citation supply</span></div>
    </div>
    <div class="whatif__stats">
      <div class="whatif__stat">
        <span class="whatif__k">AI visibility</span>
        <span class="whatif__v"><b class="whatif__aivis">${start.projAiVis}</b><small>%</small></span>
        <div class="whatif__bar">
          <i class="whatif__fill" style="width:${start.projAiVis}%"></i>
          <span class="whatif__ghost" style="left:${A.lead}%"><em>${esc(A.c1)}</em></span>
        </div>
      </div>
      <div class="whatif__stat">
        <span class="whatif__k">Points behind ${esc(A.c1)}</span>
        <span class="whatif__v"><b class="whatif__gap">${start.gapRemaining}</b></span>
      </div>
      <div class="whatif__stat">
        <span class="whatif__k">Share of voice</span>
        <span class="whatif__v"><b class="whatif__sov">${start.projSov}</b><small>%</small></span>
      </div>
    </div>
    <p class="whatif__note">This is the position today.</p>
    <p class="whatif__fine">Modelled from this diagnosis. A projection, not a promise — the workspace tracks the real number weekly.</p>
  </div>`;
}

/* Wires whichever .whatif block is inside root. Drag moves four readouts and
   a track fill — nothing here touches innerHTML, so it stays smooth under
   the pointer even mid-drag. */
function wireWhatIf(root, S, A) {
  const box = (root || document).querySelector('.whatif');
  if (!box) return;
  const range = box.querySelector('.whatif__range');
  const aivisEl = box.querySelector('.whatif__aivis');
  const gapEl = box.querySelector('.whatif__gap');
  const sovEl = box.querySelector('.whatif__sov');
  const fillEl = box.querySelector('.whatif__fill');
  const noteEl = box.querySelector('.whatif__note');

  const paint = v => {
    range.style.background = `linear-gradient(90deg, var(--teal) ${v}%, var(--line) ${v}%)`;
  };

  const render = v => {
    const t = v / 100;
    const { projAiVis, projSov, gapRemaining, gapClosed } = whatIfAt(S, A, t);
    aivisEl.textContent = projAiVis;
    gapEl.textContent = gapRemaining;
    sovEl.textContent = projSov;
    fillEl.style.width = projAiVis + '%';
    paint(v);

    noteEl.innerHTML = t < 0.15
      ? 'This is the position today.'
      : t <= 0.8
        ? (projAiVis > 50
            ? `At this point ${esc(A.b)} is named in more answers than it misses.`
            : `The gap is closing — ${gapClosed}% of it gone.`)
        : `Within reach of ${esc(A.c1)} — and every point of it comes from earned citation, the cheapest lever on this page.`;
  };

  range.addEventListener('input', () => render(+range.value));
  render(+range.value);
}

/* ─────────────────────── MOTION ───────────────────────
   Small, shared, and quiet. Numbers should arrive rather than appear. */

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Counts an element's number up to whatever it already says, keeping any
   prefix or suffix intact: "43%", "1,662", "+23pts", "2.1×". */
function countUp(el, duration = 1100) {
  const raw = el.dataset.count || el.textContent.trim();
  el.dataset.count = raw;
  const m = raw.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/s);
  if (!m) return;
  const [, pre, numStr, post] = m;
  const target = parseFloat(numStr.replace(/,/g, ''));
  if (!isFinite(target)) return;
  if (REDUCE) { el.textContent = raw; return; }

  const decimals = (numStr.split('.')[1] || '').length;
  const grouped = numStr.includes(',');
  const fmt = v => {
    const n = Number(v.toFixed(decimals));
    return grouped ? n.toLocaleString('en-US', { minimumFractionDigits: decimals }) : n.toFixed(decimals);
  };
  const t0 = performance.now();
  el.textContent = pre + fmt(0) + post;
  const tick = now => {
    const p = Math.min(1, (now - t0) / duration);
    el.textContent = pre + fmt(target * (1 - Math.pow(1 - p, 3))) + post;
    if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
  };
  requestAnimationFrame(tick);
}

/* Splits a headline into words so it can arrive out of a blur rather than
   simply appearing. Markup inside the heading is preserved. */
function blurWords(el, delay = 0) {
  if (REDUCE) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = el.dataset.words || el.innerHTML;
  el.dataset.words = tmp.innerHTML;
  let i = 0;
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.nodeValue.split(/(\s+)/).forEach(w => {
        if (!w.trim()) return frag.appendChild(document.createTextNode(w));
        const sp = document.createElement('span');
        sp.className = 'wd'; sp.textContent = w;
        sp.style.animationDelay = `${delay + i++ * 62}ms`;
        frag.appendChild(sp);
      });
      n.replaceWith(frag);
    } else walk(n);
  });
  walk(tmp);
  el.innerHTML = tmp.innerHTML;
}

/* Runs a callback the first time each element is seen. */
function whenVisible(els, fn, opts = {}) {
  const list = [...els];
  if (!list.length) return;
  if (REDUCE || !('IntersectionObserver' in window)) return list.forEach(fn);
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
  }, { threshold: 0.25, ...opts });
  list.forEach(el => io.observe(el));
}

/* Registers elements to rise into view. Critically, the hiding is applied HERE
   rather than in the stylesheet: anything that is never registered simply
   renders as normal. A blanket opacity:0 in CSS means any element rendered
   later by script — and missed by an observer — disappears permanently. */
function reveal(els, root) {
  const list = [...els];
  if (!list.length) return;
  if (REDUCE || !('IntersectionObserver' in window)) {
    return list.forEach(el => el.classList.add('is-in'));
  }
  list.forEach((el, i) => {
    el.classList.add('will-reveal');
    if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', i % 8);
  });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); e.target.classList.add('is-in'); } });
  }, { threshold: 0.15, root: root || null });
  list.forEach(el => io.observe(el));
}

/* Counts every .num inside a container as it comes into view. */
const countAllIn = root =>
  whenVisible((root || document).querySelectorAll('.num'), el => countUp(el));

return { esc, hash, pick, countUp, whenVisible, countAllIn, blurWords, reveal, REDUCE, PARTNERS, EXT, partnerSrc, LOGO_SCALE, STUDIES, INDUSTRIES,
         DEFAULT_INDUSTRY, NEWS_TREND, KNOWN, ALIAS, SIGNALS, readWebsite, STATUS_LINES,
         MODELS, FOCUS, ROLES, numbersFor, computeAnalysis,
         RELATIONSHIP, FOCUS_KEYS, FOLLOWUPS, WINDOWS, modeFor, voiceFor, FIRST_PERSON,
         voiceKey, focusLabel, focusLine, parseFocus, okEmail, nameFromEmail, specRows,
         statusLines, crawlFor, domainFor, faviconURL, brandMark, wireMarks, askLive,
         fetchLiveQuotes, auditPrompts, fetchAudit, chatAsk, chatChips, fetchSummary, whatIfAt, whatIfHTML, wireWhatIf };
})();
