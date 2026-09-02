/* ═══════════════════════════════════════════════════════════════════════════
   HARNESS — the plumbing every acceptance file in tests/ shares.

   Three things live here and nowhere else:

     1. THE ROUTE EMULATION. Production serves this demo through vercel.json
        rewrites: "/" → machine/b.html and "/p/:campaign" → machine/campaign.html.
        The dev bridge is a plain static server with no rewrite layer, so every
        context fulfils those two paths itself, from the files on disk, by
        EXACT pathname — never a glob. Everything else (/machine/*, /data/*,
        /api/ask) falls through to the bridge untouched, which is the point:
        /api/ask is proxied to the deployed function, so these journeys
        exercise the real model.

     2. THE CHIP CONTRACT. Chips are <button> elements, and their labels are
        substrings of the question copy that precedes them ("This quarter"
        lives inside "…this quarter, this year, or just exploring?"). A bare
        text= selector is case-insensitive AND substring-matching, so it hits
        the question paragraph instead of the button. Every helper here uses
        button + :text-is(), scoped to the chip group that is still live —
        convo.js fades a spent group out over ~460ms before removing it, so
        two groups can be in the DOM at once and only one of them is real.

     3. THE JOURNEY RUNNER. Fresh browser context per journey, zero tolerance
        for pageerror, screenshots into tests/artifacts/, one automatic retry
        (a sibling agent may be editing CSS underneath us), and a verdict line
        per journey.

   No path in this file reaches outside the repo except to find Playwright.
   BRIDGE_URL overrides the default http://localhost:8199.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

/* ── where things are ─────────────────────────────────────────────────── */

const REPO = path.resolve(__dirname, '..');
const ARTIFACTS = path.join(__dirname, 'artifacts');
const BRIDGE_URL = (process.env.BRIDGE_URL || 'http://localhost:8199').replace(/\/+$/, '');
const RETRIES = process.env.RETRIES == null ? 1 : Number(process.env.RETRIES);
const HEADLESS = process.env.HEADED !== '1';

/* Playwright is not a dependency of this repo — it is whatever the machine
   running the suite has. Try the ordinary resolution first, then the paths a
   global install lands on. PLAYWRIGHT_PATH overrides everything. */
function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
    '/usr/local/lib/node_modules/playwright'
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* next */ }
  }
  throw new Error(
    'Playwright not found. Install it, or set PLAYWRIGHT_PATH to its directory.\n' +
    '  tried: ' + candidates.join(', '));
}

const { chromium } = loadPlaywright();

/* ═══════════════════════════════════════════════════════════════════════════
   THE REWRITE EMULATION — exact pathnames only.
   ═══════════════════════════════════════════════════════════════════════════ */

const HTML = { '/': 'machine/b.html' };
const CAMPAIGN_PATH = /^\/p\/[a-z0-9-]+$/;

const pathnameOf = url => { try { return new URL(url).pathname; } catch (e) { return null; } };

function html(file) {
  return fs.readFileSync(path.join(REPO, file), 'utf8');
}

function fulfilHtml(route, file) {
  return route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: html(file)
  });
}

async function applyRewrites(ctx) {
  await ctx.route(u => pathnameOf(u) === '/', r => fulfilHtml(r, HTML['/']));
  await ctx.route(u => CAMPAIGN_PATH.test(pathnameOf(u) || ''), r => fulfilHtml(r, 'machine/campaign.html'));
  /* vercel.json rewrites /products → machine/products.html; the bridge is a
     plain static server, so it is emulated by EXACT pathname, never a glob */
  await ctx.route(u => pathnameOf(u) === '/products', r => fulfilHtml(r, 'machine/products.html'));
}

/* An extra exact-path interception, layered on top of the rewrites. Used by
   json-contract.js to serve a modified /data/*.json without touching a file
   in the repo — which is the whole proof. */
