/* ═══════════════════════════════════════════════════════════════════════════
   THE JSON IS THE CONTRACT — SPEC "Acceptance":
     "Copy/logic changes require only edits to data/*.json"
   and KIT-BRIEF:
     "The JSON files are the contract: render questions, routing and solution
      content from the data files, never hardcoded in components, so the client
      can tune copy and logic without code changes."

   The proof has to be that nothing in the repo changes. So each test here
   intercepts ONE exact data path — /data/questions.json or /data/routing.json
   — and serves a modified copy of the real file from memory. Not one byte of
   machine/*.js, machine/*.html or data/*.json is edited by this suite. If the
   surface moves, the contract holds; if it doesn't, the copy is hardcoded
   somewhere and the client cannot tune it.

     C1 · questions.json — change q3's copy. The conversation must ask the new
          sentence, verbatim, and never the old one.
     C2 · routing.json — rename a domain's label. The routing screen quotes
          domain labels back at the visitor in its "Why matched:" transparency
          lines and its sub-header; both must move.
     C3 · routing.json — change one cell of the domain × tier matrix. The same
          visitor must land on a different route, with a different screen.

   C3 is the sharp one: it is not copy, it is the routing decision itself.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./harness');
const J = require('./journeys');

const DATA = path.join(H.REPO, 'data');
const readJson = name => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

const NEW_Q3_COPY = 'And what seat do you hold there?';
const RENAMED_LABEL = 'Run Zephyr studies myself (surveys, concept & message testing)';
const SENTINEL = 'zephyr';

/* ── the two edits, made in memory ──────────────────────────────────────── */

function questionsWithNewQ3() {
  const q = readJson('questions.json');
  const q3 = q.questions.find(x => x.id === 'q3');
  q3.copy = NEW_Q3_COPY;
  return q;
}

function routingWithRenamedLabel() {
  const r = readJson('routing.json');
  r.domains.find(d => d.id === 'research').label = RENAMED_LABEL;
  return r;
}

function routingWithFlippedCell() {
  const r = readJson('routing.json');
  const research = r.domains.find(d => d.id === 'research');
  research.cells.smb = { route: 'demo', note: 'flipped by tests/json-contract.js — in memory only' };
  return r;
}

/* ── the journey all three tests share: the SMB research visitor ────────── */

async function driveToQ3(page) {
  await H.open(page, '/');
  await H.landingChip(page, 'I want to run a quick survey');
  await H.waitQuestion(page, 'q2', 30000);
  await H.typeAnswer(page, J.SMB_DOMAIN);
  await H.waitQuestion(page, 'q3', 30000);
}

/* q6 is the adaptive tie-breaker: flow.js retires it when a domain's three
   tier cells all route to the same place, because then no answer can move the
   route. C3 flips one of those cells, so the cells stop agreeing and q6 comes
   back — which is itself the contract working. The driver therefore does not
   assume how many questions are left; it waits for whichever of the two
   arrives and reports what it saw. */
async function driveToPath(page) {
  await H.clickChip(page, 'Founder / owner');
  await H.answerSize(page, { ask: 'Under 50 people' });
  await H.waitQuestion(page, 'q5', 25000);
  await H.clickChip(page, 'This quarter');

  const next = await page.waitForFunction(() => {
    const sv = document.querySelector('#snapView');
    if (sv && !sv.hidden) return 'snapshot';
    const s = window.SAIFLOW && window.SAIFLOW.state();
    if (s && s.question && s.question.id === 'q6') return 'q6';
    return false;
  }, null, { timeout: 30000 }).then(h => h.jsonValue());

  let askedQ6 = false;
  let q6Copy = null;
  if (next === 'q6') {
    askedQ6 = true;
    q6Copy = (await H.flowState(page)).copy;
    await H.typeAnswer(page, "Something we'll run regularly");
  }

  await H.waitSnapshot(page);
  await H.declineEmail(page);
  await H.goToPath(page, '#snapPathGoDeclined');
  return { askedQ6, q6Copy };
}

/* ═══════════════════════════════════════════════════════════════════════════
   C1 · questions.json copy
   ═══════════════════════════════════════════════════════════════════════════ */
async function c1(page, check) {
  const original = readJson('questions.json').questions.find(q => q.id === 'q3').copy;
  check.note('shipped q3 copy', JSON.stringify(original));
  check.ok('the test really is changing something', original !== NEW_Q3_COPY);

  await driveToQ3(page);
  check.note('the routing matrix is untouched here — only q3\'s copy moved', '');

  const state = await H.flowState(page);
  check.eq('the flow reports the JSON copy', state.copy, NEW_Q3_COPY);

  const bubbles = await page.$$eval('#thread .ai__text', e => e.map(x => x.textContent.trim()));
  const last = bubbles[bubbles.length - 1];
  check.eq('the conversation RENDERS the modified copy verbatim', last, NEW_Q3_COPY);
  check.absent('the shipped copy is nowhere on screen', bubbles.join(' ⁂ '), original);

  /* the rest of the question is untouched — this is a copy edit, not a rebuild */
  check.eq('q3 chips still come from the JSON', await H.liveChips(page),
    ['Founder / owner', 'Manager', 'Director / VP', 'C-suite']);

  const asked = H.ofType(await H.allEvents(page), 'question_asked').map(e => e.payload);
  const q3ev = asked.find(p => p.id === 'q3');
  check.eq('the event trail carries the modified copy too', q3ev && q3ev.copy, NEW_Q3_COPY);

  check.eq('no repo file was touched', repoIsClean(), true);
  await H.shot(page, 'contract-c1-questions-copy');
}

