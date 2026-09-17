/* ═══════════════════════════════════════════════════════════════════════════
   THE DEEP CONTENT — one file, two surfaces.

   data/explainers.json is read by the product page (next/build-product-pages.py
   injects it between the explainer markers) and walked by SAIKIMI.explore() in
   the chat. These tests hold the two together and hold the line on what may be
   said: an `answerOnly` item is the agent's honest answer to a direct question
   and must never be printed on a page or offered as a chip.
   ═══════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA, R, CARDS, ROOT } from './_data.mjs';

const EX = DATA.explainers.products;
const esc = x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const page = id => {
  const own = { machines_family: 'the-machine', targeting_machine: 'targeting-machine', newvoices: 'newvoices', agent_cloud: 'agent-cloud' };
  const p = own[id] ? path.join(ROOT, 'next', own[id] + '.html') : path.join(ROOT, 'next', 's', id + '.html');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

test('shape: every explainer names a real product and every item is complete', () => {
  Object.keys(EX).forEach(id => {
    assert.ok(R.productById(id, DATA), id + ' is not a product in the catalog');
    const x = EX[id];
    assert.ok(x.name && x.source, id + ' needs a display name and a source');
    (x.differentiators || []).forEach(d => assert.ok(d.id && d.title && d.line, id + ' differentiator ' + JSON.stringify(d)));
    (x.connectsTo || []).forEach(d => assert.ok(d.id && d.title && d.line, id + ' connectsTo ' + JSON.stringify(d)));
    (x.useCaseGroups || []).forEach(g => {
      assert.ok(g.id && g.label && Array.isArray(g.items) && g.items.length, id + ' group ' + g.id);
      g.items.forEach(c => assert.ok(c.id && c.name && c.line, id + ' case ' + JSON.stringify(c)));
    });
    (x.notDo || []).forEach(n => assert.ok(n.id && n.claim && n.instead, id + ' notDo ' + JSON.stringify(n)));
    /* ids are unique across the whole tree — explore() addresses nodes by them */
    const ids = [].concat((x.differentiators || []).map(d => d.id), (x.connectsTo || []).map(d => d.id),
      (x.useCaseGroups || []).map(g => g.id), (x.useCaseGroups || []).flatMap(g => g.items.map(c => c.id)),
      (x.notDo || []).map(n => n.id));
    assert.equal(new Set(ids).size, ids.length, id + ' has duplicate item ids');
  });
});

test('the page renders from the same file — every item is on it, in order', () => {
  Object.keys(EX).forEach(id => {
    const html = page(id);
    if (!html || html.indexOf('explainers:start') === -1) return;   /* this product has no markers yet */
    const x = EX[id];
    const between = html.slice(html.indexOf('explainers:start'), html.indexOf('<!-- explainers:end -->'));
    let at = -1;
    const inOrder = (txt, what) => {
      const i = between.indexOf(esc(txt));
      assert.ok(i !== -1, id + ' page is missing ' + what + ': ' + txt.slice(0, 60));
      assert.ok(i > at, id + ' page has ' + what + ' out of order: ' + txt.slice(0, 40));
      at = i;
    };
    (x.differentiators || []).forEach(d => { inOrder(d.title, 'differentiator'); inOrder(d.line, 'differentiator line'); });
    (x.useCaseGroups || []).forEach(g => { inOrder(g.label, 'group'); g.items.forEach(c => { inOrder(c.name, 'use case'); inOrder(c.line, 'use case line'); }); });
    (x.connectsTo || []).forEach(c => { inOrder(c.title, 'connects'); inOrder(c.line, 'connects line'); });
  });
});

test('answerOnly never reaches a page: the does-NOT-do list is for questions, not for reading', () => {
  Object.keys(EX).forEach(id => {
    const html = page(id);
    if (!html) return;
    (EX[id].notDo || []).filter(n => n.answerOnly).forEach(n => {
      assert.equal(html.indexOf(esc(n.claim)), -1, id + ' page prints a does-not-do claim: ' + n.claim);
    });
  });
});

