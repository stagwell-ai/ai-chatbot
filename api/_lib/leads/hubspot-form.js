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

/* ── THE DROPDOWN ───────────────────────────────────────────────────────────
   "It's a dropdown. The form has to send the exact internal values, not the
   labels, or the lead won't route."

   On `stagwell_ai_form_solution_drop_down` the internal values ARE the
   display names — "BERA.ai", "GEOPulse", "UNICEPTA" — so the only thing that
   can go wrong is casing, and the only safe source for them is the catalog
   the site already draws the tick-boxes from. Deriving it from
   solutions.json means a product renamed there cannot silently start sending
   a value the dropdown has never heard of; it means the two rot together or
   not at all. A value we cannot match is sent as nothing rather than as a
   guess, because an unknown option is what actually breaks her routing. */
export function dropdownValue(lead, data) {
  const d = lead.discovery || {};
  /* what they ticked comes first: it is the thing they asked to hear about.
     The engine's own pick is the fallback for a lead that ticked nothing. */
  const id = (d.productsRequested || [])[0] || d.primary || null;
  if (!id) return null;
  const p = RECOMMEND.productById(id, data);
  if (!p || p.active === false) return null;
  return p.displayName || p.name || null;
}

/* the fields Eriel asked for, and only those: a form submission writes what
   the form defines, so sending more is how you get a 400 that names a field
   nobody added */
export function formFields(lead, data) {
  const d = lead.discovery || {};
  const out = [];
  const put = (name, value) => { if (value != null && String(value).trim() !== '') out.push({ objectTypeId: '0-1', name, value: String(value) }); };
  put('email', lead.email);
  put('firstname', lead.firstname);
  put('lastname', lead.lastname);
  put('jobtitle', d.roleText || lead.jobtitle);
  put('phone', lead.phone);
  put('company', lead.company);
  put(env('HUBSPOT_FORM_PRODUCT_FIELD') || 'stagwell_ai_form_solution_drop_down', dropdownValue(lead, data));
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
