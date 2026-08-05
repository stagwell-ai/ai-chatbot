/* ═══════════════════════════════════════════════════════════════════════════
   /api/ask — the one part of this demo that is real.
   Runs a visitor's prompt against a live model and returns which brands the
   answer actually names. The key stays here: putting it in the client would
   publish it to anyone who opens devtools.

   Config comes from Vercel environment variables:
     LLM_API_KEY    required
     LLM_BASE_URL   default https://api.kimi.com/coding/v1  (OpenAI-compatible)
     LLM_MODEL      default kimi-for-coding-highspeed — ~2.8s end to end
   ═══════════════════════════════════════════════════════════════════════════ */

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
