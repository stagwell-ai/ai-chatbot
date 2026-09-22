/* ═══════════════════════════════════════════════════════════════════════════
   WHAT IS ACTUALLY ON THAT FORM — found out rather than asked for.

   A form submission is validated against the FORM, not the contact schema,
   and the form's fields are named by whoever built it. The first live one
   came back "Required field 'work_email' is missing", which told us that
   form's email field is a custom property — and told us nothing about the
   other six. Waiting for a person to list them is a dependency on somebody
   else's inbox.

   It does not have to be. A HubSpot form's definition is PUBLIC: it is what
   the embed script downloads to draw the form in a browser, no key involved.
   So ask for it, read the field names and which are required, and say what
   the mapping should be.

   Two ways, in order:

     definition  GET forms.hsforms.com/embed/v3/form/{portal}/{guid}/full
                 the whole field list, names, labels, required flags

     probe       failing that, POST a submission that CANNOT succeed and read
                 the error. HubSpot names every required field it did not get,
                 in one reply. A rejected submission creates nothing — no
                 contact, no form entry — which is what makes this safe to do
                 against a live form. The payload carries one nonsense field
                 and no email precisely so it can never be accepted.

   Nothing here writes anything, and nothing here needs the service key —
   only the caller's right to ask, which /api/hubspot-setup checks.
   ═══════════════════════════════════════════════════════════════════════════ */

/* what we send, and the shapes a form is likely to call each one */
const OURS = [
  { ours: 'email', looks: [/^work_?email$/i, /^email$/i, /email/i] },
  { ours: 'firstname', looks: [/^first_?name$/i, /^firstname$/i, /first/i] },
  { ours: 'lastname', looks: [/^last_?name$/i, /^lastname$/i, /last/i] },
  { ours: 'jobtitle', looks: [/^jobtitle$/i, /^job_?title$/i, /^title$/i, /title/i] },
  { ours: 'phone', looks: [/^phone$/i, /^mobilephone$/i, /phone/i] },
  { ours: 'company', looks: [/^company$/i, /company/i] },
  { ours: 'stagwell_ai_form_solution_drop_down', looks: [/drop_?down/i, /solution/i, /product/i] }
];

/* a form definition nests its fields in groups, and the shape has changed
   before; anything with a name and a fieldType is a field */
function harvest(node, out, depth) {
  if (!node || depth > 8) return out;
  if (Array.isArray(node)) { node.forEach(n => harvest(n, out, depth + 1)); return out; }
  if (typeof node !== 'object') return out;
  if (typeof node.name === 'string' && (node.fieldType || node.type)) {
    out.push({
      name: node.name,
      label: typeof node.label === 'string' ? node.label : null,
      type: String(node.fieldType || node.type),
      required: !!node.required
    });
  }
  Object.keys(node).forEach(k => harvest(node[k], out, depth + 1));
  return out;
}

/* a field the form does not define, named in a rejection. HubSpot has worded
   this several ways over the years, so match the field name near any wording
   that is plainly about the field not existing. */
export function unknownField(text, name) {
  const t = String(text || '');
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* the wording puts the field name in quotes AGAIN between the two halves —
     "Error in 'fields.phone'. The field \"phone\" does not exist" — so the gap
     cannot exclude quote characters, only be kept short enough not to run
     into the NEXT error in the list */
  return new RegExp("'fields\\." + n + "'[\\s\\S]{0,120}?(does not exist|is not a valid|not in the form|cannot be found|unknown)", 'i').test(t)
    || new RegExp("(does not exist|is not a valid|not in the form)[\\s\\S]{0,60}?'" + n + "'", 'i').test(t);
}

/* required fields named in a rejection, e.g.
   "Error in 'fields.work_email'. Required field 'work_email' is missing" */
function requiredFromError(text) {
  const out = new Set();
  const re = /Required field '([^']+)' is missing/gi;
  let m;
  while ((m = re.exec(String(text || '')))) out.add(m[1]);
  return [...out];
}

/* ── NEVER DROP A FIELD YOU MERELY CANNOT SEE ───────────────────────────────
   The first run of this got it dangerously wrong. A probe that reads only
   REQUIRED fields saw firstname, work_email and jobtitle, did not see the
   product dropdown among them — because it is optional, not because it is
   absent — and cheerfully suggested dropping it. That one field is the whole
   reason the integration exists: without it nothing routes.

   So `partial` is now load-bearing. On a partial reading, a field is only
   ever RENAMED, never dropped, and anything we cannot place is left exactly
   as it is for a human to decide. Absence is proven in `describeForm` by
   HubSpot rejecting the name, not inferred from a list that was never
   claiming to be complete. */
