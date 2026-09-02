/* ═══════════════════════════════════════════════════════════════════════════
   DIAGNOSTICS ARE NAME-FREE — SPEC "Acceptance":
     "Every visitor-facing diagnostic string is free of product names (test it)"
   and KIT-BRIEF non-negotiable #2:
     "Capabilities, not tool names, in visitor-facing diagnostic copy. Product
      names appear on solution cards and at routing — never inside the
      snapshot modules."

   So this file drives a real journey to the snapshot and then walks the
   RENDERED DOM of #snapView's three module cards — every text node under
   .snapmod, headings, bar labels, engine rows and findings included — against
   the portfolio blocklist. It reads what is on the screen, not the source: a
   product name that arrives through live research, a JSON edit or a template
   would be caught the same way.

   SCOPE MATTERS. The walk is deliberately confined to .snapmod cards:
     · the capture band legitimately says "Unlocks when we send your report",
       and "Unlock" is also a product (solutions.json id "unlock"). The band
       is outside the module cards, so the honest copy is never mistaken for
       the product, and "unlock" inside a module IS a violation;
     · "Illustrative" tags, findings and rival names all live inside the
       cards, which is exactly the copy the SPEC is talking about.

   Three passes, because the module copy is sourced differently in each:
     A · the real-research journey (nike.com). When /api/ask is answering, the
         rival names in the competitive module are the MODEL'S words, so this
         pass proves a live answer cannot smuggle a product name onto the page.
     B · seeded fiction (an unknown domain) — the offline path, deterministic.
     C · the conversation build rail, which narrates research while it runs and
         is visitor-facing diagnostic copy too.

   Also asserted here: "Illustrative" appears on every module (SPEC S4 /
   snapshot-data.js's own honesty rule — the numbers are fiction and say so).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const H = require('./harness');
const J = require('./journeys');

/* ── the blocklist ────────────────────────────────────────────────────────
   Every product name the portfolio uses, plus the two Stagwell.AI surfaces
   that are products in their own right. Matched as whole words, case
   insensitively — "BERA" must not slip through as "bera", and a finding that
   says "pulse of the category" is a violation too, because a reader cannot
   tell it from The Knowledge Machine (Pulse). */
const BLOCKLIST = [
  { name: 'QuestBrand',        re: /\bquest\s?brand\b/i },
  { name: 'QuestDIY',          re: /\bquest\s?diy\b/i },
  { name: 'BERA',              re: /\bbera(\.ai)?\b/i },
  { name: 'Unlock',            re: /\bunlocks?\b/i },
  { name: 'UNICEPTA',          re: /\bunicepta\b/i },
  { name: 'IMAI',              re: /\bimai\b/i },
  { name: 'GEOPulse',          re: /\bgeo\s?pulse\b/i },
  { name: 'Targeting Machine', re: /\btargeting\s+machine\b/i },
  { name: 'SATS',              re: /\bsats\b/i },
  { name: 'Numetrix',          re: /\bnumetrix\b/i },
  { name: 'Knowledge Machine', re: /\bknowledge\s+machine\b/i },
  { name: 'Pulse',             re: /\bpulse\b/i },
  { name: 'DoReel',            re: /\bdo\s?reel\b/i },
  { name: 'NewVoices',         re: /\bnew\s?voices\b/i },
  { name: 'Agent Cloud',       re: /\bagent\s+cloud\b/i }
];

/* Everything the three module cards actually say, one entry per text-bearing
   element, so a hit can name the node it came from. */
const MODULE_TEXT = () => Array.from(document.querySelectorAll('#snapView .snapmod')).map(card => {
  const nodes = [];
  const walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = String(n.nodeValue || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const owner = n.parentElement;
    nodes.push({ text: t, where: (owner.tagName + (owner.className ? '.' + String(owner.className).split(' ')[0] : '')).toLowerCase() });
  }
  return { mod: card.dataset.mod || '?', all: card.textContent.replace(/\s+/g, ' ').trim(), nodes };
});

function scanModules(check, modules, label) {
  check.eq(`${label}: three module cards on screen`, modules.length, 3);

  for (const m of modules) {
    check.includes(`${label}: module "${m.mod}" is labelled Illustrative`, m.all, 'Illustrative');
  }

  let hits = 0;
  for (const m of modules) {
    for (const node of m.nodes) {
      for (const banned of BLOCKLIST) {
        if (banned.re.test(node.text)) {
          hits++;
          check.ok(`${label}: module "${m.mod}" must not name "${banned.name}"`, false,
            `found in <${node.where}>: "${node.text.slice(0, 140)}"`);
        }
      }
    }
  }
  check.ok(`${label}: all ${BLOCKLIST.length} product names absent from the module cards`,
    hits === 0, hits === 0 ? modules.map(m => m.mod).join(', ') : `${hits} violation(s)`);

  /* a name that is a whole product on its own, in the aggregate text too —
     belt and braces against a name split across two text nodes */
  const joined = modules.map(m => m.all).join(' ⁂ ');
  for (const banned of BLOCKLIST) {
    check.ok(`${label}: "${banned.name}" absent from the joined module text`,
      !banned.re.test(joined));
  }
}

