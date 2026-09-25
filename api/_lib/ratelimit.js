/* A small per-instance token bucket for the two public endpoints (brief §48:
   "rate-limit chat and lead endpoints"). Serverless instances do not share
   memory, so this bounds one instance's abuse rather than the world's — the
   honest limit of what a no-dependency function can do; an edge/WAF rule is
   the production answer and is listed in KIMI.md. */
const buckets = new Map();
const MAX_KEYS = 5000;

export function clientKey(req) {
  const h = req.headers || {};
  const xf = String(h['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || String(h['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || 'unknown';
}

/* allow `limit` requests per `windowMs` per key; returns { ok, retryAfterMs } */
export function allow(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start >= windowMs) { b = { start: now, n: 0 }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > MAX_KEYS) { const first = buckets.keys().next().value; buckets.delete(first); }
  if (b.n > limit) return { ok: false, retryAfterMs: Math.max(0, b.start + windowMs - now) };
  return { ok: true, retryAfterMs: 0 };
}

export function limited(req, res, limit, windowMs) {
  const r = allow(clientKey(req), limit, windowMs);
  if (r.ok) return false;
  res.setHeader('retry-after', String(Math.ceil(r.retryAfterMs / 1000)));
  res.status(429).json({ ok: false, error: 'rate_limited' });
  return true;
}
