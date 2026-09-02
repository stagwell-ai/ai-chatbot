/* ═══════════════════════════════════════════════════════════════════════════
   JOURNEYS — the five demo scripts from reference/kit/KIT-BRIEF.md, plus the
   sixth the client asked for in the sprint-7 round (competitor analysis)
   ("Demo script to satisfy"), run end to end against the real pages and the
   real /api/ask, and asserted twice over: once on what the visitor SEES, and
   once on the event trail the demo claims it sends to HubSpot
   (window.SAI.events.list(), SPEC S6).

     J1  master ad     → website + two problems in one message → consultative
     J2  product ad    → /p/targeting-machine → pre-seeded opener → demo
     J3  SMB founder   → "I want to run a quick survey" → self-serve, dominant
     J4  small company × enterprise-shaped product → demo, a real ask
     J5  decline email → snapshot survives, PDF stays locked, session anonymous
     J6  competitor analysis → chip → real rivals at q6 → QuestBrand (sprint 7)

   ── ON LIVE RESEARCH ──────────────────────────────────────────────────────
   /api/ask is proxied to the deployed function, so research is genuinely
   live. That makes exactly one thing non-deterministic: whether q4 arrives as
   the one-tap CONFIRM ("Looks like Nike is around 83,700 people…") or as the
   plain ASK. flow.js waits researchWaitMs (4s) for research and then asks the
   plain question — so a slow model, or no key at all, legitimately produces
   ask mode, and the demo is still correct. Every journey therefore reads the
   mode at runtime, answers whichever face is on screen with a chip that lands
   on the same tier, and RECORDS the mode as a note. The route assertions are
   identical either way. J1 additionally notes when confirm mode did not
   appear, rather than failing: that is the honest-fallback path, not a bug.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./harness');

const NIKE_MSG = "Reach better audiences — and prove it moved the business, we're at nike.com";
const SMB_DOMAIN = 'smallco-fictional-demo.example';
const EXPLORER_DOMAIN = 'northwind-demo-brand.example';

/* the campaign opener is client copy and has been rewritten once already —
   read it from the contract rather than pinning a literal that goes stale
   the next time the wording changes */
const OPENER = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'data', 'campaigns.json'), 'utf8'))
  .campaigns.find(c => c.id === 'targeting-machine').opener;

/* every handoff link must carry all four params (SPEC S5, path.js) */
function assertAttributed(check, links, route, label) {
  check.ok(`${label}: at least one attributed handoff link`, links.length > 0, `${links.length} link(s)`);
  for (const l of links) {
    const p = new URL(l.href).searchParams;
    check.eq(`${label}: "${l.text}" utm_source`, p.get('utm_source'), 'stagwell-ai');
    check.ok(`${label}: "${l.text}" utm_medium`, !!p.get('utm_medium'), p.get('utm_medium'));
    check.ok(`${label}: "${l.text}" utm_campaign`, !!p.get('utm_campaign'), p.get('utm_campaign'));
    check.eq(`${label}: "${l.text}" sai_route`, p.get('sai_route'), route);
  }
}

const handoffLinks = page => page.$$eval('#pathView a[data-handoff]',
  els => els.map(e => ({ text: e.textContent.trim(), href: e.href, solution: e.dataset.solution })));

/* clicking a handoff opens a new tab (target=_blank); catch it, close it, and
   prove the click was logged. */
async function clickFirstHandoff(page) {
  const link = page.locator('#pathView a[data-handoff]').first();
  const [popup] = await Promise.all([
    page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null),
    link.click()
  ]);
  if (popup) await popup.close().catch(() => {});
  await page.waitForTimeout(120);
}

/* ═══════════════════════════════════════════════════════════════════════════
   J1 · MASTER AD — the multi-product opportunity
   ═══════════════════════════════════════════════════════════════════════════ */
