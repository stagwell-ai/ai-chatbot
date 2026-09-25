/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION E  ·  the live layer

   Everything network lives here; every call returns null on any failure, so
   the run can never hang or error. The agent above this file is scripted and
   stays scripted — these are the two surfaces where a real model speaks: the
   question a shopper would type, asked for real, and the three findings the
   model writes about what the visitor just said.
   ═══════════════════════════════════════════════════════════════════════════ */
window.ELIVE = (() => {
'use strict';

/* The server clips a chat prompt at 600 chars and a plain one at 300, and it
   gives up on the model at 12s — this side gives up at the same moment so a
   dead socket resolves like any other miss. converse() below asks for less
   patience: a stray "hi" cannot hold up the gate the way a brief can. */
const TIMEOUT = 12000;
const CONVERSE_TIMEOUT = 8000;

/* ══════════════════════ THE PERSONA ══════════════════════
   The demo is anchored to one visitor: Nike's CMO. Everything below reads
   from this table rather than hard-coding the brand a second time. */
const PERSONA = {
  brand: 'Nike',
  domain: 'nike.com',
  industry: 'running shoes & athletic apparel',
  category: 'running shoes',
  rivals: ['Adidas', 'Hoka', 'On', 'New Balance', 'Brooks'],
};
/* singular form of the category, for the two fallbacks that read more
   naturally as "running shoe brands" / "running shoe company" than the
   plural — derived rather than hand-typed a second time */
const PERSONA_CATEGORY_SINGULAR = PERSONA.category.replace(/s$/, '') || PERSONA.category;

/* ══════════════════════ THE QUESTION ══════════════════════
   Local, no network. The visitor writes a marketing brief; a shopper writes a
   buying question. This turns one into the other, brand-blind — naming the
   brand in the prompt would answer the question before it is asked. The
   fallbacks are category-specific (Nike's CMO cares about running shoes,
   not "this category" in the abstract) but never name Nike or a rival —
   that blindness is what makes the model's answer honest. */

/* The mapping is a table so a new signal is one row, not another branch. */
const SIGNALS = [
  { hint: /\b(share|shares|rival|rivals|competitor|competitors|versus|vs)\b/,
    q: `best ${PERSONA.category} for daily training` },
  { hint: /\b(creator|creators|influencer|influencers|campaign|campaigns|launch|launching)\b/,
    q: `which ${PERSONA_CATEGORY_SINGULAR} brands do creators actually recommend` },
  { hint: /\b(call|calls|caller|callers|customer|customers|voice|support|service)\b/,
    q: `which ${PERSONA_CATEGORY_SINGULAR} company has the best customer service` },
];
const FALLBACK = `best ${PERSONA.category}`;

/* words that carry no category on their own — dropped off the front */
const LEAD = /^(the|a|an|our|my|your|their|his|her|its|us|me|them|it|more|better|some|any)$/;
/* where the noun phrase ends: the sentence has moved on to something else */
const CUT  = /^(and|or|but|so|because|when|while|which|who|whose|where|what|if|that|with|without|for|in|on|at|to|from|by|is|are|was|were|we|they|i|you|he|she)$/;

/* The phrase after "for" is usually the category the visitor sells into.
   A capitalised word inside it is almost always a brand, and a brand in the
   prompt defeats the point of asking, so the whole phrase is dropped. */
function categoryAfterFor(sentence) {
  const re = /\bfor\s+((?:[\w'’-]+\s+){0,4}[\w'’-]+)/gi;
  let m;
  /* every "for" in the sentence gets a turn — the first one is often "for us" */
  while ((m = re.exec(sentence))) {
    /* step back to just past this "for" so a later one is not swallowed by the
       words this match claimed */
    re.lastIndex = m.index + 3;
    const words = m[1].split(/\s+/).filter(Boolean);
    while (words.length && LEAD.test(words[0].toLowerCase())) words.shift();
    const out = [];
    for (const w of words) {
      const c = w.replace(/[^\w'’-]+/g, '');
      if (!c || CUT.test(c.toLowerCase())) break;
      if (/^[A-Z]/.test(c) || /\d/.test(c)) { out.length = 0; break; }
      out.push(c.toLowerCase());
      if (out.length === 4) break;
    }
    const phrase = out.join(' ').trim();
    if (phrase.length > 2 && phrase.length < 40) return phrase;
  }
  return '';
}

const clamp = t => (String(t).length > 88 ? String(t).slice(0, 88).trim() : String(t)) || FALLBACK;

function deriveQuestion(sentence) {
  const s = String(sentence == null ? '' : sentence);
  const cat = categoryAfterFor(s);
  if (cat) return clamp('best ' + cat);
  const hit = SIGNALS.find(r => r.hint.test(s.toLowerCase()));
  return clamp(hit ? hit.q : FALLBACK);
}

/* ══════════════════════ THE ONE FETCH ══════════════════════
   Both live surfaces go through here. Anything that is not a clean ok:true
   with an answer — a 500, a bad body, a thrown fetch, a model that ran out of
   budget mid-thought and returned nothing — comes back as null. */
function post(body, ms = TIMEOUT) {
  const call = (async () => {
    try {
      const r = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d && d.ok && d.answer ? d : null;
    } catch { return null; }
  })();
  return Promise.race([call, new Promise(r => setTimeout(() => r(null), ms))]);
}

/* ══════════════════════ ASK ══════════════════════
   The derived question, put to a live model as a shopper would put it.
   Nike plus its five rivals ride along as the brands the server checks the
   answer against (6 names, well inside the server's 8-name cap) — the
   prompt itself still names none of them, so what comes back is whatever
   the model volunteers unprompted. A wall of text is a miss too — the card
   holds a short answer. */
function ask(prompt) {
  return Promise.resolve()
    .then(() => post({
      prompt: String(prompt == null ? '' : prompt),
      brands: [PERSONA.brand, ...PERSONA.rivals],
    }))
    .then(d => {
      if (!d) return null;
      const answer = String(d.answer || '').trim();
      if (!answer || answer.length > 900) return null;
      return { answer, named: Array.isArray(d.named) ? d.named : [], model: d.model, ms: d.ms };
    })
    .catch(() => null);
}

/* ══════════════════════ FINDINGS ══════════════════════
   The three rows on the results card, written by the model about the sentence
   the visitor actually typed. This runs down the chat path, so the server
   composes the persona from typed fields — chatSystem() reads brand, domain
   and industry, and an empty object would have it introduce itself as the
   author of a brief about "the brand" in category "general". Three fields
   fix that, and now name the visitor's actual brand: Nike.

   Chat mode clips the prompt to 600 chars server-side (see api/ask.js). The
   scaffold below is 410 chars; the sentence slice adds up to 180 more, for a
   worst case of 590 — 10 chars of headroom under the 600 cap. */
function findingsPrompt(sentence) {
  const s = String(sentence == null ? '' : sentence).slice(0, 180);
  return `You are the analysis layer of ${PERSONA.brand}'s marketing platform. ${PERSONA.brand}'s CMO asked: "${s}". Write exactly three findings about ${PERSONA.brand}'s position in ${PERSONA.category} explaining what is going wrong, as JSON: [{"lead":"...","detail":"..."},...]. Each lead is a punchy claim under 8 words ending with a period. Each detail is one concrete sentence under 25 words with one plausible specific figure. Respond with ONLY the JSON array.`;
}

/* fences, prose either side of the array, a model that answered in sentences */
const BAD = /```|https?:\/\/|www\.\w|\S+@\S+\.\w/i;

/* The judgement call, in the house spirit: three rows that are the wrong shape
   read worse than the scripted three, so anything short of a clean parse and
   three distinct, sized, link-free rows is thrown away and the script runs. */
function validRows(text) {
  const t = String(text || '').replace(/```[a-z]*/gi, ' ');
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a < 0 || b <= a) return null;
  let arr; try { arr = JSON.parse(t.slice(a, b + 1)); } catch { return null; }
  if (!Array.isArray(arr) || arr.length !== 3) return null;
  const rows = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
    const lead = typeof it.lead === 'string' ? it.lead.trim() : '';
    const detail = typeof it.detail === 'string' ? it.detail.trim() : '';
    if (!lead || !detail) return null;
    if (lead.length > 60 || detail.length > 180) return null;
    if (BAD.test(lead) || BAD.test(detail)) return null;
    rows.push({ lead, detail });
  }
  /* three ways of saying the same thing is one finding, not three */
  const seen = rows.map(r => r.lead.toLowerCase());
  if (new Set(seen).size !== rows.length) return null;
  return rows;
}

function findings(sentence) {
  return Promise.resolve()
    .then(() => post({
      prompt: findingsPrompt(sentence),
      brands: [],
      chat: true,
      context: { brand: PERSONA.brand, domain: PERSONA.domain, industry: PERSONA.industry },
    }))
    .then(d => {
      if (!d) return null;
      const rows = validRows(d.answer);
      return rows ? { rows, model: d.model, ms: d.ms } : null;
    })
    .catch(() => null);
}

/* ══════════════════════ CONVERSE ══════════════════════
   The conversational gate (e.js) hands this whatever the CMO typed when it
   is not a campaign directive — "is this an llm", "hi", "how does this work".
   One short in-character reply, same chat persona fields as findings() uses,
   but on an 8s leash: a stray greeting cannot hold up the gate the way a
   brief can, so this races the server's own 12s budget with a shorter one.

   Chat mode clips the prompt to 600 chars server-side (see api/ask.js). The
   scaffold below is 443 chars; the typed-text slice adds up to 140 more, for
   a worst case of 583 — 17 chars of headroom under the 600 cap. */
function conversePrompt(text) {
  const s = String(text == null ? '' : text).slice(0, 140);
  return `You are The Agent, ${PERSONA.brand}'s marketing AI in this demo. The CMO typed: "${s}". Not a campaign directive — do not invent campaign work. Reply in at most 2 short sentences, in character, plainly and honestly (if asked what you are: this demo turns an outcome sentence into a campaign run; parts of it are enacted, but this reply and two run steps really do come from a live model). End by inviting an outcome sentence. No lists, no markdown, no quotes.`;
}

/* Strips whatever wrapping a model adds around a one-line answer: a code
   fence, then any run of straight or typographic quote marks off each end,
   repeated in case both got applied. Bounded so a pathological string of
   quote characters cannot loop. */
function unwrapReply(text) {
  let t = String(text == null ? '' : text).trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const EDGE_QUOTE = /^["'“”‘’`]|["'“”‘’`]$/;
  for (let i = 0; i < 5 && t.length > 1 && EDGE_QUOTE.test(t[0]) && EDGE_QUOTE.test(t[t.length - 1]); i++) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function converse(text) {
  return Promise.resolve()
    .then(() => post({
      prompt: conversePrompt(text),
      brands: [],
      chat: true,
      context: { brand: PERSONA.brand, domain: PERSONA.domain, industry: PERSONA.industry },
    }, CONVERSE_TIMEOUT))
    .then(d => {
      if (!d) return null;
      const reply = unwrapReply(d.answer);
      if (!reply) return null;
      if (reply.length > 320) return null;
      if (reply[0] === '[') return null;
      if (BAD.test(reply)) return null;
      return { reply, model: d.model, ms: d.ms };
    })
    .catch(() => null);
}

/* ══════════════════════ BRAND MARK ══════════════════════
   Pure, no network — the favicon service is hit by the browser at render
   time when this URL lands in an <img src>. Mirrors the domainFor/faviconURL
   pattern in machine/shared.js: a dot means the caller already passed a
   domain, otherwise it's a brand name and ".com" is the best guess. */
function markURL(brandOrDomain) {
  const v = String(brandOrDomain == null ? '' : brandOrDomain).trim();
  const domain = v.includes('.') ? v : v.toLowerCase().replace(/\s+/g, '') + '.com';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

return { PERSONA, deriveQuestion, ask, findings, converse, markURL };
})();
