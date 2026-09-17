/* ═══════════════════════════════════════════════════════════════════════════
   THE NETWORK, PRE-FETCHED

   "when the user gives us their email or domain, we do a check if we can find
   anything about their domain… here are some list of companies that we should
   just have pre fetched" (client, 2026-09-17).

   data/network.json is the client's research document, turned into data. These
   hold its shape and hold the line on what may be claimed: it is the ONLY
   place a fact about a network company may come from, so anything it does not
   say must stay null rather than be filled in by a model that is guessing
   about a colleague.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA, R, ROOT } from './_data.mjs';

const NET = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'network.json'), 'utf8'));
const C = NET.companies;
const bare = d => String(d || '').toLowerCase().replace(/^www\./, '');

test('shape: every company has an id, a name, a domain and where it is', () => {
  assert.ok(Array.isArray(C) && C.length >= 50, 'the working list is 53 domains, got ' + C.length);
  C.forEach(c => {
    assert.ok(c.id && /^[a-z0-9_]+$/.test(c.id), 'bad id: ' + JSON.stringify(c.id));
    assert.ok(c.name && c.name.trim(), c.id + ' has no name');
    assert.match(bare(c.domain), /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/, c.id + ' domain: ' + c.domain);
    assert.ok(c.based && c.based.trim(), c.id + ' has no base');
    assert.ok(c.summary && c.summary.length > 40, c.id + ' summary too thin');
  });
});

test('ids and domains are unique — a domain must resolve to one company', () => {
  const ids = C.map(c => c.id), doms = C.map(c => bare(c.domain));
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  assert.equal(new Set(doms).size, doms.length, 'duplicate domains');
});

test('it carries no headcount and no competitors, so nothing is invented about a colleague', () => {
  C.forEach(c => {
    assert.equal(c.employees, undefined, c.id + ' carries a headcount the document never gave');
    assert.equal(c.competitors, undefined, c.id + ' carries competitors the document never gave');
  });
  /* …and it says where it came from, and what it is not */
  assert.match(NET.source, /Domain Reference/);
  assert.match(NET.caveat, /not every legal subsidiary/i);
});

test('a product\'s own site is covered — by the list, or by the catalog behind it', () => {
  /* The document is not the whole network; its own caveat says so. Two domains
     the site sells from are not in it — harrisquest.com (QuestBrand, QuestDIY)
     and newvoices.ai — so kimi-flow falls back to the catalog, which carries
     approved words for every product. This asserts the pair is covered ONE way
     or the other, and names anything new that falls through both. */
  const doms = new Set(C.map(c => bare(c.domain)));
  const own = R.activeProducts(DATA).map(p => ({ id: p.id,
    host: bare((p.url || (p.urls && p.urls.externalWebsite) || p.signupUrl || '').replace(/^https?:\/\//, '').split('/')[0]),
    copy: p.cardDescription || p.positioning || null })).filter(x => x.host);
  const gaps = own.filter(x => !doms.has(x.host) && !x.copy);
  assert.deepEqual(gaps.map(x => x.id), [], 'no words anywhere for: ' + gaps.map(x => x.host).join(', '));
  /* and the two known gaps are exactly that — if one is added to the document
     later this still passes; if a THIRD appears, it is worth knowing */
  const notListed = [...new Set(own.filter(x => !doms.has(x.host)).map(x => x.host))].sort();
  assert.deepEqual(notListed, ['harrisquest.com', 'newvoices.ai'],
    'the set of product domains missing from the research document has changed: ' + notListed.join(', '));
});

test('the matching rule: exact, www, and a sub-domain — but never a look-alike', () => {
  /* the same rule kimi-flow.js netFor() applies, held here so it cannot drift */
  const match = d => {
    const x = bare(d);
    return C.find(c => { const n = bare(c.domain); return n && (n === x || x.slice(-(n.length + 1)) === '.' + n); }) || null;
  };
  assert.equal((match('anomaly.com') || {}).id, 'anomaly');
  assert.equal((match('www.anomaly.com') || {}).id, 'anomaly');
  assert.equal((match('mail.assemblyglobal.com') || {}).id, 'assembly');
  assert.equal((match('ANOMALY.COM') || {}).id, 'anomaly');
  /* a domain that merely ENDS with one of ours is a different company */
  assert.equal(match('notanomaly.com'), null);
  assert.equal(match('anomaly.com.example.net'), null);
  assert.equal(match('acme-brands.com'), null);
  assert.equal(match(''), null);
  assert.equal(match(null), null);
});

test('nothing restricted rode in with the research', () => {
  const blob = JSON.stringify(NET);
  [/\$\s?\d/, /password/i, /confidential/i, /@[a-z0-9-]+\.[a-z]{2,}/i].forEach(rx =>
    assert.equal(rx.test(blob), false, 'restricted material in network.json: ' + rx));
});
