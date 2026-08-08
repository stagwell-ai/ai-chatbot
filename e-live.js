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
   dead socket resolves like any other miss. */
const TIMEOUT = 12000;

/* ══════════════════════ THE QUESTION ══════════════════════
   Local, no network. The visitor writes a marketing brief; a shopper writes a
   buying question. This turns one into the other, brand-blind — naming the
   brand in the prompt would answer the question before it is asked. */

/* The mapping is a table so a new signal is one row, not another branch. */
const SIGNALS = [
  { hint: /\b(share|shares|rival|rivals|competitor|competitors|versus|vs)\b/,
    q: 'which brand should I buy from in this category' },
  { hint: /\b(creator|creators|influencer|influencers|campaign|campaigns|launch|launching)\b/,
    q: 'which brands do creators actually recommend' },
  { hint: /\b(call|calls|caller|callers|customer|customers|voice|support|service)\b/,
    q: 'which company has the best customer service in this space' },
];
const FALLBACK = 'best brands in this category';

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
function post(body) {
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
  return Promise.race([call, new Promise(r => setTimeout(() => r(null), TIMEOUT))]);
}

/* ══════════════════════ ASK ══════════════════════
   The derived question, put to a live model as a shopper would put it. No
   brands are sent: the point is what the model volunteers unprompted.
   A wall of text is a miss too — the card holds a short answer. */
function ask(prompt) {
  return Promise.resolve()
    .then(() => post({ prompt: String(prompt == null ? '' : prompt), brands: [] }))
    .then(d => {
      if (!d) return null;
      const answer = String(d.answer || '').trim();
      if (!answer || answer.length > 900) return null;
      return { answer, model: d.model, ms: d.ms };
    })
    .catch(() => null);
}

/* ══════════════════════ FINDINGS ══════════════════════
   The three rows on the results card, written by the model about the sentence
   the visitor actually typed. This runs down the chat path, so the server
   composes the persona from typed fields — chatSystem() reads brand and
   industry, and an empty object would have it introduce itself as the author
   of a brief about "the brand" in category "general". Two fields fix that. */
function findingsPrompt(sentence) {
  const s = String(sentence == null ? '' : sentence).slice(0, 200);
  return `You are the analysis layer of a marketing platform. A customer asked: "${s}". Write exactly three findings explaining what is going wrong, as JSON: [{"lead":"...","detail":"..."},...]. Each lead is a punchy claim under 8 words ending with a period. Each detail is one concrete sentence under 25 words with one plausible specific figure. Respond with ONLY the JSON array.`;
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
      context: { brand: 'the customer', industry: 'their category' },
    }))
    .then(d => {
      if (!d) return null;
      const rows = validRows(d.answer);
      return rows ? { rows, model: d.model, ms: d.ms } : null;
    })
    .catch(() => null);
}

return { deriveQuestion, ask, findings };
})();
