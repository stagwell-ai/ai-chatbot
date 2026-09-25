/* The loose JSON reader every strict-JSON mode relies on. Reasoning models pad
   the front of an answer, wrap it in fences, apologise first, or emit a
   <think> block. Take the widest brace span left after the obvious wrappers
   come off, then retry once with the usual dirt (smart quotes, trailing
   commas) normalised. Returns null rather than throwing — an unparseable
   answer is a provider failure, never a 500. (Moved out of api/ask.js so the
   broker can share it; ask.js re-exports it.) */
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
