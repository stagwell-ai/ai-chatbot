/* ═══════════════════════════════════════════════════════════════════════════
   BROKER — every model call goes through here (brief §15–§19, §40).

   The chain is configuration, not code:
     KIMI_PRIMARY_MODEL    default kimi/<LLM_MODEL>          (the existing gateway)
     KIMI_SECONDARY_MODEL  default openai/gpt-4o-mini        (only if OPENAI_API_KEY is set)
     KIMI_TERTIARY_MODEL   default anthropic/claude-haiku-4-5-20251001 (only if ANTHROPIC_API_KEY is set)
     KIMI_PRIMARY/SECONDARY/TERTIARY_TIMEOUT_MS  per attempt; default 7000 for a kimi/ slot, 4000 otherwise
     KIMI_MODEL_TIMEOUT_MS  one value for all three slots (overrides the defaults, not the per-slot keys)
     KIMI_TOTAL_DEADLINE_MS default 12000 for the whole chain
     KIMI_LLM_ENABLED      'false' turns every call into deterministic mode

   Failover (brief §16): a provider has failed on a network error, a timeout,
   a 429 or 5xx, an empty answer, unparseable JSON, or output that does not
   satisfy the schema. At most ONE bounded retry per provider, only for a
   network error, a 429 or a 5xx with time left on the deadline — never for a
   timeout, which would double the visitor's wait; then the next model; then
   null, which the caller treats as "deterministic mode". The visitor never
   sees any of this — the client falls back to keywords and carries on.

   Every call returns telemetry (provider, model, chainIndex, fallbacks,
   attempts[], ms) so /api/ask can hand the client what it needs for
   kimi_model_fallback / kimi_deterministic_mode and the logs can show the
   rates the brief's §46 asks for. No key, no prompt and no visitor text is
   ever in the telemetry.
   ═══════════════════════════════════════════════════════════════════════════ */
import { providerFor } from './providers.js';
import { parseLooseJSON } from './json.js';

const env = k => (process.env[k] || '').trim();
const num = (k, d) => { const n = Number(env(k)); return isFinite(n) && n > 0 ? n : d; };

export function chainConfig() {
  const enabled = env('KIMI_LLM_ENABLED').toLowerCase() !== 'false';
  const legacyModel = env('LLM_MODEL') || 'kimi-for-coding-highspeed';
  const slots = [
    env('KIMI_PRIMARY_MODEL') || ((env('LLM_API_KEY') || env('KIMI_API_KEY')) ? 'kimi/' + legacyModel : ''),
    env('KIMI_SECONDARY_MODEL') || (env('OPENAI_API_KEY') ? 'openai/gpt-4o-mini' : ''),
    env('KIMI_TERTIARY_MODEL') || (env('ANTHROPIC_API_KEY') ? 'anthropic/claude-haiku-4-5-20251001' : '')
  ].map(s => (s.toLowerCase() === 'off' || s.toLowerCase() === 'none') ? '' : s);
  /* per-slot timeouts: the Kimi coding gateway is a reasoning model and needs
     6–8s for a structured answer; the others are given the brief's 4s. Each
     slot can be set explicitly (KIMI_PRIMARY_TIMEOUT_MS …); KIMI_MODEL_TIMEOUT_MS
     is the fallback for all three. */
  const base = num('KIMI_MODEL_TIMEOUT_MS', 0);
  const perSlot = (slot, key) => num(key, base || (String(slot).toLowerCase().startsWith('kimi/') ? 7000 : 4000));
  return {
    enabled,
    slots,
    timeouts: [perSlot(slots[0], 'KIMI_PRIMARY_TIMEOUT_MS'), perSlot(slots[1], 'KIMI_SECONDARY_TIMEOUT_MS'), perSlot(slots[2], 'KIMI_TERTIARY_TIMEOUT_MS')],
    timeoutMs: base || 4000,
    deadlineMs: num('KIMI_TOTAL_DEADLINE_MS', 12000)
  };
}