async function j1(page, check, opts) {
  const o = opts || {};
  await H.open(page, '/');
  /* THE LANDING IS A CHOOSER NOW (machine/hero.js, after Meta's ad-objective
     dialog): a radio list of problems, a business email, Ask AI. */
  check.eq('landed on the master landing — the picker is up',
    await page.$$eval('#heroPick .pick__row', e => e.length), 5);
  check.eq('the email field asks for a BUSINESS address',
    await page.getAttribute('#pickEmail', 'placeholder'), 'My business email');

  /* the whole of script 1's opening move in one message: two problems and a
     website. SPEC non-negotiable #1 — the website answers the company
     question and starts research. */
  await H.landingFreeText(page, NIKE_MSG, 'dana@nike.com');

  await H.waitQuestion(page, 'q3', 30000);
  const afterStart = await H.flowState(page);
  const skippedIds = afterStart.skipped.map(s => s.id);
  const reason = id => (afterStart.skipped.find(s => s.id === id) || {}).reason;

  check.ok('q1 skipped — the message carried the problems', skippedIds.includes('q1'), reason('q1'));
  check.ok('q2 SKIPPED — the company is already known', skippedIds.includes('q2'), reason('q2'));
  check.eq('q2 skip reason — they typed the site themselves, so nothing to confirm',
    reason('q2'), 'website_in_first_message');
  check.eq('and it is the right company',
    await page.evaluate(() => window.SAI.session.slots.company_domain), 'nike.com');
  check.eq('two problem domains found (multi-product)',
    await page.evaluate(() => (window.SAI.session.slots.problem_domains || []).slice().sort()),
    ['audiences', 'business_impact']);
  check.eq('company_domain filled from the message',
    await page.evaluate(() => window.SAI.session.slots.company_domain), 'nike.com');
  check.eq('first question actually asked is q3', afterStart.id, 'q3');

  await H.clickChip(page, 'Director / VP');

  /* q4 — the demo's showcase moment. Confirm mode when live research came
     back confident inside 4s; ask mode otherwise, which is legitimate. */
  await H.waitQuestion(page, 'q4', 30000);
  const q4 = await H.flowState(page);
  const research = await page.evaluate(() => window.SAI.session.research);
  if (q4.mode === 'confirm') {
    check.ok('q4 became a ONE-TAP CONFIRM (live research was confident)', true, q4.copy);
    check.eq('confirm offers exactly three one-tap chips', q4.chips.length, 3);
    check.includes('confirm copy names the company', q4.copy, 'Nike');
    check.ok('research reports high confidence', research && research.confidence === 'high',
      research && research.confidence);
    check.ok('research ran live', !!(research && research.live), String(research && research.live));
  } else {
    check.note('q4 fell back to ASK mode — live research was not confident in time (legitimate offline path)',
      `confidence=${research && research.confidence} live=${research && research.live} ms=${research && research.ms}`);
    check.ok('ask mode still offers the four size chips', q4.chips.length === 4, q4.chips.join(' | '));
  }
  await H.clickChip(page, q4.mode === 'confirm' ? "That's right" : '2,500+');

  await H.waitQuestion(page, 'q5', 25000);
  await H.clickChip(page, 'This quarter');

  /* ── SNAPSHOT ── */
  await H.waitSnapshot(page);
  check.eq('snapshot pushed /snapshot', new URL(page.url()).pathname, '/snapshot');
  check.includes('snapshot headline is "[Company] vs. your market"',
    await page.textContent('#snapView .snap__title'), 'vs. your market');
  check.eq('three modules rendered', await page.$$eval('#snapView .snapmod', e => e.length), 3);
  check.ok('PDF button is visibly LOCKED before capture',
    await page.getAttribute('#snapPdfBtn', 'disabled') !== null);
  check.includes('lock hint', await page.textContent('#snapPdfHint'), 'Unlocks when we send your report');
  await H.shot(page, 'j1-snapshot');

  /* ── CAPTURE ── */
  await H.captureEmail(page, 'demo@nike.com', true);
  check.ok('PDF unlocked after capture', await page.getAttribute('#snapPdfBtn', 'disabled') === null);

  const capEvents = await H.allEvents(page);
  const cap = H.lastOf(capEvents, 'capture_email');
  check.ok('capture_email logged', !!cap);
  check.eq('capture_email carries the email DOMAIN only (never the address)',
    cap && cap.payload, { domain: 'nike.com' });
  check.eq('capture_consent logged as granted',
    (H.lastOf(capEvents, 'capture_consent') || {}).payload, { consent: true });
  check.ok('journey_converted logged', !!H.lastOf(capEvents, 'journey_converted'));
  check.ok('snapshot_viewed logged', !!H.lastOf(capEvents, 'snapshot_viewed'));

  /* ── PATH ── */
  await H.goToPath(page, '#snapPathGo');
  check.eq('path pushed /path', new URL(page.url()).pathname, '/path');

  const cards = await page.$$eval('#pathView .pathcard h3', e => e.map(x => x.textContent.trim()));
  check.eq('TWO capability cards (multi-product)', cards.length, 2);
  check.ok('cards are capability titles, no product name in the heading',
    cards.every(c => !/QuestBrand|BERA|Targeting Machine|GEOPulse|IMAI|UNICEPTA|Numetrix/i.test(c)),
    cards.join(' | '));
  const whys = await page.$$eval('#pathView .pathcard__why', e => e.map(x => x.textContent.trim()));
  check.ok('every card carries a "Why matched:" transparency line',
    whys.length === 2 && whys.every(w => w.startsWith('Why matched:')), whys.join(' | '));
  check.includes('the two-capability note is shown',
    await page.textContent('#pathView .path__sectionhead'), 'they work better together');

  const recommended = await page.$$eval('#pathView .pathcol.is-recommended .pathcol__eyebrow, #pathView .pathcol.is-recommended h3',
    e => e.map(x => x.textContent.trim()));
  check.ok('CONSULTATIVE column carries RECOMMENDED',
    recommended.includes('RECOMMENDED') && recommended.includes('Talk it through with Stagwell'),
    recommended.join(' | '));

  const route = H.lastOf(await H.allEvents(page), 'route_decided');
  check.eq('route_decided = consultative', route && route.payload.route, 'consultative');
  check.eq('…via override 1 (multi-product outranks any cell)', route && route.payload.override.order, 1);
  check.eq('two matched domains on the decision',
    route && route.payload.matched.map(m => m.domain).sort(), ['audiences', 'business_impact']);

  const links = await handoffLinks(page);
  assertAttributed(check, links, 'consultative', 'handoff');
  await clickFirstHandoff(page);
  check.ok('handoff_click logged with attribution',
    H.countOf(await H.allEvents(page), 'handoff_click') >= 1);

  await H.shot(page, 'j1-path');
  if (o.onDone) o.onDone({ asked: (await H.flowState(page)).asked });
}