test('a visitor never sees a routing label: every product renders a name meant for people', () => {
  R.activeProducts(DATA).forEach(p => {
    const shown = p.displayName || p.name;
    assert.ok(!/\(|\)|family frame|internal/i.test(shown), p.id + ' would show "' + shown + '"');
  });
  /* the one entry whose catalog name IS a routing label carries a display name */
  const m = R.productById('machines_family', DATA);
  assert.equal(m.displayName, 'The Machine');
  assert.match(m.name, /family frame/, 'the routing label is kept for the engine');
  /* and the card builds both its title and its why-line from the display name */
  const reco = R.recommend({ intents: [{ id: 'marketing_operations', explicit: true }] }, DATA);
  assert.equal(reco.primary, 'machines_family');
  const card = CARDS.buildCards(reco, reco.signals, DATA, DATA.kimi.copy, {})[0];
  assert.equal(card.productName, 'The Machine');
  assert.ok(!/family frame/.test(card.whyThisFits), 'why-line: ' + card.whyThisFits);
  assert.match(card.whyThisFits, /^The Machine/);
});

test('the detour answers before it asks: the root carries a summary, not a question back', () => {
  Object.keys(EX).forEach(id => {
    const x = EX[id];
    assert.ok(x.summary && x.summary.length > 80, id + ' needs a summary to lead with');
    assert.ok(!/\?\s*$/.test(x.summary), id + ' summary should answer, not ask: ' + x.summary.slice(-40));
  });
  assert.equal(DATA.kimi.copy.explore.root, '{summary}', 'the root step says the summary');
  assert.ok(DATA.kimi.copy.explore.rootAfter, 'and leads into the differentiators');
});

test('The Machine carries everything the product team sent', () => {
  const m = EX.machines_family;
  assert.equal(m.name, 'The Machine');
  assert.equal(m.differentiators.length, 3);
  assert.equal(m.useCaseGroups.length, 5);
  assert.equal(m.useCaseGroups.reduce((n, g) => n + g.items.length, 0), 15, 'the Use Case Library is fifteen');
  assert.equal(m.connectsTo.length, 4);
  assert.ok(m.notDo.length >= 6, 'the guardrail list');
  /* the two things the site did not say anywhere before */
  assert.ok(/Mini-Machines/.test(JSON.stringify(m.differentiators)));
  assert.ok(/Workfront/.test(JSON.stringify(m.differentiators)));
});

test('nothing in the deep content is restricted: no client, no price, no person, no credential', () => {
  const blob = JSON.stringify(EX);
  [/ConEd/i, /Suntory/i, /Verizon/i, /\bIBM\b/, /Starbucks/i, /ServiceNow/i, /\bAmazon\b/i, /Bloomberg/i, /\bNFL\b/,
    /\$\s?\d/, /CTLabsSummit/i, /vercel\.app/i, /patent pending/i, /Harris Baum/i, /Jean McCabe/i, /Bryan Vannoy/i, /Arjun/i,
    /#ct-machine/i, /\bQ[1-4]\s?20\d\d/].forEach(rx =>
    assert.equal(rx.test(blob), false, 'restricted material in explainers.json: ' + rx));
});

test('every keyword is lower case and distinctive enough to match on', () => {
  Object.keys(EX).forEach(id => {
    const all = [].concat(EX[id].differentiators || [], EX[id].connectsTo || [], EX[id].notDo || [],
      (EX[id].useCaseGroups || []).flatMap(g => g.items));
    all.forEach(it => (it.keywords || []).forEach(k => {
      assert.equal(k, k.toLowerCase(), id + ' keyword not lower case: ' + k);
      assert.ok(k.length >= 3, id + ' keyword too short: ' + k);
    }));
  });
});