export function buildChain(cfg, fetchImpl) {
  const c = cfg || chainConfig();
  return c.slots.map((s, i) => ({ slot: s, name: ['primary', 'secondary', 'tertiary'][i], timeoutMs: (c.timeouts && c.timeouts[i]) || c.timeoutMs || 4000, provider: s ? providerFor(s, fetchImpl) : null }))
    .filter(x => x.provider);
}

/* what /api/ask?health=1 reports: names and whether a key exists — never the key */
export function describeChain(cfg) {
  const c = cfg || chainConfig();
  return {
    enabled: c.enabled,
    timeoutMs: c.timeoutMs,
    deadlineMs: c.deadlineMs,
    chain: buildChain(c).map(x => ({ name: x.name, id: x.provider.id, vendor: x.provider.vendor, model: x.provider.model, timeoutMs: x.timeoutMs, configured: x.provider.configured }))
  };
}

/* One structured call with failover.
     req: { system, user, maxTokens, json:true, validate(parsed) → value|null }
   Returns { ok, value, telemetry } — ok:false means deterministic mode. */
export async function structured(req, opts) {
  const o = opts || {};
  const cfg = o.config || chainConfig();
  const attempts = [];
  const started = Date.now();
  const t = () => ({ attempts, ms: Date.now() - started });

  if (!cfg.enabled) return { ok: false, reason: 'disabled', telemetry: Object.assign({ provider: null, model: null, chainIndex: null, fallbacks: 0 }, t()) };
  const chain = buildChain(cfg, o.fetch);
  if (!chain.length) return { ok: false, reason: 'no_providers', telemetry: Object.assign({ provider: null, model: null, chainIndex: null, fallbacks: 0 }, t()) };

  let fallbacks = 0;
  for (let i = 0; i < chain.length; i++) {
    const { provider, name, timeoutMs } = chain[i];
    if (!provider.configured) { attempts.push({ provider: provider.id, error: 'not_configured', ms: 0 }); fallbacks++; continue; }
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = cfg.deadlineMs - (Date.now() - started);
      if (left < 300) { attempts.push({ provider: provider.id, error: 'deadline', ms: 0 }); break; }
      const r = await provider.complete({ system: req.system, user: req.user, maxTokens: req.maxTokens, json: req.json !== false, timeoutMs: Math.min(timeoutMs || cfg.timeoutMs, left) });
      const rec = { provider: provider.id, attempt, ms: r.ms || 0, error: r.ok ? null : r.error };
      if (r.ok) {
        const parsed = parseLooseJSON(r.content);
        const value = parsed ? req.validate(parsed) : null;
        if (value) {
          attempts.push(rec);
          return { ok: true, value, telemetry: Object.assign({ provider: provider.id, model: r.model || provider.model, chainIndex: i, chainName: name, fallbacks, failed: attempts.filter(a => a.error).map(a => a.provider) }, t()) };
        }
        rec.error = parsed ? 'schema' : 'unparseable';
        attempts.push(rec);
        break;                                  /* bad output is not transient: next provider */
      }
      attempts.push(rec);
      if (!r.retryable) break;                  /* 4xx other than 429: no point retrying */
      if (r.error === 'timeout') break;         /* a model that took the whole budget once will again; the next model is faster than a second wait */
      /* one bounded retry for a transient error (network, 429, 5xx), only with time in hand */
    }
    fallbacks++;
  }
  return { ok: false, reason: 'exhausted', telemetry: Object.assign({ provider: null, model: null, chainIndex: null, fallbacks, failed: attempts.filter(a => a.error).map(a => a.provider) }, t()) };
}

/* the log line the brief's §46 rates are computed from — no PII, no prompt */
export function logTelemetry(mode, result) {
  try {
    const tel = result.telemetry || {};
    console.log('[llm]', JSON.stringify({ mode, ok: !!result.ok, provider: tel.provider || null, chainIndex: tel.chainIndex, fallbacks: tel.fallbacks || 0, ms: tel.ms, attempts: (tel.attempts || []).map(a => (a.provider + ':' + (a.error || 'ok') + ':' + a.ms)) }));
  } catch (e) { /* logging never fails a request */ }
}
