#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   HUBSPOT SETUP — creates the Stagwell AI contact property group and the
   custom properties ONCE (brief §30–§32: "never create property definitions
   during ordinary lead submission"). Safe to run again: what is already
   there is reconciled against the definitions, not skipped.

     HUBSPOT_ACCESS_TOKEN=… node scripts/hubspot-setup.mjs [--dry-run]

   The work itself lives in api/_lib/leads/setup.js, because the
   /hubspot-setup page runs the very same thing for whoever has no terminal.
   Keep the logic there; this file is only a way to look at it.
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
const { ensureProperties } = await import('../api/_lib/leads/setup.js');

const token = (process.env.HUBSPOT_ACCESS_TOKEN || '').trim();
const dry = process.argv.includes('--dry-run');

if (!token && !dry) {
  console.error('HUBSPOT_ACCESS_TOKEN is required.\n' +
    '  HubSpot → Development → Keys → Service keys → your key → Show → Copy, then:\n' +
    '  HUBSPOT_ACCESS_TOKEN=… node scripts/hubspot-setup.mjs\n' +
    '  (or pass --dry-run to print the plan without a key)');
  process.exit(2);
}

const r = await ensureProperties({ token, dry });

if (!r.ok && r.properties.length === 0) { console.error(r.help || r.error); process.exit(1); }

console.log((dry ? '[dry-run] ' : '') + 'property group ' + r.group.name + ' — ' + r.group.state + (r.group.detail ? ' ' + r.group.detail : ''));
r.properties.forEach(p => {
  console.log('  ' + p.name.padEnd(38) + p.state.padEnd(13) + (p.detail || ''));
});

if (dry) { console.log('\n' + r.properties.length + ' properties would be created. Re-run with a key to do it.'); process.exit(0); }

const t = r.tally;
console.log('\n' + t.created + ' created · ' + t.fixed + ' fixed · ' + t.ok + ' already correct · ' + t.failed + ' failed');
if (!r.ok) { console.error('\n' + r.help); process.exit(1); }
console.log('\nHubSpot is ready. Last step: set HUBSPOT_ACCESS_TOKEN on the Vercel project\n(stagwell-ai-prototypes → Settings → Environment Variables, mark it Sensitive,\nall three environments) and redeploy. Until then the site stays in mock mode.');
