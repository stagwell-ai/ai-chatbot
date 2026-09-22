/* ═══════════════════════════════════════════════════════════════════════════
   HUBSPOT FORMS API — the submission EVENT, which the Contacts API cannot make.

   "Submit via the Forms API, not the Contacts API. My workflow triggers on a
   HubSpot form submission event, so it has to come in as a real form fill or
   leads won't enroll and won't route." (Eriel Pettiford, who runs this
   portal, relayed 2026-09-22.)

   She is right, and it is the same fact this build has been circling all day:
   a Contacts API write raises nothing. A form submission raises an event that
   workflows can trigger on, lands on the contact's timeline as a form fill,
   and carries HubSpot's own attribution. Nothing we can do from the Contacts
   API is a substitute for it.

   SO WE DO BOTH, in this order, and neither replaces the other:

     1. this file    POST the form → the event fires, her workflow enrols the
                     lead and routes it, and the contact is created if new
     2. hubspot.js   then upsert by email → the 22 discovery properties, which
                     a form can only carry if they are fields ON that form,
                     and hers are not

   A form submission can only write properties the form itself defines. That
   is why the rich record still goes through the Contacts API: the two are not
   alternatives, they are the event and the detail.

   Unset HUBSPOT_FORM_GUID and this does nothing, which is the state until
   someone gives us the guid of the form to post to.
   ═══════════════════════════════════════════════════════════════════════════ */
import RECOMMEND from '../../../next/recommend.js';

const env = k => (process.env[k] || '').trim();
const BASE = () => (env('HUBSPOT_FORMS_BASE_URL') || 'https://api.hsforms.com').replace(/\/+$/, '');

export function formMode() {
  if (env('HUBSPOT_MOCK').toLowerCase() === 'true') return 'mock';
  return /^[0-9a-f-]{36}$/i.test(env('HUBSPOT_FORM_GUID')) && /^\d+$/.test(env('HUBSPOT_PORTAL_ID')) ? 'live' : 'off';
}

/* ── THE PRODUCT FIELD ──────────────────────────────────────────────────────
   "The form has to send the exact internal values, not the labels, or the
   lead won't route."

   On `stagwell_ai_form_solution_drop_down` the internal values ARE the
   display names — "BERA.ai", "GEOPulse", "UNICEPTA" — so the only thing that
   can go wrong is casing, and the only safe source for them is the catalog
   the site already draws the tick-boxes from. Deriving it from solutions.json
   means a product renamed there cannot silently start sending a value the
   field has never heard of; the two rot together or not at all. A value we
   cannot match is left out rather than guessed at, because an unknown option
   is what actually breaks her routing.

   MULTIPLE, SINCE 2026-09-22. The property became a multi-checkbox because
   the site's own form is a multi-select and people use it — the first real
   submission ticked three. Her routing rule is now: several selections go to
   the catch-all owner, one selection goes to that product's owner. Which
   makes the count load-bearing, not cosmetic: sending only the first tick
   would have routed a three-product lead to a single product's owner as
   though they had asked for one thing. HubSpot takes a checkbox field's
   values as one semicolon-separated string.

   Their own ticks, in the order they ticked them. The engine's recommendation
   is the fallback ONLY for a lead that ticked nothing at all — and that is a
   single value, so under her rule it routes to that product's owner on our
   say-so rather than theirs. HUBSPOT_FORM_PRODUCT_FALLBACK=none turns that
   off and sends the field empty instead, without a deploy. */
export function productValues(lead, data) {
  const d = lead.discovery || {};
  const name = id => {
    const p = RECOMMEND.productById(id, data);
    return (p && p.active !== false && (p.displayName || p.name)) || null;
  };
  const out = [];
  (d.productsRequested || []).forEach(id => {
    const n = name(id);
    if (n && out.indexOf(n) === -1) out.push(n);
  });
  if (out.length) return out;
  if (env('HUBSPOT_FORM_PRODUCT_FALLBACK').toLowerCase() === 'none') return [];
  const guess = d.primary ? name(d.primary) : null;
  return guess ? [guess] : [];
}

