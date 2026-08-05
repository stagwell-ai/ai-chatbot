/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — PRODUCT CATALOGUE  (Option C only)
   Kept apart from shared.js so versions A and B are untouched by this work.

   Source of truth: Mark's C-level memo as relayed by Luis (3–4 Aug 2026) —
   Stagwell.ai is a landing page for the existing AI offerings, split in two:
     · Enterprise — the four Machines
     · The Marketing Cloud — point solutions
   Product detail from "TMC Product Overview.pdf" and sites.docx.
   ═══════════════════════════════════════════════════════════════════════════ */
window.SWC = (() => {
'use strict';

/* Each product carries the tags the router matches on:
   goal   — what the visitor said they want to move
   scale  — enterprise | midmarket | either
   Copy is written to be read by a CMO, not lifted from a datasheet. */

const PRODUCTS = [
  /* ── Enterprise · the Machines ─────────────────────────────────── */
  {
    id:'machine-os', name:'The Machine', suite:'enterprise',
    line:'The operating system for modern marketing',
    what:'Code and Theory’s enterprise OS, where context becomes the multiplier. One environment for strategy, creative and media rather than a dozen disconnected tools.',
    proof:'Enterprise deployment, built for organisations running marketing at scale.',
    url:'https://www.codeandtheory.com/introducing-the-machine-where-context-becomes-the-multiplier',
    goals:['speed','organise','growth'], scale:'enterprise',
  },
  {
    id:'knowledge-machine', name:'Pulse', badge:'The Knowledge Machine', suite:'enterprise',
    line:'Everything your organisation knows, answerable',
    what:'Turns the research, decks and data scattered across your teams into something you can simply ask a question of.',
    proof:'Marketing Cloud · enterprise knowledge layer.',
    url:'https://www.themarketingcloud.com/marketplace/pulse',
    goals:['organise','speed','understand'], scale:'enterprise',
  },
  {
    id:'targeting-machine', name:'SATS', badge:'The Targeting Machine', suite:'enterprise',
    line:'A 260M identity graph, made addressable',
    what:'Resolves a segment description into real, reachable, measurable people — and keeps them current.',
    proof:'Marketing Cloud · audience resolution and activation.',
    url:'https://www.themarketingcloud.com/marketplace/sats',
    goals:['audience','growth'], scale:'either',
  },
  {
    id:'media-machine', name:'The Media Machine', suite:'enterprise',
    line:'Planning and buying that answers to the brand',
    what:'Connects investment decisions to brand and business outcomes instead of channel metrics that flatter themselves.',
    proof:'Enterprise media planning and activation.',
    goals:['growth','audience'], scale:'enterprise',
  },

  /* ── The Marketing Cloud · point solutions ─────────────────────── */
  {
    id:'bera', name:'BERA.ai', suite:'cloud',
    line:'Brand equity, priced in dollars',
    what:'Ties perception movement to revenue with census-matched data, so the board reads marketing as a P&L input rather than a cost line.',
    proof:'10+ years of history · weekly, census-matched · Brand-to-Business™.',
    url:'https://bera.ai/',
    goals:['understand','growth'], scale:'either',
  },
  {
    id:'newindex', name:'NewIndex', suite:'cloud',
    line:'How AI answers describe you',
    what:'Tracks the way language models characterise your brand against your competitive set, and shows what moves the number.',
    proof:'Answer-layer visibility across the major models.',
    url:'https://newindex.ai',
    goals:['ai','understand'], scale:'either',
  },
  {
    id:'geopulse', name:'GEOPulse', suite:'cloud',
    line:'Show up where the answer is written',
    what:'Generative engine optimisation — the work of becoming the brand a model names first in your category.',
    proof:'Marketing Cloud · answer-layer optimisation.',
    url:'https://www.themarketingcloud.com/marketplace/geopulse',
    goals:['ai','growth'], scale:'either',
  },
  {
    id:'newintel', name:'NewIntel', suite:'cloud',
    line:'What your competitors did this week',
    what:'Live competitive signal — pricing, hiring, earned coverage, creator activity — rather than a quarterly deck that is already out of date.',
    proof:'Continuous competitive surveillance.',
    url:'https://newintel.ai',
    goals:['understand','growth'], scale:'either',
  },
  {
    id:'newvoices', name:'NewVoices', suite:'cloud',
    line:'Voice agents that hold a real conversation',
    what:'Outbound prospecting, inbound qualification and booking, running 24/7 inside your CRM. Deterministic, with a strict source-of-truth silo so it does not invent things.',
    proof:'In production across B2B sales orgs · $36k enterprise licence.',
    url:'https://newvoices.ai',
    goals:['talk','speed'], scale:'either',
  },
  {
    id:'agent-cloud', name:'Agent Cloud', suite:'cloud',
    line:'Ten marketing agents, and the models behind them',
    what:'Pre-built agents for planning, copy and message testing, plus Claude, ChatGPT and Gemini in one place — without your teams juggling a dozen subscriptions.',
    proof:'Connects to ClickUp, Slack and HubSpot · from $5k a year.',
    goals:['speed','organise'], scale:'either',
  },
  {
    id:'koalifyed', name:'IMAI', suite:'cloud',
    line:'Influencer Marketing AI',
    what:'Stagwell’s influencer platform — vetted creator discovery, campaign management and performance measurement in one place, so influencer spend is judged like any other media.',
    proof:'Influencer discovery, activation and measurement.',
    goals:['audience','growth'], scale:'either',
  },
  {
    id:'doreel', name:'DoReel', suite:'cloud',
    line:'Creative at the speed of the insight',
    what:'AI-produced presenter video and UGC, generated from the brief rather than three weeks after it.',
    proof:'Generative production.',
    url:'https://doreel.com',
    goals:['speed','growth'], scale:'either',
  },
  {
    id:'harrisquest', name:'HarrisQuest', suite:'cloud',
    line:'Ask the market, get an answer today',
    what:'Primary research on demand from HarrisX, at the speed a decision actually needs.',
    proof:'HarrisX · six markets.',
    url:'https://www.harrisquest.com/',
    goals:['understand','audience'], scale:'either',
  },
  {
    id:'people-platform', name:'Numetrix', badge:'The People Platform', suite:'cloud',
    line:'What people actually do, not what they say',
    what:'Consumer research joined to location intelligence, so audience decisions rest on real-world behaviour.',
    proof:'Measurement, mobility and visitation data.',
    goals:['audience','understand'], scale:'either',
  },
];

/* What the visitor is trying to move. This is the only judgement the machine
   cannot make from the website. */
const GOALS = [
  { id:'growth',     label:'Grow demand',                 line:'find the next points of growth' },
  { id:'understand', label:'Understand our brand',        line:'what the market believes about you' },
  { id:'ai',         label:'Show up in AI answers',       line:'how machines describe you' },
  { id:'audience',   label:'Reach the right people',      line:'who to reach, and where' },
  { id:'speed',      label:'Move faster',                 line:'the speed your team can actually work at' },
  { id:'talk',       label:'Talk to more customers',      line:'conversations at scale' },
];

const SCALES = [
  { id:'enterprise', label:'Global or enterprise',  note:'1,000+ people, multiple markets' },
  { id:'midmarket',  label:'Mid-market or scaling', note:'Under 1,000, one or two markets' },
];

/* Ranks the catalogue against the two answers and returns the top three.
   Deterministic — the same answers always produce the same stack. */
function match(goal, scale) {
  return PRODUCTS
    .map(p => {
      let score = 0;
      if (p.goals.includes(goal)) score += 10;
      if (p.goals[0] === goal) score += 4;                 // primary fit
      if (scale === 'enterprise' && p.suite === 'enterprise') score += 6;
      if (scale === 'midmarket'  && p.suite === 'cloud')      score += 6;
      if (p.scale === scale || p.scale === 'either') score += 2;
      if (p.scale === 'enterprise' && scale === 'midmarket') score -= 8;
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

const suiteName = s => s === 'enterprise' ? 'Enterprise · the Machines' : 'The Marketing Cloud';

return { PRODUCTS, GOALS, SCALES, match, suiteName };
})();
