/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/voice/session — mint a short-lived OpenAI Realtime client secret
   for the browser. The OpenAI key never leaves this function; the browser
   gets a secret that expires in two minutes and can only open one session.

   Body (all optional): { page, resume: { summary, step } }
   Reply: { ok, value, expiresAt, model, voice, caps } — never a key.

   GET ?health=1 — the configuration, never a key.

   Rate limit: VOICE_MINT_PER_HOUR per IP. OFF by default (0) while voice is
   in beta — the client asked for it off until they say otherwise
   (2026-09-11); set the variable to a positive number to turn it on. The
   session cap the browser enforces (caps.sessionSeconds) and the silence
   mute still bound what one session can cost.
   ═══════════════════════════════════════════════════════════════════════════ */
import SOLUTIONS_FILE from '../../data/solutions.json' with { type: 'json' };
import GOALS_FILE from '../../data/goals.json' with { type: 'json' };
import KIMI_FILE from '../../data/kimi.json' with { type: 'json' };
import { buildSession } from '../_lib/voice/instructions.js';
import { limited } from '../_lib/ratelimit.js';

const DATA = { solutions: SOLUTIONS_FILE, goals: GOALS_FILE, kimi: KIMI_FILE };

const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
export function voiceConfig(env) {
  const e = env || process.env;
  const key = e.OPENAI_API_KEY || '';
  const flag = KIMI_FILE && KIMI_FILE.flags ? KIMI_FILE.flags.voice : undefined;
  const enabled = !!key && String(e.VOICE_ENABLED || (flag === false ? 'off' : 'on')).toLowerCase() !== 'off';
  return {
    enabled,
    keyConfigured: !!key,
    model: e.VOICE_MODEL || 'gpt-realtime',
    voice: e.VOICE_NAME || 'marin',
    transcribe: e.VOICE_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
    caps: {
      sessionSeconds: num(e.VOICE_SESSION_SECONDS, 900),
      softSeconds: num(e.VOICE_SOFT_SECONDS, 600),
      silenceMuteSeconds: num(e.VOICE_SILENCE_MUTE_SECONDS, 90),
      /* 0 = no per-IP limit. Off while voice is in beta, at the client's
         request (2026-09-11); a positive VOICE_MINT_PER_HOUR turns it on */
      mintsPerHour: num(e.VOICE_MINT_PER_HOUR, 0),
      secretSeconds: num(e.VOICE_SECRET_SECONDS, 120)
    }
  };
}

/* the mint, with fetch injectable for tests */
export async function mintSession(body, env, fetchImpl) {
  const e = env || process.env;
  const f = fetchImpl || fetch;
  const cfg = voiceConfig(e);
  if (!cfg.enabled) return { status: 503, json: { ok: false, error: cfg.keyConfigured ? 'voice_disabled' : 'voice_unconfigured' } };
  const b = body && typeof body === 'object' ? body : {};
  const resume = b.resume && typeof b.resume === 'object' ? { summary: String(b.resume.summary || '').slice(0, 1200), step: String(b.resume.step || '').slice(0, 80) } : null;
  const page = String(b.page || '').slice(0, 200);
  /* the opening showcase plays once, on a fresh start; a resumed or
     reconnected session greets in one line and carries on */
  const showcase = b.showcase !== false && !resume;
  const session = buildSession(DATA, e, { resume, page, showcase });
  const base = (e.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await f(base + '/realtime/client_secrets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + e.OPENAI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: cfg.caps.secretSeconds }, session }),
      signal: ctl.signal
    });
    clearTimeout(t);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.value) {
      const msg = (j.error && (j.error.message || j.error.code)) || ('HTTP ' + r.status);
      return { status: r.status === 429 ? 429 : 502, json: { ok: false, error: 'mint_failed', detail: String(msg).slice(0, 200) } };
    }
    /* what OpenAI actually accepted, echoed back for the browser's debug
       panel and for a curl from anywhere — never the secret */
    const S = j.session || {};
    const ai = (S.audio && S.audio.input) || {};
    const accepted = j.session ? {
      model: S.model || null,
      transcription: !!(ai.transcription && ai.transcription.model),
      transcriptionModel: (ai.transcription && ai.transcription.model) || null,
      turnDetection: (ai.turn_detection && ai.turn_detection.type) || null,
      interrupts: ai.turn_detection ? ai.turn_detection.interrupt_response !== false : null,
      voice: (S.audio && S.audio.output && S.audio.output.voice) || null,
      tools: Array.isArray(S.tools) ? S.tools.length : null,
      outputModalities: S.output_modalities || null
    } : null;
    return { status: 200, json: { ok: true, value: j.value, expiresAt: j.expires_at || null, model: cfg.model, voice: cfg.voice, caps: cfg.caps, accepted } };
  } catch (err) {
    clearTimeout(t);
    return { status: 504, json: { ok: false, error: err && err.name === 'AbortError' ? 'mint_timeout' : 'mint_network' } };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const q = req.query || {};
    if (!q.health) { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
    const cfg = voiceConfig();
    res.status(200).json({ ok: true, voice: cfg });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }
  const cfg = voiceConfig();
  if (cfg.caps.mintsPerHour > 0 && limited(req, res, cfg.caps.mintsPerHour, 3600000)) return;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const out = await mintSession(body || {});
  res.status(out.status).json(out.json);
}