export function suggestMap(fields, opts) {
  const o = opts || {};
  const names = fields.map(f => f.name);
  const absent = o.absent || [];
  const pairs = [];
  const unsure = [];
  OURS.forEach(item => {
    if (names.indexOf(item.ours) !== -1) return;           /* already right */
    let hit = null;
    for (const look of item.looks) { hit = names.find(n => look.test(n)); if (hit) break; }
    if (hit) { pairs.push(item.ours + ':' + hit); return; }
    if (absent.indexOf(item.ours) !== -1) { pairs.push(item.ours + ':'); return; }  /* proven absent */
    if (o.partial) { unsure.push(item.ours); return; }     /* unseen is not absent */
    pairs.push(item.ours + ':');                           /* full definition: genuinely not there */
  });
  return { map: pairs.join(','), unsure };
}

export async function describeForm(opts) {
  const o = opts || {};
  const portal = String(o.portalId || '').trim();
  const guid = String(o.guid || '').trim();
  const f = o.fetch || fetch;
  if (!portal || !guid) return { ok: false, error: 'not_configured', help: 'HUBSPOT_PORTAL_ID and HUBSPOT_FORM_GUID must both be set on this deployment.' };

  const get = async (url, init) => {
    const ac = new AbortController();
    const bail = setTimeout(() => ac.abort(), o.timeoutMs || 8000);
    try {
      const r = await f(url, Object.assign({ signal: ac.signal }, init));
      const text = await r.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { ok: r.ok, status: r.status, data, text };
    } catch (e) {
      return { ok: false, status: 0, data: null, text: e && e.name === 'AbortError' ? 'timeout' : 'network' };
    } finally { clearTimeout(bail); }
  };

  const def = await get('https://forms.hsforms.com/embed/v3/form/' + encodeURIComponent(portal) + '/' + encodeURIComponent(guid) + '/full');
  if (def.ok && def.data) {
    const seen = new Map();
    harvest(def.data, [], 0).forEach(x => { if (!seen.has(x.name)) seen.set(x.name, x); });
    const fields = [...seen.values()];
    if (fields.length) {
      const s = suggestMap(fields);
      return { ok: true, source: 'definition', fields, suggestion: s.map, unsure: s.unsure };
    }
  }

  /* Plan B. This submission cannot be accepted — no email, and a field no
     form defines — so nothing is created whatever happens. */
  const probe = await get('https://api.hsforms.com/submissions/v3/integration/submit/' + encodeURIComponent(portal) + '/' + encodeURIComponent(guid), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ submittedAt: Date.now(), fields: [{ objectTypeId: '0-1', name: '__stagwell_ai_probe__', value: 'probe' }] })
  });
  if (probe.ok) {
    return { ok: false, error: 'probe_accepted',
      help: 'The probe submission was accepted, which should not happen. Treat this form as unverified and check it by hand.' };
  }
  const required = requiredFromError(probe.text);
  if (required.length) {
    /* ── SECOND PASS: WHICH OF OUR FIELDS DOES THIS FORM ACTUALLY HAVE? ─────
       Knowing the required fields is not enough — an optional field we fail
       to send is a field lost, and an optional field that does not exist
       fails the whole submission. So offer every name we might use and let
       HubSpot object to the ones it does not know. Leaving out a field we
       now KNOW is required keeps this rejection certain, so again nothing is
       created. */
    const hold = required[0];
    const candidates = OURS.map(o => o.ours).filter(n => n !== hold && required.indexOf(n) === -1);
    const second = await get('https://api.hsforms.com/submissions/v3/integration/submit/' + encodeURIComponent(portal) + '/' + encodeURIComponent(guid), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ submittedAt: Date.now(),
        fields: candidates.map(name => ({ objectTypeId: '0-1', name, value: 'probe' })) })
    });
    const absent = second.ok ? [] : candidates.filter(n => unknownField(second.text, n));
    const present = second.ok ? [] : candidates.filter(n => absent.indexOf(n) === -1);

    const fields = required.map(n => ({ name: n, label: null, type: null, required: true }))
      .concat(present.map(n => ({ name: n, label: null, type: null, required: false })));
    const s = suggestMap(fields, { partial: !second.ok ? false : true, absent });
    return { ok: true, source: 'probe', partial: true, fields, absent,
      suggestion: s.map, unsure: s.unsure,
      help: 'HubSpot would not hand over the form definition. The required fields were read out of a rejection, and the optional ones by offering each name and seeing which HubSpot refused'
        + (second.ok ? ' — though the second probe was ACCEPTED, which should not happen, so treat the optional list as unverified.' : '.')
        + ' Nothing was created: both probes were rejected by design.' };
  }
  return { ok: false, error: 'unreadable', status: probe.status,
    help: 'Could not read the form definition (' + def.status + ') and the probe said: ' + String(probe.text).slice(0, 300) };
}
