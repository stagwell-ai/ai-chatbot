/* ═══════════════════════════════════════════════════════════════════════════
   SCHEMAS — the typed contract every model must satisfy (brief §14).

   Dependency-free validators (the repo has no build step and no runtime
   packages; a hand validator is the approved equivalent of Zod here — brief
   §60). Each returns the normalised object or null. Null is a provider
   failure: the broker moves to the next model, and the last one falls to
   deterministic mode. Unknown ids are dropped, not rejected: a model that adds
   one good intent and one invented one is still useful.
   ═══════════════════════════════════════════════════════════════════════════ */

const str = (v, n) => {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s || /^(null|none|unknown|n\/a)$/i.test(s)) return null;
  return s.slice(0, n || 200);
};
const num01 = v => {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
};
const ids = (arr, allowed) => {
  const out = [];
  (Array.isArray(arr) ? arr : (arr == null ? [] : [arr])).forEach(x => {
    const id = str(x, 60);
    if (id && allowed.indexOf(id) !== -1 && out.indexOf(id) === -1) out.push(id);
  });
  return out;
};
const band = (v, allowed) => { const s = str(v, 40); return s && allowed.indexOf(s) !== -1 ? s : null; };

/* LlmInterpretationSchema — brief §14 */
export function validateInterpretation(obj, vocab) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const inf = obj.inferred && typeof obj.inferred === 'object' ? obj.inferred : {};
  const out = {
    detectedGoals: ids(obj.detectedGoals, vocab.goalIds),
    detectedIntents: ids(obj.detectedIntents, vocab.intentIds),
    inferred: {
      industry: str(inf.industry, 80),
      companySize: band(inf.companySize, vocab.sizeBands),
      creatorProgramSize: band(inf.creatorProgramSize, vocab.creatorBands),
      geographicScope: band(inf.geographicScope, vocab.geoBands)
    },
    userNeedSummary: str(obj.userNeedSummary, 300),
    confidence: num01(obj.confidence)
  };
  /* the summary and the confidence are required by the contract; a model that
     returns neither has not answered the question */
  if (out.userNeedSummary == null) out.userNeedSummary = '';
  if (out.confidence == null) out.confidence = out.detectedIntents.length ? 0.5 : 0;
  const shapeOk = 'detectedIntents' in obj || 'detectedGoals' in obj || 'inferred' in obj;
  return shapeOk ? out : null;
}

/* KimiResponseSchema — brief §14: a phrased message plus up to five suggestion labels */
export function validateResponse(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const message = str(obj.message, 600);
  if (!message) return null;
  const labels = (Array.isArray(obj.suggestionLabels) ? obj.suggestionLabels : []).map(x => str(x, 60)).filter(Boolean).slice(0, 5);
  return { message, suggestionLabels: labels };
}

/* The "why this fits" explanation (brief §44): one or two plain sentences,
   no markdown, and — checked by the caller — nothing the catalog does not say. */
export function validateExplanation(obj) {
  const raw = obj && typeof obj === 'object' ? obj.why : obj;
  let s = str(raw, 420);
  if (!s) return null;
  s = s.replace(/\*\*|__|`+|^#+\s*/g, '').replace(/^["“]|["”]$/g, '').trim();
  if (s.length < 20) return null;
  if (/https?:\/\//i.test(s)) return null;               /* the model never writes a URL */
  if (/\$\s?\d|\d+\s?%|\d{2,}\s?(percent|users|customers|clients)/i.test(s)) return null;   /* no invented figures */
  return { why: s };
}
