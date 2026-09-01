/* ═══════════════════════════════════════════════════════════════════════════
   /api/ask — the one part of this demo that is real.
   Runs a visitor's prompt against a live model and returns which brands the
   answer actually names. The key stays here: putting it in the client would
   publish it to anyone who opens devtools.

   Five modes, one endpoint:
     (default)          buyer-research answer + which of `brands` it named
     body.chat          the composer answering follow-ups on a finished brief
     mode:'classify'    visitor text → domain ids + company + size + human ask
     mode:'research'    a website domain → what the model actually knows
     mode:'product'     a solutions.json id + a question → the agent answering
                        about that product, from that entry and nothing else

   Every system prompt is assembled HERE, from typed fields, and never
   accepted from the client. That is the security boundary: a client-supplied
   system prompt would let anyone repurpose the endpoint with a devtools
   one-liner. The classify domain list is hardcoded below for the same reason —
   it is the vocabulary the router trusts, so the client does not get to
   extend it. mode:'product' takes the same line one step further: the client
   sends an ID, never a fact. Every product word in the prompt is read from
   data/solutions.json on this side of the wire, so a devtools caller cannot
   put a capability, a statistic or a price into the agent's mouth.

   Config comes from Vercel environment variables:
     LLM_API_KEY    required
     LLM_BASE_URL   default https://api.kimi.com/coding/v1  (OpenAI-compatible)
     LLM_MODEL      default kimi-for-coding-highspeed — ~2.8s end to end
   ═══════════════════════════════════════════════════════════════════════════ */

/* The product catalogue, imported rather than fetched: a static import is
   traced by the build, so the JSON ships inside the function and there is no
   runtime file read to go wrong in a serverless sandbox. It is the SAME file
   machine/solution.js renders the page from, which is the point — the page
   and the agent cannot drift apart. */
import SOLUTIONS_FILE from '../data/solutions.json' with { type: 'json' };

const BASE  = (process.env.LLM_BASE_URL || 'https://api.kimi.com/coding/v1').replace(/\/+$/, '');
const MODEL = process.env.LLM_MODEL || 'kimi-for-coding-highspeed';
const KEY   = process.env.LLM_API_KEY || '';

/* Answer fast and name names — the demo needs brands it can highlight, and a
   long essay stalls the reveal. */
const SYSTEM = [
  'You answer buyer research questions the way a general-purpose assistant would.',
  'Name specific real brands or products. Be decisive and concrete.',
  'Reply in 2-3 short sentences, under 70 words.',
  'Plain text only: no markdown, no asterisks, no bullet points, no preamble.',
].join(' ');

/* Collapse whitespace and strip any markdown that slips through — the answer
   is rendered as text, so asterisks would show up literally. */
const clean = s => String(s == null ? '' : s)
  .replace(/\*\*|__|`+/g, '')
  .replace(/^#+\s*/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

/* Which of the brands we care about did the model actually mention?
   Word-boundary match so "On" does not match "Only" and "Max" not "Maximum". */
function named(answer, brands) {
  const hay = ' ' + answer.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
  return brands.filter(b => {
    const t = String(b).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    return t.length > 1 && hay.includes(' ' + t + ' ');
  });
}

/* ── chat mode ──
   After the brief is built, the composer answers follow-ups in character.
   The system prompt is assembled HERE from typed fields, never accepted from
   the client — a client-supplied system prompt would let anyone repurpose the
   endpoint (or the demo) with a devtools one-liner. */
const f = (v, n) => clean(v).slice(0, n);
function chatSystem(c) {
  const brand = f(c.brand, 40) || 'the brand';
  const rival = f(c.rival, 40) || 'the market leader';
  const lines = [
    `You are Stagwell AI, the analysis machine on Stagwell's website. You have just`,
    `produced an executive brief and the reader is asking follow-up questions.`,
    `Subject: ${brand} (${f(c.domain, 60) || 'their site'}), category ${f(c.industry, 40) || 'general'}.`,
    c.reader ? `Reader: ${f(c.reader, 40)}${c.role ? ', ' + f(c.role, 40) : ''}${
      c.mine === false ? ` — researching ${brand}, does not work there` : ` at ${brand}`}.` : '',
    `The brief found: brand equity ${f(c.equity, 4) || '60'}/100 against a category mean of 58;`,
    `${brand} named in ${f(c.aiVis, 4) || '40'}% of relevant AI answers where ${rival} is named`,
    `in ${f(c.lead, 4) || '80'}%; share of voice ${f(c.sov, 4) || '15'}%, flat for three quarters;`,
    `${f(c.creators, 8) || 'over a thousand'} creators mention ${brand} with no commercial relationship.`,
    c.query ? `A live test of the prompt "${f(c.query, 120)}" ${c.hit ? 'did name' : 'did not name'} ${brand}.` : '',
    `The diagnosis: the gap is a supply problem in earned citation — models cite wire services`,
    `and quality journalism far above owned content. The fix runs through earned media,`,
    `creator programmes, and news adjacency.`,
    `Answer in 2 to 4 short sentences, plain text only — no markdown, no bullet points.`,
    `Be specific and confident. Use the figures above; do not invent new precise statistics.`,
    `Stagwell's engines (GEOPulse, NewIntel, BERA, IMAI, DoReel, SATS, NewVoices) may be`,
    `recommended where natural, never more than one per answer.`,
    `If the question is unrelated to brand or marketing strategy, answer it in one sentence`,
    `and steer back to the brief.`,
  ];
  return lines.filter(Boolean).join(' ');
}

