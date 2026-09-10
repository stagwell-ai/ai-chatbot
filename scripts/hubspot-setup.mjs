#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   HUBSPOT SETUP — creates the Stagwell AI contact property group and the
   custom properties ONCE (brief §30–§32: "never create property definitions
   during ordinary lead submission"). Idempotent: existing properties are
   left alone. Run by an admin with a private-app token that has
   crm.schemas.contacts.write:

     HUBSPOT_ACCESS_TOKEN=pat-… node scripts/hubspot-setup.mjs [--dry-run]
   ═══════════════════════════════════════════════════════════════════════════ */
/* Node reparses api/_lib/*.js as ES modules and warns about it, suggesting a
   fix — adding "type":"module" to the root package.json — that would break
   next/recommend.js for the tests, the browser scripts, AND both Vercel
   functions (they are compiled to CommonJS, so they would then require() an
   ES module and 500 on every request; tried on 2026-09-10, reverted).
   Nothing is wrong: a DYNAMIC import lets the filter below be installed
   first, so the reader sees the script's own output and no false alarm. */
process.removeAllListeners('warning');
process.on('warning', w => {
  if (w && (w.name === 'ModuleTypelessPackageJsonWarning' || w.code === 'MODULE_TYPELESS_PACKAGE_JSON')) return;
  console.warn(w && w.stack ? w.stack : w);
});
const { PROPERTIES, GROUP } = await import('../api/_lib/leads/properties.js');

const token = (process.env.HUBSPOT_ACCESS_TOKEN || '').trim();
const dry = process.argv.includes('--dry-run');
const BASE = (process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com').replace(/\/+$/, '');

if (!token && !dry) {
  console.error('HUBSPOT_ACCESS_TOKEN is required.\n' +
    '  HubSpot → Settings → Integrations → Private apps → your app → Auth → copy the token, then:\n' +
    '  HUBSPOT_ACCESS_TOKEN=pat-… node scripts/hubspot-setup.mjs\n' +
    '  (or pass --dry-run to print the plan without a token)');
  process.exit(2);
}

async function api(path, init) {
  const r = await fetch(BASE + path, Object.assign({}, init, { headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' } }));
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: r.status, ok: r.ok, data, text: text.slice(0, 300) };
}

/* fail fast on a token that cannot do the job, rather than 19 identical
   failures: one cheap read that needs the same portal and scopes */
const SCOPE_HELP = 'The private app is missing a scope. It needs crm.schemas.contacts.write to create\n' +
  'these properties (and crm.objects.contacts.read + .write to write leads afterwards).\n' +
  'HubSpot → Settings → Integrations → Private apps → your app → Auth → Scopes.';

if (!dry) {
  const check = await api('/crm/v3/properties/contacts');
  if (check.status === 401) { console.error('The token was rejected (401) — wrong or expired.\nCopy it again from the private app: HubSpot → Settings → Integrations → Private apps → Auth.'); process.exit(1); }
  if (check.status === 403) { console.error(SCOPE_HELP); process.exit(1); }
  if (!check.ok) { console.error('Could not reach HubSpot: ' + check.status + ' ' + check.text); process.exit(1); }
  console.log('token ok — portal reachable, ' + ((check.data && check.data.results) || []).length + ' contact properties exist today\n');
}

console.log((dry ? '[dry-run] ' : '') + 'property group ' + GROUP.name);
if (!dry) {
  const g = await api('/crm/v3/properties/contacts/groups', { method: 'POST', body: JSON.stringify({ name: GROUP.name, label: GROUP.label, displayOrder: -1 }) });
  console.log('  ' + (g.ok ? 'created' : g.status === 409 ? 'already there' : 'FAILED ' + g.status + ' ' + g.text));
}

const tally = { created: 0, existed: 0, failed: 0 };
for (const p of PROPERTIES) {
  const body = { name: p.name, label: p.label, type: p.type, fieldType: p.fieldType, groupName: GROUP.name, options: p.options || undefined, description: 'Written by the Stagwell AI website discovery conversation.' };
  if (dry) { console.log('  would create ' + p.name + ' (' + p.type + '/' + p.fieldType + ')'); continue; }
  const r = await api('/crm/v3/properties/contacts', { method: 'POST', body: JSON.stringify(body) });
  /* one 403 means every one of them will 403: say why once and stop */
  if (r.status === 403) { console.error('\n' + SCOPE_HELP); process.exit(1); }
  const state = r.ok ? 'created' : r.status === 409 ? 'already there' : 'FAILED ' + r.status + ' ' + r.text;
  if (r.ok) tally.created++; else if (r.status === 409) tally.existed++; else tally.failed++;
  console.log('  ' + p.name.padEnd(38) + state);
}

if (dry) { console.log('\n' + PROPERTIES.length + ' properties would be created. Re-run with a token to do it.'); process.exit(0); }
console.log('\n' + tally.created + ' created · ' + tally.existed + ' already there · ' + tally.failed + ' failed');
if (tally.failed) { console.error('\nSome properties were not created. Leads would silently drop those fields — fix and re-run (it is safe to run again).'); process.exit(1); }
console.log('\nHubSpot is ready. Last step: set HUBSPOT_ACCESS_TOKEN on the Vercel project\n(stagwell-ai-prototypes → Settings → Environment Variables, mark it Sensitive,\nall three environments) and redeploy. Until then the site stays in mock mode.');
