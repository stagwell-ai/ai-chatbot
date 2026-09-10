/* ═══════════════════════════════════════════════════════════════════════════
   LEAD SCHEMA — server-side revalidation of what the browser sent (brief §26,
   §27). The client's recommendation fields are accepted as CLAIMS and then
   recomputed from the structured signals with the same deterministic engine
   the page ran (next/recommend.js), so a devtools caller cannot put a product
   into HubSpot that the signals do not support.

   validateLeadBody(body, data) → { ok:true, lead } | { ok:false, error, field }
   ═══════════════════════════════════════════════════════════════════════════ */
/* the browser's scorer, imported as-is: recommend.js is a plain script with a
   module.exports tail, so a static import gives us the same object the page
   runs — and a static import is what Vercel's bundler can trace */
import RECOMMEND from '../../../next/recommend.js';

const MAX = 400;
const str = (v, n) => { if (v == null) return null; const s = String(v).replace(/\s+/g, ' ').trim(); return s ? s.slice(0, n || MAX) : null; };
const list = (v, n, each) => (Array.isArray(v) ? v : []).map(x => str(x, each || 64)).filter(Boolean).slice(0, n || 16);

export const EMAIL_RE = /^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const PHONE_RE = /^\+?[\d\s().-]{7,24}$/;

export function normalizeEmail(v) {
  const s = str(v, 200);
  if (!s || !EMAIL_RE.test(s)) return null;
  const [local, domain] = s.split('@');
  return local + '@' + domain.toLowerCase();
}

/* keep the visitor's digits and a leading +; drop everything else */
export function normalizePhone(v) {
  const s = str(v, 60);
  if (!s || !PHONE_RE.test(s)) return null;
  const digits = s.replace(/[^\d]/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return (s.trim().charAt(0) === '+' ? '+' : '') + digits;
}

export function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstname: null, lastname: null };
  if (parts.length === 1) return { firstname: parts[0], lastname: null };
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') };
}

export function validateLeadBody(body, data) {
  const b = body && typeof body === 'object' ? body : {};
  if (JSON.stringify(b).length > 20000) return { ok: false, error: 'payload_too_large' };

  /* the compact form (brief §24) — and the older flat shape the previous
     homepage form sent, so nothing in flight breaks */
  const L = b.lead && typeof b.lead === 'object' ? b.lead : b;
  const name = str(L.name, 120);
  const email = normalizeEmail(L.email);
  const phone = normalizePhone(L.phone);
  /* the name is optional: the open path (client's order, 2026-09-10) creates
     the contact on the email alone and adds the phone on the next turn */
  if (!email) return { ok: false, error: 'email_invalid', field: 'email' };
  if (L.phone != null && String(L.phone).trim() && !phone) return { ok: false, error: 'phone_invalid', field: 'phone' };

  const D = b.discovery && typeof b.discovery === 'object' ? b.discovery : {};
  const A = D.attribution && typeof D.attribution === 'object' ? D.attribution : {};
  const intents = (Array.isArray(D.intents) ? D.intents : []).slice(0, 24)
    .map(i => (i && typeof i === 'object') ? { id: str(i.id, 60), explicit: !!i.explicit } : { id: str(i, 60), explicit: false })
    .filter(i => i.id && RECOMMEND.intentById(i.id, data));
  const goal = str(D.primaryGoal, 40);
  const bandOk = (v, group) => { const s = str(v, 40); return s && (data.taxonomy.bands[group] || []).some(x => x.id === s) ? s : null; };
  const companySize = bandOk(D.companySize, 'companySize');
  const creatorProgramSize = bandOk(D.creatorProgramSize, 'creatorVolume') || (str(D.creatorProgramSize, 40) === 'unknown' ? 'unknown' : null);
  const geographicScope = bandOk(D.geographicScope, 'geographicScope');
  /* what they asked for when they cut to the chase — an id from taxonomy.json */
  const requests = (data.taxonomy && data.taxonomy.contactRequests) || [];
  const contactRequest = (() => { const v = str(D.contactRequest, 40); return v && requests.some(r => r.id === v) ? v : null; })();
  const ROLES = ['founder', 'manager', 'director_vp', 'c_suite', 'other'];
  const role = (() => { const v = str(D.role, 40); return v && ROLES.indexOf(v) !== -1 ? v : null; })();

  /* recompute; the client's claim is kept only as a note when it disagrees */
  const reco = RECOMMEND.recommend({ goal: RECOMMEND.goalById(goal, data) ? goal : null, intents, companySize, creatorProgramSize, geographicScope }, data);
  const claimed = str(D.primary, 60);

  const lead = {
    name, email, phone,
    firstname: splitName(name).firstname, lastname: splitName(name).lastname,
    company: str(L.company, 160) || str(b.company, 160),
    website: str((D && D.website), 160) || str(b.website, 160),
    discovery: {
      sessionId: str(D.sessionId, 64),
      primaryGoal: RECOMMEND.goalById(goal, data) ? goal : null,
      rawProblemText: str(D.rawProblemText, 600),
      intents,
      companySize, creatorProgramSize, geographicScope,
      industry: str(D.industry, 80),
      askedQuestionIds: list(D.askedQuestionIds, 12, 40),
      steps: Number.isFinite(Number(D.steps)) ? Math.max(0, Math.min(20, Math.round(Number(D.steps)))) : 0,
      summary: str(D.summary, 300),
      llmStatus: str(D.llmStatus, 20),
      llmProvider: str(D.llmProvider, 60),
      contactRequest,
      role,
      roleText: str(D.roleText, 80),
      website: str(D.website, 160),
      siteKnown: D.siteKnown === true,
      /* server-side truth */
      primary: reco.primary,
      secondary: reco.secondary,
      confidence: reco.confidence,
      claimedPrimary: claimed && claimed !== reco.primary ? claimed : null
    },
    attribution: {
      utmSource: str(A.utmSource, 120), utmMedium: str(A.utmMedium, 120), utmCampaign: str(A.utmCampaign, 120), utmContent: str(A.utmContent, 120),
      landingPage: str(A.landingPage, 300) || str(b.page, 300), referrer: str(A.referrer, 300)
    },
    submittedAt: str(b.ts, 40),
    receivedAt: new Date().toISOString(),
    source: str(b.source, 60) || 'stagwell-ai · kimi'
  };
  return { ok: true, lead };
}