/* ═══════════════════════════════════════════════════════════════════════════
   J2 · PRODUCT AD — /p/targeting-machine, opener replayed, demo route
   ═══════════════════════════════════════════════════════════════════════════ */
async function j2(page, check, opts) {
  const o = opts || {};
  await H.open(page, '/p/targeting-machine');
  await page.waitForSelector('#agentPanel');
  check.includes('product landing shows the pre-seeded opener (campaigns.json)',
    await page.textContent('#agentPanel .bubble'), OPENER);
  check.ok('cross-discovery chip is on the panel (SPEC S2)',
    await page.locator('#agentPanel .chip:text-is("What else fits my problem?")').count() === 1);
  await H.shot(page, 'j2-product-landing');

  /* the ad landing captures the business email at the start of the journey
     (client, Sep 2), so it is filled before anything can hand off */
  check.ok('the panel asks for a business email', await page.$('#askEmail') !== null);
  await page.fill('#askEmail', 'dana@nike.com');

  /* a chip tap on the product page is a HANDOFF to the master page with the
     conversation pre-armed (?utm_campaign=…&autostart=1&q=…) */
  await Promise.all([
    page.waitForURL(/autostart=1/, { timeout: 20000 }),
    page.locator('#agentPanel .chip:text-is("Build audiences from my first-party data")').click()
  ]);
  await page.waitForFunction(() => !!(window.SAI && window.SAI.ready));
  await page.evaluate(() => window.SAI.ready);

  await H.waitQuestion(page, 'q2', 30000);
  check.eq('autostarted into /chat', new URL(page.url()).pathname, '/chat');
  check.eq('the email rode across, so q2 confirms the site rather than asking',
    (await H.flowState(page)).mode, 'confirm');
  check.eq('and the company came out of its domain',
    await page.evaluate(() => window.SAI.session.slots.company_domain), 'nike.com');
  await H.confirmSite(page);

  const thread = await page.$$eval('#thread .ai__text, #thread .bubble', e => e.map(x => x.textContent.trim()));
  check.ok('the opener exchange is REPLAYED, not re-asked',
    thread[0] && thread[0].startsWith(OPENER) &&
    thread[1] === 'Build audiences from my first-party data', thread.slice(0, 2).join(' >> '));

  const attrib = await page.evaluate(() => window.SAI.session.attribution);
  check.eq('attribution captured silently on entry', attrib.utm_campaign, 'targeting-machine');
  check.eq('product interest pre-filled from the ad', attrib.product_interest, 'targeting_machine');

  await H.waitQuestion(page, 'q3', 30000);
  await H.clickChip(page, 'Director / VP');
  const mode = await H.answerSize(page, { confirm: "That's right", ask: '2,500+' });
  check.note('q4 mode', mode);
  await H.waitQuestion(page, 'q5', 25000);
  await H.clickChip(page, 'This quarter');

  await H.waitSnapshot(page);
  check.eq('snapshot reached', new URL(page.url()).pathname, '/snapshot');
  await H.shot(page, 'j2-snapshot');

  /* ── the "one less question" claim (campaigns.json openerNote) ── */
  const result = await page.evaluate(() => window.SAIFLOW.result());
  const skipReason = id => (result.skipped.find(s => s.id === id) || {}).reason;
  check.eq('q1 SKIPPED — the ad already asked it', skipReason('q1'), 'product_ad_prefill');
  check.eq('q6 SKIPPED — the opener IS the q6 detail', skipReason('q6'), 'answered_in_campaign_opener');

  const events = await H.allEvents(page);
  const askedIds = H.ofType(events, 'question_asked').map(e => e.payload.id);
  const standardAsked = askedIds.filter(id => /^q[1-6]$/.test(id));
  check.eq('question_asked trail', askedIds, ['campaign-opener', 'q2', 'q3', 'q4', 'q5']);
  check.ok('fewer standard questions than the full master ladder (q1–q6)',
    standardAsked.length < 6, `${standardAsked.length} of 6 asked: ${standardAsked.join(',')}`);
  check.ok('the campaign entry retired two of them',
    ['q1', 'q6'].every(id => result.skipped.some(s => s.id === id)),
    result.skipped.map(s => `${s.id}:${s.reason}`).join(' | '));

  await H.captureEmail(page, 'demo@nike.com', true);
  await H.goToPath(page, '#snapPathGo');

  const route = H.lastOf(await H.allEvents(page), 'route_decided');
  check.eq('route_decided = demo', route && route.payload.route, 'demo');
  check.eq('single domain: audiences', route && route.payload.matched.map(m => m.domain), ['audiences']);
  check.eq('tier resolved to enterprise', route && route.payload.tier, 'enterprise');
  check.eq('no override fired — the matrix decided', route && route.payload.override, null);

  const rec = await page.$$eval('#pathView .pathcol.is-recommended h3', e => e.map(x => x.textContent.trim()));
  check.eq('DEMO column carries RECOMMENDED', rec, ['Get a demo of one capability']);
  check.eq('one capability card', await page.$$eval('#pathView .pathcard h3', e => e.length), 1);
  check.includes('scheduler placeholder is present (SPEC S5)',
    await page.textContent('#pathView .pathcol__slot'), 'CALENDAR');

  assertAttributed(check, await handoffLinks(page), 'demo', 'handoff');
  check.ok('handoff links carry the CAMPAIGN attribution, not master',
    (await handoffLinks(page)).every(l => new URL(l.href).searchParams.get('utm_campaign') === 'targeting-machine'));

  await H.shot(page, 'j2-path');
  if (o.onDone) o.onDone({ askedIds, standardAsked });
}