/* HubSpot reads a checkbox field as one semicolon-separated string */
export function productFieldValue(lead, data) {
  const v = productValues(lead, data);
  return v.length ? v.join(';') : null;
}

/* ── THE FORM'S OWN FIELD NAMES ─────────────────────────────────────────────
   A submission is validated against the form, not against the contact
   schema, and the form's fields are named by whoever built it. The first
   live one came back:

     Error in 'fields.work_email'. Required field 'work_email' is missing
     Error in 'fields.lastname'.   Required field 'lastname' is missing

   — the email field on that form is a custom property called `work_email`,
   not `email`. Nothing about that is knowable from here, and the next form
   will differ again, so the mapping is configuration rather than code:

     HUBSPOT_FORM_FIELD_MAP=email:work_email,jobtitle:title

   reads "send what we call email under the name work_email". Anything
   unmapped goes out under its own name. A mapping to an empty name drops
   that field entirely, for a form that does not define it — because a field
   the form has never heard of fails the whole submission just as surely as a
   missing one. */
function fieldMap() {
  const out = {};
  env('HUBSPOT_FORM_FIELD_MAP').split(',').forEach(pair => {
    const bits = pair.split(':');
    if (bits.length !== 2) return;
    const from = bits[0].trim();
    if (from) out[from] = bits[1].trim();
  });
  return out;
}

export function formFields(lead, data) {
  const d = lead.discovery || {};
  const map = fieldMap();
  const out = [];
  const put = (name, value) => {
    const as = Object.prototype.hasOwnProperty.call(map, name) ? map[name] : name;
    if (!as) return;                                   /* mapped to nothing: this form has no such field */
    if (value == null || String(value).trim() === '') return;
    out.push({ objectTypeId: '0-1', name: as, value: String(value) });
  };
  put('email', lead.email);
  put('firstname', lead.firstname);
  put('lastname', lead.lastname);
  put('jobtitle', d.roleText || lead.jobtitle);
  put('phone', lead.phone);
  put('company', lead.company);
  put(env('HUBSPOT_FORM_PRODUCT_FIELD') || 'stagwell_ai_form_solution_drop_down', productFieldValue(lead, data));
  return out;
}

export async function submitForm(lead, data, opts) {
  const o = opts || {};
  const mode = o.mode || formMode();
  if (mode !== 'live') return { ok: true, mode, action: 'skipped' };

  const portal = env('HUBSPOT_PORTAL_ID');
  const guid = env('HUBSPOT_FORM_GUID');
  const a = lead.attribution || {};
  const body = {
    submittedAt: Date.now(),
    fields: formFields(lead, data),
    context: {
      pageUri: a.landingPage ? 'https://stagwell-ai-prototypes.vercel.app' + a.landingPage : undefined,
      pageName: 'Stagwell AI — book a demo',
      /* HubSpot's own visitor cookie, when the page had the tracking code and
         passed it through. Without it the submission still counts; it simply
         is not stitched to that browser's earlier page views. */
      hutk: a.hutk || undefined
    }
  };

  const ac = new AbortController();
  const bail = setTimeout(() => ac.abort(), o.timeoutMs || 8000);
  try {
    const r = await (o.fetch || fetch)(BASE() + '/submissions/v3/integration/submit/' + encodeURIComponent(portal) + '/' + encodeURIComponent(guid), {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    if (r.ok) return { ok: true, mode, action: 'submitted' };
    /* the two that actually happen: a field the form does not define, and a
       dropdown value that is not one of its options. Both name themselves. */
    return { ok: false, mode, status: r.status, error: 'form_' + r.status, detail: text.slice(0, 600),
      retryable: r.status === 429 || r.status >= 500 };
  } catch (e) {
    return { ok: false, mode, status: 0, error: e && e.name === 'AbortError' ? 'timeout' : 'network', retryable: true };
  } finally { clearTimeout(bail); }
}