/* ═══════════════════════════════════════════════════════════════════════════
   STRICT-JSON MODES — classify and research
   Both ask the model for one JSON object and nothing else, and both assume
   it will occasionally not comply. Nothing downstream ever sees a parse
   error: a mangled answer comes back as ok:false and the client falls through
   to its offline path (engine.js keyword classifier / seeded fiction).
   ═══════════════════════════════════════════════════════════════════════════ */

/* The router's whole vocabulary, hardcoded server-side. Ids mirror
   data/routing.json `domains[].id`; the one-line meanings are its labels in
   the words a buyer would use. The client never supplies this list — if it
   could, it could invent a domain the routing matrix has no cell for. */
export const CLASSIFY_DOMAINS = [
  ['brand_health', 'track brand health, equity and awareness; benchmark against competitors'],
  ['competitive', 'comparing the brand against named rivals — benchmarking, share, competitive blind spots'],
  ['research', 'run their own research — surveys, polls, concept and message testing'],
  ['business_impact', "prove the brand's business impact — pricing power, revenue, market value, ROI"],
  ['audiences', 'reach better audiences — build and activate segments from first-party data'],
  ['influencer', 'influencer and creator marketing'],
  ['reputation', 'protect reputation — see risks before they become stories'],
  ['media_monitoring', 'monitor what is said about them globally, across markets and languages'],
  ['ai_visibility', 'show up in AI answers — ChatGPT, Gemini, Perplexity'],
  ['real_world_behavior', 'measure real-world behaviour — store visits, foot traffic, the say/do gap'],
  ['marketing_ops', 'connect marketing operations into one system — workflows, media, knowledge'],
];

export const CLASSIFY_IDS = CLASSIFY_DOMAINS.map(d => d[0]);

const CLASSIFY_SYSTEM = [
  'You classify a marketing buyer\'s message for a routing system.',
  'Choose zero or more of EXACTLY these domain ids — never invent one:',
  CLASSIFY_DOMAINS.map(([id, meaning]) => `- ${id}: ${meaning}`).join('\n'),
  'A message can carry several domains at once; list them strongest first.',
  'Choose none rather than guessing: an empty array is a correct answer.',
  'Also extract, only if the message actually states them:',
  '- company: the company website domain mentioned (e.g. "nike.com"), else null.',
  '- employees: the employee count as a plain number, else null.',
  '- human: true only if they ask to speak to a person, book a call, or contact sales.',
  'Reply with ONE JSON object and nothing else — no prose, no code fences:',
  '{"domains":[],"company":null,"employees":null,"human":false}',
].join('\n');

const RESEARCH_SYSTEM = [
  'You are given a company website domain. Report ONLY what you already know',
  'about that company. This feeds a product that must never state a fact about',
  'a real company that it invented.',
  'If you do not recognise the domain, or are not confident it is a company you',
  'know, set known to false and every other field to null or an empty array.',
  'Never guess a name, a size, an industry or a competitor. Guessing is worse',
  'than an empty answer.',
  'competitors: up to 3 real, well-known competitor brand names, and only if you',
  'genuinely know the company. Names only, no descriptions.',
  'employees: your best-known approximate headcount as a plain number, else null.',
  'Reply with ONE JSON object and nothing else — no prose, no code fences:',
  '{"known":false,"name":null,"employees":null,"industry":null,"competitors":[]}',
].join('\n');