/* brief §37: one concise human-readable sales summary, from structured state */
export function salesSummary(lead, data) {
  const d = lead.discovery || {};
  const P = id => (RECOMMEND.productById(id, data) || {}).name || id;
  const need = (d.intents || []).map(i => (RECOMMEND.intentById(i.id, data) || {}).need).filter(Boolean).slice(0, 3);
  const size = { smb: 'under 250 people', mid_market: '250–2,500 people', enterprise: '2,500+ people' }[d.companySize];
  const who = d.industry ? d.industry + ' company' + (size ? ', ' + size : '') : (size ? 'company with ' + size : null);
  const requests = (data.taxonomy && data.taxonomy.contactRequests) || [];
  const asked = d.contactRequest ? (requests.find(r => r.id === d.contactRequest) || {}).label || d.contactRequest : null;
  const parts = [];
  /* the lead's own words come first when they asked to be contacted: it is the
     one thing the person picking this up needs to see before anything else */
  if (asked) parts.push('ASKED FOR ' + String(asked).toUpperCase() + '.');
  const ROLE_WORDS = { founder: 'Founder / owner', manager: 'Marketing manager', director_vp: 'Director / VP', c_suite: 'C-suite', other: null };
  const role = d.roleText || ROLE_WORDS[d.role] || null;
  if (who) parts.push((role ? role + ' at a ' : 'Visitor at a ') + who + '.');
  else if (role) parts.push(role + '.');
  if (lead.company) parts.push('Company: ' + lead.company + (d.website ? ' (' + d.website + ')' : '') + '.');
  else if (d.website) parts.push('Site: ' + d.website + '.');
  if (d.rawProblemText) parts.push('Said: “' + d.rawProblemText.slice(0, 160) + '”.');
  if (need.length) parts.push('Wants to ' + need.join('; ') + '.');
  if (d.primary) parts.push('Primary recommendation: ' + P(d.primary) + (d.confidence ? ' (' + d.confidence.level + ' confidence)' : '') + '.');
  if (d.secondary && d.secondary.length) parts.push('Also worth considering: ' + d.secondary.map(P).join(', ') + '.');
  parts.push((d.steps || 0) + ' conversation step(s); model mode ' + (d.llmStatus || 'unknown') + '.');
  return parts.join(' ');
}