/* ═══════════════════════════════════════════════════════════════════════════
   C2 · routing.json domain label
   ═══════════════════════════════════════════════════════════════════════════ */
async function c2(page, check) {
  const original = readJson('routing.json').domains.find(d => d.id === 'research').label;
  check.note('shipped research label', JSON.stringify(original));

  await driveToQ3(page);
  const walk = await driveToPath(page);
  check.eq('a label rename does not disturb the skip logic (q6 still retired)', walk.askedQ6, false);

  const why = (await page.$$eval('#pathView .pathcard__why', e => e.map(x => x.textContent.trim()))).join(' ⁂ ');
  const sub = await page.textContent('#pathView .path__sub');

  check.includes('the "Why matched:" line quotes the RENAMED label', why.toLowerCase(), SENTINEL);
  check.includes('the sub-header quotes it too', String(sub).toLowerCase(), SENTINEL);
  check.absent('the shipped wording is gone from the why-line', why.toLowerCase(), 'run research myself');

  const route = H.lastOf(await H.allEvents(page), 'route_decided');
  check.includes('route_decided carries the renamed label',
    (route.payload.matched[0] || {}).label, 'Zephyr');
  check.eq('renaming a label does NOT change the routing decision', route.payload.route, 'self_serve');

  /* the one place a label rename does not reach — flagged, not failed. See
     tests/README.md "Known limits". */
  const title = await page.textContent('#pathView .pathcard h3');
  check.note('capability card title (path.js CAPABILITY_TITLES, keyed by domain id, not the label)',
    JSON.stringify(String(title).trim()));

  check.eq('no repo file was touched', repoIsClean(), true);
  await H.shot(page, 'contract-c2-routing-label');
}

/* ═══════════════════════════════════════════════════════════════════════════
   C3 · routing.json matrix cell — logic, not copy
   ═══════════════════════════════════════════════════════════════════════════ */
async function c3(page, check) {
  const shipped = readJson('routing.json').domains.find(d => d.id === 'research').cells.smb;
  check.eq('the shipped cell routes this visitor to self-serve', shipped.route, 'self_serve');

  await driveToQ3(page);
  const walk = await driveToPath(page);

  /* the skip logic reads the same edited cells: with the three tier cells no
     longer agreeing, q6 has a tie to break again and comes back on its own.
     Nothing in flow.js knows this test exists. */
  check.eq('the flipped cell brings the adaptive q6 BACK (cells no longer agree)', walk.askedQ6, true);
  check.eq('…asking questions.json\'s own byDomain copy for "research"', walk.q6Copy,
    'Is this a one-off study, or something you\'ll run regularly?');

  const route = H.lastOf(await H.allEvents(page), 'route_decided');
  check.eq('the SAME visitor now routes to demo', route.payload.route, 'demo');
  check.eq('…still tier smb, still the research domain',
    [route.payload.tier, route.payload.primaryDomain], ['smb', 'research']);
  check.eq('…and no override was needed to do it', route.payload.override, null);
  check.includes('the flipped cell note rides along', route.payload.cellNote, 'in memory only');

  check.eq('the dominant self-serve hero is GONE',
    await page.$$eval('#pathView .pathhero', e => e.length), 0);
  check.eq('the three-column row is back', await page.$$eval('#pathView .pathcol', e => e.length), 3);
  check.eq('DEMO now carries RECOMMENDED',
    await page.$$eval('#pathView .pathcol.is-recommended h3', e => e.map(x => x.textContent.trim())),
    ['Get a demo of one capability']);

  check.eq('no repo file was touched', repoIsClean(), true);
  await H.shot(page, 'contract-c3-routing-cell');
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE PROOF'S OWN PROOF — the data files on disk are byte-identical to what
   they were when the suite started. Nothing here edits the repo.
   ═══════════════════════════════════════════════════════════════════════════ */
const FILES = ['questions.json', 'routing.json', 'solutions.json', 'campaigns.json', 'brand.json'];
const baseline = {};
for (const f of FILES) baseline[f] = fs.readFileSync(path.join(DATA, f));

function repoIsClean() {
  return FILES.every(f => Buffer.compare(baseline[f], fs.readFileSync(path.join(DATA, f))) === 0);
}

const TESTS = [
  { id: 'C1', name: 'questions.json · q3 copy edit renders verbatim, no code change',
    context: { beforePage: ctx => H.interceptJson(ctx, '/data/questions.json', questionsWithNewQ3()) },
    run: c1 },
  { id: 'C2', name: 'routing.json · a renamed domain label reaches the path screen',
    context: { beforePage: ctx => H.interceptJson(ctx, '/data/routing.json', routingWithRenamedLabel()) },
    run: c2 },
  { id: 'C3', name: 'routing.json · one flipped matrix cell reroutes the same visitor',
    context: { beforePage: ctx => H.interceptJson(ctx, '/data/routing.json', routingWithFlippedCell()) },
    run: c3 }
];

if (require.main === module) {
  H.runSuite('ACCEPTANCE · copy and logic live in data/*.json', TESTS).then(ok => {
    process.stdout.write(`\n  data/*.json byte-identical after the run: ${repoIsClean() ? 'YES' : 'NO'}\n`);
    process.exit(ok && repoIsClean() ? 0 : 1);
  }).catch(e => { console.error('SUITE ERROR:', e); process.exit(1); });
}

module.exports = { TESTS };