/* ── PASS A · the real-research journey (nike.com) ───────────────────────
   Live when /api/ask answers, seeded when it doesn't — either way the rival
   names in the competitive module come from outside this file, which is the
   point of the pass. ─────────────────────────────────────────────────────── */
async function liveResearchModules(page, check) {
  await H.open(page, '/');
  await H.landingFreeText(page, J.NIKE_MSG, 'dana@nike.com');
  await H.waitQuestion(page, 'q3', 30000);
  await H.clickChip(page, 'Director / VP');
  const mode = await H.answerSize(page, { confirm: "That's right", ask: '2,500+' });
  check.note('q4 mode (live research)', mode);
  await H.waitQuestion(page, 'q5', 25000);
  await H.clickChip(page, 'This quarter');
  await H.waitSnapshot(page);

  const research = await page.evaluate(() => window.SAI.session.research);
  check.note('research', `live=${research && research.live} confidence=${research && research.confidence} ` +
    `competitors=${JSON.stringify(research && research.competitors)}`);

  scanModules(check, await page.evaluate(MODULE_TEXT), 'live');

  /* the capture band's own copy is the near-miss this test is scoped around:
     it MAY say "Unlocks", and it lives outside the module cards. */
  const bandText = await page.textContent('#snapPdfHint');
  check.includes('control: the PDF hint outside the modules still says "Unlocks…"',
    bandText, 'Unlocks when we send your report');
  check.eq('control: the PDF hint is not inside a module card',
    await page.$$eval('#snapView .snapmod #snapPdfHint', e => e.length), 0);

  await H.shot(page, 'diagnostics-live-snapshot');
}

/* ── PASS B · seeded fiction ────────────────────────────────────────────── */
async function seededModules(page, check) {
  await H.open(page, '/');
  /* sprint 7: the survey chip left the landing (its slot went to competitor
     analysis). Typing the same sentence keeps this pass on exactly the same
     journey — an unknown domain, so research must fall back to seeded fiction,
     which is the whole point of pass B. */
  await H.landingFreeText(page, 'I want to run a quick survey', 'founder@' + J.SMB_DOMAIN);
  /* q2 never comes: the business email at the door already named the company */
  await H.waitQuestion(page, 'q3', 30000);
  await H.clickChip(page, 'Founder / owner');
  await H.answerSize(page, { ask: 'Under 50 people' });
  await H.waitQuestion(page, 'q5', 25000);
  await H.clickChip(page, 'This quarter');
  await H.waitSnapshot(page);

  const research = await page.evaluate(() => window.SAI.session.research);
  check.eq('this pass really is the seeded/offline path', research && research.live, false);

  scanModules(check, await page.evaluate(MODULE_TEXT), 'seeded');
  await H.shot(page, 'diagnostics-seeded-snapshot');
}

/* ── PASS C · the rail during the conversation ──────────────────────────
   The build rail is visitor-facing diagnostic copy too — it narrates the
   research as it happens, and the SPEC's rule does not stop at the reveal. */
async function railCopy(page, check) {
  await H.open(page, '/');
  await H.landingFreeText(page, J.NIKE_MSG, 'dana@nike.com');
  await H.waitQuestion(page, 'q3', 30000);
  await page.waitForSelector('#snapshotRail');
  await page.waitForFunction(() => {
    const l = document.querySelector('#railNarration');
    return l && l.children.length >= 3;
  }, null, { timeout: 20000 }).catch(() => {});
  const rail = (await page.textContent('#snapshotRail')).replace(/\s+/g, ' ').trim();
  check.note('rail copy', rail.slice(0, 240));
  const hits = BLOCKLIST.filter(b => b.re.test(rail));
  check.ok('the build rail names no product either', hits.length === 0,
    hits.map(h => h.name).join(', '));
  check.includes('rail names the three modules as CAPABILITIES', rail, 'AI-search visibility');
  await H.shot(page, 'diagnostics-rail');
}

const TESTS = [
  { id: 'D1', name: 'snapshot modules are product-name free · real-research journey (nike.com)', run: liveResearchModules },
  { id: 'D2', name: 'snapshot modules are product-name free · SEEDED fiction', run: seededModules },
  { id: 'D3', name: 'the conversation build rail is product-name free', run: railCopy }
];

if (require.main === module) {
  H.runSuite('ACCEPTANCE · visitor-facing diagnostics carry no product names', TESTS)
    .then(ok => process.exit(ok ? 0 : 1))
    .catch(e => { console.error('SUITE ERROR:', e); process.exit(1); });
}

module.exports = { TESTS, BLOCKLIST };