/* ═══════════════════════════════════════════════════════════════════════════
   mode:'product' — the agent answering a question ABOUT ONE PRODUCT, on that
   product's own /s/{id} page.

   The client sends { productId, question, history? } and nothing else that
   could reach the model as a fact. The id is resolved HERE against
   data/solutions.json; an id the file does not carry is a 400, never a
   free-text product the caller invented. Every sentence of the brief below
   is quoted out of that one entry.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SOLUTIONS = (() => {
  const raw = SOLUTIONS_FILE && Array.isArray(SOLUTIONS_FILE.solutions)
    ? SOLUTIONS_FILE.solutions : [];
  return raw.filter(s => s && typeof s.id === 'string' && s.id);
})();

export const findSolution = id => {
  const want = String(id == null ? '' : id).trim();
  if (!want) return null;
  return SOLUTIONS.find(s => s.id === want) || null;
};

/* The rules, in the order they matter. Two of them are the site's whole
   character restated for a model that has never read the rest of it:
   nothing outside the brief is a fact, and "I don't know" is a complete
   answer that hands the visitor to a person. The last rule is the client's
   ask — the conversation exists to bring them back into the flow, so every
   answer has to end pointing somewhere. */
export function productSystem(s) {
  const props = (Array.isArray(s.valueProps) ? s.valueProps : [])
    .map(p => clean(p)).filter(Boolean).slice(0, 8);
  const byDomain = Object.values(s.positioningByDomain || {})
    .map(p => clean(p)).filter(Boolean).slice(0, 3);

  const facts = [
    `Product name: ${f(s.name, 80)}.`,
    s.positioning ? `Positioning: ${f(s.positioning, 600)}` : '',
    s.whoFor ? `Who it is for: ${f(s.whoFor, 160)}.` : '',
    props.length ? `What it does: ${props.join('; ')}.` : '',
    byDomain.length ? `Also positioned as: ${byDomain.join(' ')}` : '',
    s.signupUrl ? 'There is a self-serve free trial.'
      : 'There is no self-serve trial — the next step is a conversation with our team.',
  ].filter(Boolean);

  return [
    'You are Stagwell AI, the agent on Stagwell.AI, talking to a visitor who is',
    `reading the page for one product: ${f(s.name, 80)}. This is the ONLY thing you know about it:`,
    '',
    facts.join('\n'),
    '',
    'RULES, all of them binding:',
    '- Answer ONLY from the facts above. They are the complete brief.',
    '- Never invent a statistic, a price, a customer name, an integration, a',
    '  timeline or a capability. If it is not written above, you do not know it.',
    '- If the question asks for something the brief does not answer, say so',
    '  plainly in one sentence and offer to have a human from the team answer it.',
    '- 2 to 4 short sentences. Plain text only: no markdown, no asterisks, no',
    '  bullet points, no headings, no preamble.',
    `- Talk about ${f(s.name, 80)} in the second person to the visitor. Be concrete and calm, never salesy.`,
    '- ALWAYS end by moving the visitor forward: ask for their website so you can',
    '  read their brand before recommending anything, or ask the next thing you',
    '  need to know about their situation (what they are trying to solve, how big',
    '  their team is, when they need it). One forward question, at the end.',
    '- If they ask about a different product, or about something other than',
    '  marketing, answer in one sentence and ask for their website so the',
    '  conversation can find them the right fit.',
  ].join('\n');
}

/* The visitor's own words, plus the exchange so far so a follow-up
   ("what about the second one?") has a referent. The transcript is DATA: it
   is fenced into the user message, never the system prompt, and it is capped
   so a long paste cannot crowd the rules out of the context. */
export function productUser(question, history) {
  const turns = (Array.isArray(history) ? history : []).slice(-6).map(h => {
    const who = (h && String(h.role || '').toLowerCase() === 'agent') ? 'Agent' : 'Visitor';
    const text = f(h && h.text, 300);
    return text ? `${who}: ${text}` : '';
  }).filter(Boolean);

  const q = f(question, 400);
  if (!turns.length) return q;
  return `Earlier in this conversation:\n${turns.join('\n')}\n\nTheir question now: ${q}`;
}

/* Reasoning models pad the front of an answer, wrap it in fences, apologise
   first, or emit a <think> block. Take the widest brace span left after the
   obvious wrappers come off, then retry once with the usual dirt (smart
   quotes, trailing commas) normalised. Returns null rather than throwing —
   an unparseable answer is a fallback, never a 500. */
