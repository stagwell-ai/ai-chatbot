/* ═══════════════════════════════════════════════════════════════════════════
   PROVIDERS — one adapter shape, several vendors (brief §15, §39, §40).

     const p = providerFor('openai/gpt-4o-mini');
     await p.complete({ system, user, maxTokens, timeoutMs, json:true })
       → { ok:true, content, model } | { ok:false, error, status, retryable }

   Model slots are "vendor/model". Vendors:
     kimi       OpenAI-compatible gateway — LLM_BASE_URL + LLM_API_KEY (or KIMI_*)
     openai     https://api.openai.com/v1 — OPENAI_API_KEY
     xai        https://api.x.ai/v1 — XAI_API_KEY
     anthropic  Messages API — ANTHROPIC_API_KEY
   Keys are read from process.env here and nowhere else; nothing in this
   file is ever imported by browser code.

   Errors are classified so the broker can decide: `retryable` is true for a
   network error, a timeout, 408/409/429 and 5xx — one bounded retry is
   allowed when the deadline permits; everything else fails over at once.
   ═══════════════════════════════════════════════════════════════════════════ */

const env = k => (process.env[k] || '').trim();

const VENDORS = {
  kimi: () => ({
    kind: 'openai', key: env('LLM_API_KEY') || env('KIMI_API_KEY'),
    base: (env('KIMI_BASE_URL') || env('LLM_BASE_URL') || 'https://api.kimi.com/coding/v1').replace(/\/+$/, ''),
    fixedTemperature: 1,       /* the gateway rejects anything but 1 */
    jsonMode: false            /* not supported on the coding gateway; the parser copes */
  }),
  openai: () => ({ kind: 'openai', key: env('OPENAI_API_KEY'), base: (env('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, ''), jsonMode: true }),
  xai: () => ({ kind: 'openai', key: env('XAI_API_KEY'), base: (env('XAI_BASE_URL') || 'https://api.x.ai/v1').replace(/\/+$/, ''), jsonMode: true }),
  anthropic: () => ({ kind: 'anthropic', key: env('ANTHROPIC_API_KEY'), base: (env('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com').replace(/\/+$/, '') })
};

export function parseSlot(spec) {
  const s = String(spec || '').trim();
  if (!s) return null;
  const i = s.indexOf('/');
  const vendor = (i === -1 ? 'kimi' : s.slice(0, i)).toLowerCase();
  const model = i === -1 ? s : s.slice(i + 1);
  if (!VENDORS[vendor] || !model) return null;
  return { vendor, model, id: vendor + '/' + model };
}

const classify = (status) => ({ status, retryable: status === 408 || status === 409 || status === 429 || status >= 500 });

async function fetchJson(url, init, timeoutMs, fetchImpl) {
  const f = fetchImpl || fetch;
  const ac = new AbortController();
  const bail = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await f(url, Object.assign({}, init, { signal: ac.signal }));
    const raw = await r.text();
    const ms = Date.now() - t0;
    if (!r.ok) return Object.assign({ ok: false, error: 'upstream_' + r.status, ms, detail: raw.slice(0, 200) }, classify(r.status));
    let data; try { data = JSON.parse(raw); } catch (e) { return { ok: false, error: 'bad_json', retryable: false, ms }; }
    return { ok: true, data, ms };
  } catch (e) {
    const timeout = e && e.name === 'AbortError';
    return { ok: false, error: timeout ? 'timeout' : 'network', retryable: true, ms: Date.now() - t0 };
  } finally {
    clearTimeout(bail);
  }
}

export function providerFor(spec, fetchImpl) {
  const slot = parseSlot(spec);
  if (!slot) return null;
  const cfg = VENDORS[slot.vendor]();
  const configured = !!cfg.key;

  async function complete(req) {
    if (!configured) return { ok: false, error: 'not_configured', retryable: false, ms: 0 };
    const timeoutMs = req.timeoutMs || 4000;
    const maxTokens = req.maxTokens || 700;

    if (cfg.kind === 'anthropic') {
      const r = await fetchJson(cfg.base + '/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: slot.model, max_tokens: maxTokens, system: req.system, messages: [{ role: 'user', content: req.user }], temperature: 0 })
      }, timeoutMs, fetchImpl);
      if (!r.ok) return r;
      const text = Array.isArray(r.data.content) ? r.data.content.filter(b => b && b.type === 'text').map(b => b.text).join('\n') : '';
      if (!text.trim()) return { ok: false, error: 'empty', retryable: false, ms: r.ms };
      return { ok: true, content: text, model: r.data.model || slot.model, ms: r.ms };
    }

    const body = {
      model: slot.model,
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
      max_tokens: maxTokens,
      temperature: cfg.fixedTemperature != null ? cfg.fixedTemperature : 0,
      stream: false
    };
    if (req.json && cfg.jsonMode) body.response_format = { type: 'json_object' };
    const r = await fetchJson(cfg.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, timeoutMs, fetchImpl);
    if (!r.ok) return r;
    const content = r.data && r.data.choices && r.data.choices[0] && r.data.choices[0].message && r.data.choices[0].message.content;
    if (!content || !String(content).trim()) return { ok: false, error: 'empty', retryable: false, ms: r.ms };
    return { ok: true, content: String(content), model: (r.data && r.data.model) || slot.model, ms: r.ms };
  }

  return { id: slot.id, vendor: slot.vendor, model: slot.model, configured, complete };
}

export const VENDOR_IDS = Object.keys(VENDORS);