/* ═══════════════════════════════════════════════════════════════════════════
   J3 · SMB SELF-SERVE — unknown domain, honest fallback, dominant trial CTA
   ═══════════════════════════════════════════════════════════════════════════ */
async function j3(page, check) {
  await H.open(page, '/');
  /* CHANGED, sprint 7: "I want to run a quick survey" is no longer a landing
     chip — the fourth slot went to competitor analysis (data/questions.json
     q1.chips), which is where the client says the demand is. Research did not
     go anywhere: it is reachable by typing, and by the solution directory. So
     this journey types the sentence the chip used to carry, which is a
     STRONGER test than the chip was — the chip resolved through a label
     lookup in the data, this goes through the classifier for real. */
  await H.landingFreeText(page, 'I want to run a quick survey', 'founder@' + SMB_DOMAIN);

  await H.waitQuestion(page, 'q3', 30000);
  check.eq('the classifier still resolves the survey sentence to research',
    await page.evaluate(() => window.SAI.session.slots.problem_domains), ['research']);
  check.eq('the company came from the business email, so q2 was never asked',
    await page.evaluate(() => window.SAI.session.slots.company_domain), SMB_DOMAIN);
  await H.clickChip(page, 'Founder / owner');

  /* an unknown domain cannot be confirmed — research must fall back to seeded
     fiction and q4 must ask honestly rather than assert a size it invented. */
  await H.waitQuestion(page, 'q4', 30000);
  const q4 = await H.flowState(page);
  const research = await page.evaluate(() => window.SAI.session.research);
  check.eq('unknown domain → q4 asks (no invented confirmation)', q4.mode, 'ask');
  check.eq('research confidence is honest about the fallback', research && research.confidence, 'low');
  check.eq('research is seeded, not live', research && research.live, false);
  check.eq('four size chips', q4.chips.length, 4);
  await H.clickChip(page, 'Under 50 people');

  await H.waitQuestion(page, 'q5', 25000);
  await H.clickChip(page, 'This quarter');

  await H.waitSnapshot(page);
  check.includes('snapshot names the company seeded from the domain',
    await page.textContent('#snapView .snap__title'), 'Smallco');
  await H.shot(page, 'j3-snapshot');

  /* ── DECLINE — the snapshot is free to view (non-negotiable #3) ── */
  await H.declineEmail(page);
  check.eq('the three modules STAY on screen after declining',
    await page.$$eval('#snapView .snapmod', e => e.filter(x => x.offsetParent !== null).length), 3);
  check.ok('PDF stays locked', await page.getAttribute('#snapPdfBtn', 'disabled') !== null);
  const declEvents = await H.allEvents(page);
  check.ok('capture_declined logged', H.countOf(declEvents, 'capture_declined') === 1);
  /* the door capture stands; declining the report adds nothing to it */
  check.eq('no SECOND capture_email from the decline',
    H.countOf(declEvents, 'capture_email'), 1);
  check.eq('no journey_converted', H.countOf(declEvents, 'journey_converted'), 0);

  /* ── PATH, reached via the declined link ── */
  await H.goToPath(page, '#snapPathGoDeclined');

  const route = H.lastOf(await H.allEvents(page), 'route_decided');
  check.eq('route_decided = self_serve', route && route.payload.route, 'self_serve');
  check.eq('tier = smb', route && route.payload.tier, 'smb');

  check.eq('the three-column row is REPLACED by the dominant hero',
    await page.$$eval('#pathView .pathcol', e => e.length), 0);
  check.includes('dominant hero copy',
    await page.textContent('#pathView .pathhero__title'), 'You can start right now');
  const trial = await page.$$eval('#pathView .pathhero__cta',
    e => e.map(x => ({ text: x.textContent.trim(), href: x.href,
      gold: x.classList.contains('btn--gold'), disabled: x.classList.contains('is-disabled') })));
  check.eq('one dominant CTA', trial.length, 1);
  /* CHANGED, client round Aug 31 (complaint A): the hero used to promise
     "Start your free trial" for every self-serve route, whether or not the
     product had a signup to go to. solutions.json now says: QuestDIY has a
     product site (url) and no public self-serve door (signupUrl:null), so the
     honest hero sends the visitor to the product site and says why underneath.
     The offer only reads "Start your free trial →" where a signupUrl exists
     (today: IMAI and the SMB platform). */
  /* QuestDIY has a free trial (client, Sep 2): solutions.json carries a
     signupUrl, so the hero renders the real trial door — and no
     "signup is coming" caption, because signup is not coming, it is here. */
  check.includes('CTA copy is the real trial door',
    trial[0] && trial[0].text, 'Start your free trial');
  check.ok('and it is a real, enabled marigold button',
    trial[0] && trial[0].gold === true && trial[0].disabled === false);
  check.eq('no "signup is coming" caption under a real trial',
    await page.$$eval('#pathView .pathhero__note', e => e.filter(x => /signup is coming/i.test(x.textContent)).length), 0);
  check.includes('trial link points at harrisquest questdiy', trial[0] && trial[0].href,
    'harrisquest.com/suite/questdiy');
  check.includes('trial link carries sai_route=self_serve', trial[0] && trial[0].href, 'sai_route=self_serve');
  check.eq('no enabled marigold button anywhere says PENDING',
    await page.$$eval('#pathView .btn--gold:not(.is-disabled)',
      e => e.filter(x => /PRODUCT SITE/i.test(x.textContent)).length), 0);
  assertAttributed(check, await handoffLinks(page), 'self_serve', 'handoff');

  const collapsed = await page.$$eval('#pathView .pathcollapse__link, #pathView .pathhero__walk',
    e => e.map(x => x.textContent.trim()));
  check.ok('the other paths collapse to text links (non-negotiable #5)',
    collapsed.length >= 2, collapsed.join(' | '));
  check.eq('no other gold button competes with the trial CTA',
    await page.$$eval('#pathView .btn--gold', e => e.length), 1);

  await H.shot(page, 'j3-path');
}

