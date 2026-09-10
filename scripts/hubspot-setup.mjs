#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   HUBSPOT SETUP — creates the Stagwell AI contact property group and the
   custom properties ONCE (brief §30–§32: "never create property definitions
   during ordinary lead submission"). Idempotent: existing properties are
   left alone. Run by an admin with a private-app token that has
   crm.schemas.contacts.write:

     HUBSPOT_ACCESS_TOKEN=pat-… node scripts/hubspot-setup.mjs [--dry-run]
   ═══════════════════════════════════════════════════════════════════════════ */
import { PROPERTIES, GROUP } from '../api/_lib/leads/properties.js';

const token = (process.env.HUBSPOT_ACCESS_TOKEN || '').trim();
const dry = process.argv.includes('--dry-run');
const BASE = (process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com').replace(/\/+$/, '');

if (!token && !dry) { console.error('HUBSPOT_ACCESS_TOKEN is required (or pass --dry-run to print the plan)'); process.exit(2); }

async function api(path, init) {
  const r = await fetch(BASE + path, Object.assign({}, init, { headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' } }));
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: r.status, ok: r.ok, data, text: text.slice(0, 300) };
}

console.log((dry ? '[dry-run] ' : '') + 'property group ' + GROUP.name);
if (!dry) {
  const g = await api('/crm/v3/properties/contacts/groups', { method: 'POST', body: JSON.stringify({ name: GROUP.name, label: GROUP.label, displayOrder: -1 }) });
  console.log('  ' + (g.ok ? 'created' : g.status === 409 ? 'exists' : 'FAILED ' + g.status + ' ' + g.text));
}

for (const p of PROPERTIES) {
  const body = { name: p.name, label: p.label, type: p.type, fieldType: p.fieldType, groupName: GROUP.name, options: p.options || undefined, description: 'Written by the Stagwell AI website discovery conversation.' };
  if (dry) { console.log('  would create ' + p.name + ' (' + p.type + '/' + p.fieldType + ')'); continue; }
  const r = await api('/crm/v3/properties/contacts', { method: 'POST', body: JSON.stringify(body) });
  console.log('  ' + p.name + ': ' + (r.ok ? 'created' : r.status === 409 ? 'exists' : 'FAILED ' + r.status + ' ' + r.text));
}
console.log('done');