export function parseLooseJSON(raw) {
  if (raw == null) return null;
  let s = String(raw);
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, ' ');   /* hidden reasoning */
  s = s.replace(/```[a-z]*\s*/gi, ' ').replace(/```/g, ' ');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) return null;
  const span = s.slice(a, b + 1);
  try { return JSON.parse(span); } catch { /* one more try */ }
  const patched = span
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false');
  try { return JSON.parse(patched); } catch { return null; }
}

/* "https://www.Nike.com/uk" → "nike.com". Anything that is not a hostname —
   a bare company name, a sentence, an empty string — is null, because the
   only thing the client does with this field is start research on it. */
export function asDomain(v) {
  if (v == null) return null;
  const m = String(v).trim().toLowerCase()
    .match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*\.[a-z]{2,})(?:[/?#]|$)/);
  return m ? m[1] : null;
}

const asCount = v => {
  const n = typeof v === 'string' ? Number(v.replace(/[,\s]/g, '')) : v;
  return typeof n === 'number' && isFinite(n) && n > 0 ? Math.round(n) : null;
};

/* Shape-check whatever came back. Unknown ids are dropped rather than
   rejected — a model that adds one good id and one hallucinated one should
   still be useful. */
export function normalizeClassify(obj) {
  const o = obj && typeof obj === 'object' ? obj : {};
  const seen = [];
  (Array.isArray(o.domains) ? o.domains : []).forEach(d => {
    const id = String(d == null ? '' : d).trim();
    if (CLASSIFY_IDS.indexOf(id) !== -1 && seen.indexOf(id) === -1) seen.push(id);
  });
  return {
    domains: seen,
    company: asDomain(o.company),
    employees: asCount(o.employees),
    human: o.human === true || o.human === 'true',
  };
}

export function normalizeResearch(obj) {
  const o = obj && typeof obj === 'object' ? obj : {};
  const known = o.known === true || o.known === 'true';
  const str = (v, n) => {
    const s = clean(v);
    return s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'unknown' ? s.slice(0, n) : null;
  };
  const competitors = (Array.isArray(o.competitors) ? o.competitors : [])
    .map(c => str(c, 60)).filter(Boolean).slice(0, 3);
  /* known:false means the model told us it does not recognise the domain.
     Honour that completely — any fields it filled in anyway are guesses. */
  if (!known) return { known: false, name: null, employees: null, industry: null, competitors: [] };
  return {
    known: true,
    name: str(o.name, 80),
    employees: asCount(o.employees),
    industry: str(o.industry, 60),
    competitors,
  };
}

/* One completion, all the failure modes already flattened into a result
   object. The existing default/chat path keeps its own inline call — this
   helper exists for the two new modes and deliberately does not touch it. */
async function complete(system, user, maxTokens, timeoutMs) {
  const ac = new AbortController();
  const bail = setTimeout(() => ac.abort(), timeoutMs || 12000);
  try {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        temperature: 1,          /* the gateway rejects anything but 1 */
        stream: false,
      }),
    });
    const raw = await r.text();
    if (!r.ok) return { ok: false, error: 'upstream_' + r.status };
    let data; try { data = JSON.parse(raw); } catch { return { ok: false, error: 'bad_json' }; }
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'empty' };
    return { ok: true, content: String(content), model: data.model || MODEL };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(bail);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  if (!KEY) {
    /* Not an error the visitor should ever see — the client falls back to the
       scripted result and the demo carries on. */
    res.status(200).json({ ok: false, error: 'not_configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const mode = clean(body.mode).toLowerCase();

  /* ── mode:'classify' — visitor text → routing vocabulary ──
     Body: { mode:'classify', prompt }. The prompt is the visitor's own words
     and nothing else; the instructions live in CLASSIFY_SYSTEM above. */
  if (mode === 'classify') {
    const text = clean(body.prompt).slice(0, 300);
    if (!text) { res.status(400).json({ ok: false, error: 'no_prompt' }); return; }
    const started = Date.now();

    /* 800, not the 1,100 the answer path uses: the payload is one short JSON
       object, but this gateway is a reasoning model that spends 200-400
       tokens thinking before it writes anything, and an exhausted budget
       returns an empty string rather than an error. 800 clears the observed
       tail on a task this small with room to spare. */
    const out = await complete(CLASSIFY_SYSTEM, text, 800, 12000);
    if (!out.ok) { res.status(200).json({ ok: false, error: out.error }); return; }

    const parsed = parseLooseJSON(out.content);
    if (!parsed) { res.status(200).json({ ok: false, error: 'unparseable' }); return; }

    res.status(200).json(Object.assign({ ok: true }, normalizeClassify(parsed), {
      model: out.model, ms: Date.now() - started,
    }));
    return;
  }

  /* ── mode:'research' — a website domain → what the model actually knows ──
     Body: { mode:'research', domain }. known:false is a first-class answer,
     not a failure: the client draws its seeded fiction instead and labels the
     confidence low. Nothing here is ever allowed to invent a real company. */
  if (mode === 'research') {
    const domain = asDomain(body.domain);
    if (!domain) { res.status(400).json({ ok: false, error: 'bad_domain' }); return; }
    const started = Date.now();

    const out = await complete(RESEARCH_SYSTEM, domain, 900, 12000);
    if (!out.ok) { res.status(200).json({ ok: false, error: out.error }); return; }

    const parsed = parseLooseJSON(out.content);
    if (!parsed) { res.status(200).json({ ok: false, error: 'unparseable' }); return; }

    res.status(200).json(Object.assign({ ok: true, domain }, normalizeResearch(parsed), {
      model: out.model, ms: Date.now() - started,
    }));
    return;
  }

  /* ── mode:'product' — the agent answering about one solutions.json entry ──
     Body: { mode:'product', productId, question, history? }. The client sends
     an ID; the facts are read here. An unknown id is a 400 rather than a
     silent generic answer — a page that cannot name its product should get
     the scripted fallback, not an improvised one. Every other failure is the
     same ok:false the other modes return, so the panel degrades instead of
     dead-ending. */
  if (mode === 'product') {
    const solution = findSolution(body.productId);
    if (!solution) { res.status(400).json({ ok: false, error: 'unknown_product' }); return; }

    const question = clean(body.question).slice(0, 400);
    if (!question) { res.status(400).json({ ok: false, error: 'no_question' }); return; }
    const started = Date.now();

    /* 1,100, matching the default answer path: a few short sentences, plus
       the 200-400 tokens this gateway spends thinking before it writes. */
    const out = await complete(
      productSystem(solution),
      productUser(question, body.history),
      1100, 12000
    );
    if (!out.ok) { res.status(200).json({ ok: false, error: out.error }); return; }

    const answer = clean(out.content);
    if (!answer) { res.status(200).json({ ok: false, error: 'empty' }); return; }

    res.status(200).json({
      ok: true,
      answer,
      productId: solution.id,
      model: out.model,
      ms: Date.now() - started,
    });
    return;
  }

  /* 300 is plenty for a typed question. Chat mode also carries instructions the
     client composes — the executive summary asks for a lens, a quote back, and
     a shape — and a prompt guillotined mid-sentence loses exactly the part that
     says how long the answer should be. */
  const prompt = clean(body.prompt).slice(0, body.chat ? 600 : 300);
  const brands = Array.isArray(body.brands) ? body.brands.slice(0, 8).map(clean).filter(Boolean) : [];
  if (!prompt) {
    res.status(400).json({ ok: false, error: 'no_prompt' });
    return;
  }

  /* body.chat + body.context switches the persona from "a general-purpose
     assistant answering a buyer" to "Stagwell AI discussing the brief". */
  const system = body.chat ? chatSystem(body.context || {}) : SYSTEM;

  /* A demo cannot hang. Give up at 9s and let the script take over. */
  const ac = new AbortController();
  const bail = setTimeout(() => ac.abort(), 12000);
  const started = Date.now();

  try {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        /* reasoning_content runs 200-400 tokens on a short answer but was
           measured between 738 and 1,852 on the summary-writing task with the
           full system prompt — high-variance, and any run that exhausts the
           budget mid-thought returns an empty string. Chat mode gets headroom
           well past the observed tail. */
        max_tokens: body.chat ? 3200 : 1100,
        /* the gateway rejects anything but 1 */
        temperature: 1,
        stream: false,
      }),
    });

    const raw = await r.text();
    if (!r.ok) {
      res.status(200).json({ ok: false, error: 'upstream_' + r.status,
        detail: raw.slice(0, 300) });
      return;
    }

    let data; try { data = JSON.parse(raw); } catch {
      res.status(200).json({ ok: false, error: 'bad_json' }); return;
    }

    const answer = clean(data?.choices?.[0]?.message?.content);
    if (!answer) { res.status(200).json({ ok: false, error: 'empty' }); return; }

    res.status(200).json({
      ok: true,
      answer,
      named: named(answer, brands),
      model: data.model || MODEL,
      ms: Date.now() - started,
    });
  } catch (e) {
    res.status(200).json({ ok: false,
      error: e.name === 'AbortError' ? 'timeout' : 'network' });
  } finally {
    clearTimeout(bail);
  }
}