/* ═══════════════════════════════════════════════════════════════════════════
   J4 · SMALL COMPANY, ENTERPRISE-SHAPED PRODUCT — a real ask, not a nurture.
   Until Sep 2 this visitor (Sales / audiences × SMB) hit a follow_up cell and
   a "no meeting needed" card; the client retired that route — everyone ends
   on a trial, a demo or a conversation — and "Just exploring" left q5 with it.
   ═══════════════════════════════════════════════════════════════════════════ */
async function j4(page, check) {
  await H.open(page, '/');
  await H.landingChip(page, 'Sales', 'someone@' + EXPLORER_DOMAIN);

  await H.waitQuestion(page, 'q3', 30000);
  check.eq('domain classified from the chip',
    await page.evaluate(() => window.SAI.session.slots.problem_domains), ['audiences']);
  check.eq('and the company came from the email at the door',
    await page.evaluate(() => window.SAI.session.slots.company_domain), EXPLORER_DOMAIN);
  await H.clickChip(page, 'Founder / owner');
  const mode = await H.answerSize(page, { ask: 'Under 50 people' });
  check.eq('unknown domain → q4 asks', mode, 'ask');

  await H.waitQuestion(page, 'q5', 25000);
  const q5 = await H.flowState(page);
  check.eq('q5 offers exactly two timings — "Just exploring" is gone', q5.chips, ['This quarter', 'This year']);
  check.ok('q5 copy no longer mentions exploring', !/exploring/i.test(await page.textContent('#thread')));
  await H.clickChip(page, 'This year');

  await H.waitSnapshot(page);
  check.eq('snapshot shown', await page.$$eval('#snapView .snapmod', e => e.length), 3);
  await H.shot(page, 'j4-snapshot');

  const result = await page.evaluate(() => window.SAIFLOW.result());
  check.eq('q6 retired because every audiences cell now routes the same way',
    (result.skipped.find(s => s.id === 'q6') || {}).reason, 'single_route_domain');

  await H.captureEmail(page, 'demo@' + EXPLORER_DOMAIN, true);
  await H.goToPath(page, '#snapPathGo');

  const route = H.lastOf(await H.allEvents(page), 'route_decided');
  check.eq('route_decided payload = demo (the old follow_up cell)', route && route.payload.route, 'demo');
  check.eq('…from the matrix, no override', route && route.payload.override, null);
  check.eq('tier resolved as smb', route && route.payload.tier, 'smb');

  /* ── A REAL ASK ── */
  check.eq('the three-column row is back', await page.$$eval('#pathView .pathcol', e => e.length), 3);
  check.eq('one recommended column', await page.$$eval('#pathView .pathcol.is-recommended', e => e.length), 1);
  check.ok('…and it is the demo',
    /demo/i.test(await page.textContent('#pathView .pathcol.is-recommended')));
  check.ok('a primary CTA exists on the path screen',
    (await page.$$eval('#pathView .btn--gold', e => e.length)) >= 1);
  const txt = await page.textContent('#pathView');
  check.ok('no nurture copy anywhere', !/No meeting needed|stays right here|on its way/.test(txt));
  check.eq('no follow_up wording in any event',
    (await H.allEvents(page)).filter(e => JSON.stringify(e).indexOf('follow_up') !== -1).length, 0);

  await H.shot(page, 'j4-path');
}