async function interceptJson(ctx, urlPath, body) {
  await ctx.route(u => pathnameOf(u) === urlPath, r => r.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: typeof body === 'string' ? body : JSON.stringify(body)
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   ASSERTIONS — a Check collects results instead of throwing on the first
   miss, so one run tells you everything that is wrong rather than the first
   thing. hard() failures fail the journey; note() never does.
   ═══════════════════════════════════════════════════════════════════════════ */

const show = v => {
  if (typeof v === 'string') return JSON.stringify(v);
  try { return JSON.stringify(v); } catch (e) { return String(v); }
};

class Check {
  constructor(name) {
    this.name = name;
    this.lines = [];
    this.failures = 0;
  }
  _push(status, label, detail) {
    this.lines.push({ status, label, detail: detail || '' });
    if (status === 'FAIL') this.failures++;
  }
  ok(label, cond, detail) {
    this._push(cond ? 'ok' : 'FAIL', label, cond ? detail : (detail || 'condition was false'));
    return !!cond;
  }
  eq(label, actual, expected) {
    const pass = show(actual) === show(expected);
    return this.ok(label, pass, pass ? show(actual) : `expected ${show(expected)}, got ${show(actual)}`);
  }
  includes(label, haystack, needle) {
    const pass = String(haystack || '').indexOf(needle) !== -1;
    return this.ok(label, pass, pass ? show(needle) : `${show(needle)} not found in ${show(String(haystack).slice(0, 160))}`);
  }
  absent(label, haystack, needle) {
    const pass = String(haystack || '').indexOf(needle) === -1;
    return this.ok(label, pass, pass ? '' : `${show(needle)} unexpectedly present`);
  }
  note(label, detail) { this._push('note', label, detail == null ? '' : String(detail)); }
  print(indent = '  ') {
    for (const l of this.lines) {
      const tag = l.status === 'ok' ? 'ok  ' : l.status === 'FAIL' ? 'FAIL' : 'note';
      process.stdout.write(`${indent}${tag} ${l.label}${l.detail ? ' — ' + l.detail : ''}\n`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   BROWSER / PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

async function launch() {
  return chromium.launch({ headless: HEADLESS, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

/* A page that records every uncaught error it throws. Zero tolerance: the
   journey asserts pageErrors is empty at the end, so a stray exception in a
   file nobody was testing still fails the run. */
async function newPage(browser, opts) {
  const o = opts || {};
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1440, height: 950 } });
  await applyRewrites(ctx);
  if (typeof o.beforePage === 'function') await o.beforePage(ctx);
  const page = await ctx.newPage();
  page.pageErrors = [];
  page.on('pageerror', e => page.pageErrors.push(String(e && e.message || e)));
  page.on('crash', () => page.pageErrors.push('page crashed'));
  return { ctx, page };
}

/* Every entry point waits for the same thing: the engine has resolved its
   data promise, so questions.json/routing.json are actually in memory. */
async function open(page, urlPath) {
  await page.goto(BRIDGE_URL + urlPath, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.SAI && window.SAI.ready), null, { timeout: 20000 });
  await page.evaluate(() => window.SAI.ready);
  return page;
}

async function shot(page, name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const file = path.join(ARTIFACTS, name.replace(/[^a-z0-9.-]+/gi, '-') + '.png');
  try { await page.screenshot({ path: file, fullPage: true }); } catch (e) { /* a screenshot is never the point */ }
  return file;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONVERSATION DRIVERS
   ═══════════════════════════════════════════════════════════════════════════ */

/* the chip group convo.js has not yet faded out — see note 2 at the top */
const LIVE_OPTS = '#thread .opts:not(.is-gone)';

async function waitQuestion(page, id, timeout) {
  await page.waitForFunction(i => {
    const s = window.SAIFLOW && window.SAIFLOW.state();
    return !!(s && s.question && s.question.id === i);
  }, id, { timeout: timeout || 25000 });
  await page.waitForTimeout(60);      /* let the bubble + chips paint */
}

const flowState = page => page.evaluate(() => {
  const s = (window.SAIFLOW && window.SAIFLOW.state()) || {};
  return {
    phase: s.phase,
    id: s.question && s.question.id,
    mode: s.question && s.question.mode,
    copy: s.question && s.question.copy,
    chips: ((s.question && s.question.chips) || []).map(c => c.label),
    asked: s.asked || [],
    skipped: s.skipped || []
  };
});

const liveChips = page => page.$$eval(LIVE_OPTS + ' .opt', els => els.map(e => e.textContent.trim()));

/* EXACT text match on a button. Never text= — that is case-insensitive and
   substring-matching, and every chip label is a substring of its own
   question's copy. */
async function clickChip(page, label) {
  const sel = `${LIVE_OPTS} button.opt:text-is(${JSON.stringify(label)})`;
  await page.locator(sel).first().click({ timeout: 15000 });
}

async function typeAnswer(page, text) {
  await page.fill('#promptInput', text);
  await page.click('#promptSend');
}

/* THE LANDING IS A CHOOSER NOW (machine/hero.js, after Meta's ad-objective
   dialog): pick what you're solving, give a business email, press Ask AI.
   Both drivers below end where the old ones did — inside the conversation,
   with q1 already answered — so the journeys read the same.

   The email is not decoration: the company comes out of its domain, so a
   journey that used to type a website can hand one over here instead. */
const WORK_EMAIL = 'demo@nike.com';

async function landingChip(page, label, email) {
  await page.locator(`#heroPick .pick__row:has-text(${JSON.stringify(label)})`).first()
    .click({ timeout: 10000 });
  await page.fill('#pickEmail', email || WORK_EMAIL);
  await page.click('#pickGo');
  await confirmSite(page);
}

/* THE SITE CONFIRM. A domain read out of the business email is an inference,
   so the conversation puts it to the visitor before reading anything ("we
   want to confirm that this is actually their website. And then we'll search"
   — client, Sep 1). Every journey that enters through the chooser therefore
   answers it, exactly as a visitor would; a journey that typed its own site
   never sees it, and this returns false. */
async function confirmSite(page, opts) {
  const o = opts || {};
  const appeared = await page.waitForFunction(() => {
    const s = window.SAIFLOW && window.SAIFLOW.state();
    return !!(s && s.question && s.question.id === 'q2' && s.question.mode === 'confirm');
  }, null, { timeout: o.timeout || 12000 }).then(() => true).catch(() => false);
  if (!appeared) return false;
  await clickChip(page, o.label || "Yes, that's us");
  return true;
}

/* the "Something else — I'll describe it" row, for the journeys whose whole
   point is one message carrying several things at once */
async function landingFreeText(page, text, email) {
  await page.locator('#heroPick .pick__row').last().click({ timeout: 10000 });
  await page.fill('#pickFree', text);
  await page.fill('#pickEmail', email || WORK_EMAIL);
  await page.click('#pickGo');
  await confirmSite(page);
}

/* q4 is the one question with two faces. Which one the visitor sees depends
   on whether live research came back confident inside flow.researchWaitMs —
   so the driver reads the mode and answers whichever is on screen, and hands
   the mode back for the caller to assert or merely record. */
async function answerSize(page, opts) {
  const o = opts || {};
  await waitQuestion(page, 'q4');
  const mode = (await flowState(page)).mode;
  await clickChip(page, mode === 'confirm' ? (o.confirm || "That's right") : (o.ask || '2,500+'));
  return mode;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SNAPSHOT / PATH
   ═══════════════════════════════════════════════════════════════════════════ */

/* The conversation no longer jumps to the snapshot by itself — it offers a
   button and waits, so the visitor sees what they are being taken to. Every
   journey therefore ends the questions by pressing it. */
async function waitSnapshot(page) {
  const reveal = await page.waitForSelector('#convoReveal', { timeout: 30000 }).catch(() => null);
  if (reveal) await reveal.click();
  await page.waitForSelector('#snapView:not([hidden])', { timeout: 30000 });
  await page.waitForSelector('#snapView .snapmod', { timeout: 10000 });
  await page.waitForTimeout(150);
}

/* Consent is not a second decision any more: the line under the button says
   that sending the report is the permission to follow up, so submitting the
   form grants it. The old `consent` argument is accepted and ignored so the
   journeys read the same; declining is still declineEmail(). */
async function captureEmail(page, email) {
  await page.fill('#snapEmail', email);
  await page.click('#snapCaptureForm button[type="submit"]');
  await page.waitForSelector('#snapPathGo', { timeout: 10000 });
}

async function declineEmail(page) {
  await page.click('#snapDecline');
  await page.waitForSelector('#snapPathGoDeclined', { timeout: 10000 });
}

async function goToPath(page, selector) {
  await page.click(selector);
  await page.waitForSelector('#pathView:not([hidden])', { timeout: 15000 });
  await page.waitForSelector('#pathView .path__title', { timeout: 10000 });
  await page.waitForTimeout(150);
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE EVENT TRAIL — "everything sent to HubSpot" (SPEC S6). Every journey
   asserts against this as well as against the pixels.
   ═══════════════════════════════════════════════════════════════════════════ */

const allEvents = page => page.evaluate(() =>
  (window.SAI.events.list() || []).map(e => ({ type: e.type, payload: e.payload })));

const typesOf = events => events.map(e => e.type);
const ofType = (events, type) => events.filter(e => e.type === type);
const lastOf = (events, type) => { const l = ofType(events, type); return l.length ? l[l.length - 1] : null; };
const countOf = (events, type) => ofType(events, type).length;

/* ═══════════════════════════════════════════════════════════════════════════
   THE RUNNER
   ═══════════════════════════════════════════════════════════════════════════ */

async function runSuite(title, journeys) {
  const browser = await launch();
  const results = [];
  process.stdout.write(`\n${'='.repeat(72)}\n${title}\n  bridge: ${BRIDGE_URL}   repo: ${REPO}\n${'='.repeat(72)}\n`);

  for (const j of journeys) {
    let attempt = 0, check = null, thrown = null;
    while (attempt <= RETRIES) {
      check = new Check(j.name);
      thrown = null;
      const { ctx, page } = await newPage(browser, j.context || {});
      try {
        await j.run(page, check);
        check.ok('no uncaught page errors', page.pageErrors.length === 0, page.pageErrors.join(' | '));
      } catch (e) {
        thrown = e;
        check.ok('journey ran to completion', false, String(e && e.message || e));
        await shot(page, j.id + '-FAILED-attempt' + (attempt + 1));
      }
      await ctx.close();
      if (!check.failures) break;
      attempt++;
      if (attempt <= RETRIES) {
        process.stdout.write(`\n[${j.id}] ${j.name}\n  retrying once (attempt ${attempt + 1}) — first attempt had ${check.failures} failure(s)\n`);
      }
    }
    const passed = check.failures === 0;
    process.stdout.write(`\n[${j.id}] ${j.name}\n`);
    check.print();
    process.stdout.write(`  ${passed ? 'PASS' : 'FAIL'} ${j.id}${attempt > 0 && passed ? ' (passed on retry ' + attempt + ')' : ''}\n`);
    results.push({ id: j.id, name: j.name, passed, failures: check.failures, retried: attempt > 0, thrown });
  }

  await browser.close();

  process.stdout.write(`\n${'-'.repeat(72)}\nVERDICT — ${title}\n`);
  for (const r of results) {
    process.stdout.write(`  ${r.passed ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}${r.retried && r.passed ? '  [retried]' : ''}\n`);
  }
  const bad = results.filter(r => !r.passed);
  process.stdout.write(`  ${results.length - bad.length}/${results.length} green\n${'-'.repeat(72)}\n`);
  return bad.length === 0;
}

module.exports = {
  REPO, ARTIFACTS, BRIDGE_URL, RETRIES,
  Check, launch, newPage, open, shot, applyRewrites, interceptJson, html,
  waitQuestion, flowState, liveChips, clickChip, typeAnswer, landingChip, landingFreeText,
  confirmSite,
  WORK_EMAIL, answerSize,
  waitSnapshot, captureEmail, declineEmail, goToPath,
  allEvents, typesOf, ofType, lastOf, countOf,
  runSuite, LIVE_OPTS
};