/* ═══════════════════════════════════════════════════════════════════════════
   J5 · ANONYMOUS — J1's visitor declines. Snapshot survives; nothing is sent.
   ═══════════════════════════════════════════════════════════════════════════ */
async function j5(page, check) {
  await H.open(page, '/');
  await H.landingFreeText(page, NIKE_MSG, 'dana@nike.com');

  await H.waitQuestion(page, 'q3', 30000);
  await H.clickChip(page, 'Director / VP');
  const mode = await H.answerSize(page, { confirm: "That's right", ask: '2,500+' });
  check.note('q4 mode', mode);
  await H.waitQuestion(page, 'q5', 25000);
  await H.clickChip(page, 'This quarter');

  await H.waitSnapshot(page);
  const before = await page.$$eval('#snapView .snapmod .snapmod__finding', e => e.map(x => x.textContent.trim()));
  check.eq('three module findings before the decline', before.length, 3);

  await H.declineEmail(page);

  const after = await page.$$eval('#snapView .snapmod .snapmod__finding',
    e => e.filter(x => x.offsetParent !== null).map(x => x.textContent.trim()));
  check.eq('all three modules are STILL VISIBLE after declining', after.length, 3);
  check.eq('…and unchanged', after, before);
  check.ok('PDF is STILL LOCKED', await page.getAttribute('#snapPdfBtn', 'disabled') !== null);
  check.includes('lock hint unchanged', await page.textContent('#snapPdfHint'), 'Unlocks when we send your report');
  check.includes('quiet, non-nagging confirmation',
    await page.textContent('#snapView .snapcap__quiet'), 'the snapshot stays right here');

  const events = await H.allEvents(page);
  check.eq('capture_declined logged exactly once', H.countOf(events, 'capture_declined'), 1);
  /* CHANGED with the landing chooser: the front door takes a business email,
     so there is no longer an anonymous visitor to test. What this journey
     still proves is the DECLINE — the report is refused, and refusing it
     grants nothing: no consent, no conversion, no unlocked PDF. */
  check.eq('the door capture is the ONLY capture_email — declining adds none',
    H.countOf(events, 'capture_email'), 1);
  check.eq('and it carried the domain only, never the address',
    (H.lastOf(events, 'capture_email') || {}).payload, { domain: 'nike.com', kind: 'hero' });
  check.eq('NO capture_consent event — declining grants nothing',
    H.countOf(events, 'capture_consent'), 0);
  check.eq('NO journey_converted event', H.countOf(events, 'journey_converted'), 0);
  check.ok('the session is logged end to end',
    H.countOf(events, 'session_started') === 1 && H.countOf(events, 'route_decided') >= 1);
  check.eq('the work email is the one given at the door, and nothing more',
    await page.evaluate(() => window.SAI.session.slots.work_email), 'dana@nike.com');

  await H.shot(page, 'j5-declined-snapshot');

  /* the declined visitor still gets their path */
  await H.goToPath(page, '#snapPathGoDeclined');
  check.eq('declined visitor still reaches /path', new URL(page.url()).pathname, '/path');
  check.eq('…and it is still the consultative route',
    (H.lastOf(await H.allEvents(page), 'route_decided') || {}).payload.route, 'consultative');
  await H.shot(page, 'j5-path');
}

/* ═══════════════════════════════════════════════════════════════════════════
   J6 · COMPETITOR ANALYSIS — the sprint-7 entry point, end to end

   The client's ask, verbatim intent: "competitor analysis is going to be a big
   part of what people come to us to find out." This journey is the whole chain
   that answer produced, asserted in one run:

     landing chip  → data/questions.json q1.chips, domain `competitive`
     research      → nike.com, so /api/ask returns REAL rivals
     q6            → the peers form, reading those rivals back by name
     snapshot      → leads with Competitive position, naming the same rivals
     path          → "Competitive benchmarking & intelligence", QuestBrand
     route         → routing.json's own cell for the tier, read off the file

   ── ON THE TWO FACES OF Q6 ────────────────────────────────────────────────
   q6 has a peers form and a generic form, and which one a visitor gets is a
   live-research question — the same non-determinism q4 has, handled the same
   honest way. flow.js will only use the peers form when research came back
   live AND its peers step reported live AND there are two or more names,
   because research.js invents plausible competitor names whenever the model
   did not answer, and reading invented names back as "your closest comparison
   set" would be the demo asserting a fact about the visitor's market that it
   made up. So: when the peers form appears, this journey asserts the names in
   the question are the names on session.research; when it does not, it
   asserts the generic form and RECORDS which mode it got. Both are correct
   behaviour, and the route assertions are identical either way.
   ═══════════════════════════════════════════════════════════════════════════ */
const COMPETITIVE_CHIP = 'Competitive analysis';

/* routing.json is the contract; the assertion reads the file rather than
   restating it, so a cell edit moves the test with it. */
function routingCell(tier) {
  const r = JSON.parse(fs.readFileSync(path.join(H.REPO, 'data', 'routing.json'), 'utf8'));
  const d = r.domains.find(x => x.id === 'competitive');
  return d && d.cells[tier];
}

async function j6(page, check) {
  await H.open(page, '/');

  const landing = await page.$$eval('#heroPick .pick__label', e => e.map(x => x.textContent.trim()));
  check.eq('the picker offers four problems plus "something else"', landing.length, 5);
  check.ok('competitor analysis is one of them', landing.includes(COMPETITIVE_CHIP), landing.join(' | '));
  check.ok('and the survey chip it replaced is gone',
    !landing.includes('I want to run a quick survey'), landing.join(' | '));

  /* a company the model actually knows, so the competitive set is real — and
     it arrives with the email now, not as a separate answer */
  await H.landingChip(page, COMPETITIVE_CHIP, 'dana@nike.com');

  await H.waitQuestion(page, 'q3', 30000);
  check.eq('the chip answered q1', 
    await page.evaluate(() => window.SAI.session.slots.problem_domains), ['competitive']);
  check.eq('and the email answered q2 before it was asked',
    await page.evaluate(() => window.SAI.session.slots.company_domain), 'nike.com');
  await H.clickChip(page, 'Director / VP');

  const sizeMode = await H.answerSize(page, { confirm: "That's right", ask: '2,500+' });
  check.note('q4 mode', sizeMode);

  await H.waitQuestion(page, 'q5', 25000);
  const q5 = await H.flowState(page);
  check.includes('q5 names the new goal back before asking the timing of it',
    q5.copy, 'So you want to track competitors and benchmark against them');
  await H.clickChip(page, 'This quarter');

  /* ── Q6 · the moment the live research pays off ── */
  await H.waitQuestion(page, 'q6', 25000);
  const q6 = await H.flowState(page);
  const research = await page.evaluate(() => window.SAI.session.research);
  const peers = (research && research.competitors) || [];
  check.note('research', `live=${research && research.live} competitors=${JSON.stringify(peers)}`);
  check.note('q6 mode', q6.mode);

  if (q6.mode === 'peers') {
    check.ok('q6 arrived in the PEERS form — live research named a real comparison set', true, q6.copy);
    const named = peers.filter(p => q6.copy.indexOf(p) !== -1);
    check.ok('the question names at least TWO of them, verbatim',
      named.length >= 2, `${named.length} of ${peers.length}: ${named.join(', ')}`);
    check.ok('every name in the question came off session.research.competitors',
      named.length === Math.min(peers.length, 3), `named ${named.join(', ')} | research ${peers.join(', ')}`);
    check.absent('no unfilled template slot reached the screen', q6.copy, '{');
    check.eq('and it brings the peers chips', q6.chips,
      ["That's the set", 'There are others', 'Widen to the category']);
    await H.clickChip(page, "That's the set");
  } else {
    /* the honest-fallback path — the same protocol the suite uses for q4 */
    check.note('q6 fell back to the GENERIC form — live research did not return a real ' +
      'comparison set in time (legitimate offline path; the peers form is never shown with ' +
      'the seeded fallback names)',
      `mode=${q6.mode} live=${research && research.live} competitors=${JSON.stringify(peers)}`);
    check.eq('the generic form asks the same decision in the abstract', q6.copy,
      'Who are you measuring against — competitors you name, or the whole category?');
    check.eq('with its own explicit chips, not derived ones', q6.chips,
      ['Competitors I name', 'The whole category']);
    await H.clickChip(page, 'Competitors I name');
  }

  /* ── SNAPSHOT · already led by Competitive position ── */
  await H.waitSnapshot(page);
  const mods = await page.$$eval('#snapView .snapmod',
    e => e.map(x => ({ mod: x.dataset.mod, head: x.querySelector('h3').textContent.trim(),
      text: x.textContent.replace(/\s+/g, ' ').trim() })));
  check.eq('three modules', mods.length, 3);
  check.eq('the FIRST is Competitive position — the domain the visitor came for leads',
    mods[0] && mods[0].head, 'Competitive position');
  const inSnap = peers.filter(p => mods[0] && mods[0].text.indexOf(p) !== -1);
  check.ok('and it names the same rivals the research found',
    inSnap.length >= 2, `${inSnap.join(', ')} | research ${peers.join(', ')}`);
  await H.shot(page, 'j6-snapshot');

  await H.captureEmail(page, 'demo@nike.com', true);
  await H.goToPath(page, '#snapPathGo');

  /* ── PATH · the capability, and the product credited under it ── */
  const cards = await page.$$eval('#pathView .pathcard h3', e => e.map(x => x.textContent.trim()));
  check.eq('one capability card', cards.length, 1);
  check.eq('titled as a CAPABILITY, not a product', cards[0], 'Competitive benchmarking & intelligence');
  const credits = await page.$$eval('#pathView .pathcard .pathband', e => e.map(b => {
    const i = b.querySelector('img.pathband__lockup');
    return i ? i.getAttribute('alt') : b.textContent.trim();
  }));
  check.eq('QuestBrand credited on the card band', credits, ['QuestBrand']);

  const route = H.lastOf(await H.allEvents(page), 'route_decided');
  const tier = route && route.payload.tier;
  const cell = routingCell(tier);
  check.eq('routed on the competitive domain', route && route.payload.primaryDomain, 'competitive');
  check.eq(`route matches routing.json's own competitive/${tier} cell`,
    route && route.payload.route, cell && cell.route);
  check.eq('…and the decision carries that cell\'s note',
    route && route.payload.cellNote, (cell && cell.note) || null);

  assertAttributed(check, await handoffLinks(page), route.payload.route, 'handoff');
  await H.shot(page, 'j6-path');
}

/* ═══════════════════════════════════════════════════════════════════════════
   RUN
   ═══════════════════════════════════════════════════════════════════════════ */
const counts = {};

const JOURNEYS = [
  { id: 'J1', name: "master ad · website + two problems in one message → consultative",
    run: (p, c) => j1(p, c, { onDone: r => { counts.J1 = r.asked; } }) },
  { id: 'J2', name: 'product ad · /p/targeting-machine → pre-seeded opener → demo',
    run: (p, c) => j2(p, c, { onDone: r => { counts.J2 = r.standardAsked; } }) },
  { id: 'J3', name: 'SMB founder · types "a quick survey" → self-serve with a dominant, honest CTA', run: j3 },
  { id: 'J4', name: 'small company × enterprise-shaped product → demo, a real ask', run: j4 },
  { id: 'J5', name: 'declines the report → snapshot survives, PDF stays locked, nothing granted', run: j5 },
  { id: 'J6', name: 'competitor analysis · landing chip → real rivals named at q6, snapshot and path', run: j6 }
];

if (require.main === module) {
  H.runSuite('ACCEPTANCE · the five KIT-BRIEF demo scripts, plus J6 (competitor analysis)', JOURNEYS).then(ok => {
    if (counts.J1 && counts.J2) {
      process.stdout.write(
        '\nQUESTION BUDGET (for the record — see tests/README.md "Question counts"):\n' +
        `  J1 asked ${counts.J1.length} standard questions: ${counts.J1.join(', ')}\n` +
        `  J2 asked ${counts.J2.length} standard questions: ${counts.J2.join(', ')} (+ the campaign opener)\n`);
    }
    process.exit(ok ? 0 : 1);
  }).catch(e => { console.error('SUITE ERROR:', e); process.exit(1); });
}

module.exports = { JOURNEYS, j1, j2, j3, j4, j5, j6,
  NIKE_MSG, SMB_DOMAIN, EXPLORER_DOMAIN, COMPETITIVE_CHIP };
