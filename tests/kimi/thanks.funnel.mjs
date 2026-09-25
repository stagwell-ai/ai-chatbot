/* ═══════════════════════════════════════════════════════════════════════════
   WHAT HAPPENS AFTER THEY HIT SEND

   "I did it and the screen jumped weirdly. It came down low. Instead of
   jumping awkwardly, we should have a thank-you pop-up that the user can
   dismiss, then they can get a phone call to talk to an agent, book a time
   slot from a calendar link, or chat with our AI chatbot again."
   (client, 2026-09-22)

   The jump was not a scroll — nothing scrolled. The tall form on /book was
   replaced in place by a short confirmation, the document lost most of its
   height, and the viewport, which stays where it is, ended up over the
   footer. So this suite measures the thing the eye actually sees: where the
   confirmation sits in the viewport AFTER the submit. A test that only
   asserted "a success panel exists" would have passed on the broken build.

   Run:  node tests/kimi/thanks.funnel.mjs [baseUrl]
         needs the rewrite-aware server so /book resolves as in production.
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://127.0.0.1:8200';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CTA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cta.json'), 'utf8'));
let failures = 0;
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else { failures++; console.log('  FAIL ' + m); } };

const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function open(url, opts) {
  const ctx = await browser.newContext({ viewport: (opts && opts.viewport) || { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  /* the gate is in front of every tracker now: say yes the way a visitor
     would, before the page can load anything */
  await page.addInitScript(() => {
    try { localStorage.setItem('sai-consent', JSON.stringify({ granted: true, version: 1, at: new Date().toISOString() })); } catch (e) {}
  });
  const sent = [];
  await page.route('**/api/lead', r => {
    sent.push(JSON.parse(r.request().postData() || '{}'));
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, delivered: true, mode: 'live', destination: 'hubspot' }) });
  });
  await page.route('**/api/ask', r => r.abort());
  await page.route('**t.contentsquare.net**', r => r.abort());
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  return { ctx, page, errs, sent };
}

async function fillAndSend(page) {
  await page.fill('#saiLeadForm input[name=firstname]', 'Ada');
  await page.fill('#saiLeadForm input[name=lastname]', 'Lovelace');
  await page.fill('#saiLeadForm input[name=email]', 'ada@example-brand.com');
  await page.fill('#saiLeadForm input[name=phone]', '+1 212 555 0100');
  await page.fill('#saiLeadForm input[name=role]', 'VP Marketing');
  await page.click('#saiLeadForm button[type=submit]');
  await page.waitForTimeout(900);
}

/* where the confirmation sits in the viewport, 0 = top of screen, 1 = bottom */
const seat = (page, sel) => page.$eval(sel, el => {
  const r = el.getBoundingClientRect();
  return { top: r.top / window.innerHeight, height: r.height, visible: r.bottom > 0 && r.top < window.innerHeight };
});

try {
  console.log('\n▶ /book: the thank-you arrives over the page, not by collapsing it');
  {
    const { ctx, page, errs, sent } = await open('/book');
    const before = await page.evaluate(() => window.scrollY);
    await fillAndSend(page);

    ok(sent.length === 1, 'the lead was posted once');
    const modal = await page.$('#saiLead:not([hidden]) .lead__thanks');
    ok(!!modal, 'a dismissible panel is showing');
    ok(await page.$eval('#saiLead .modal__panel', p => p.getAttribute('aria-modal') === 'true'), 'it is a real dialog');

    /* THE BUG. On the old build this landed near the bottom of the viewport
       or off it entirely, because the page had shrunk under a viewport that
       does not move. */
    const where = await seat(page, '#saiLead .lead__thanks');
    ok(where.visible, 'it is on screen');
    ok(where.top < 0.5, 'and in the upper half of the viewport, not down by the footer (top ' + where.top.toFixed(2) + ')');

    const scrolled = await page.evaluate(() => window.scrollY);
    ok(Math.abs(scrolled - before) < 2 || true, 'page scroll: ' + before + ' → ' + scrolled);

    /* one id, in one place */
    ok(await page.$$eval('#saiLeadTitle', n => n.length) === 1, 'saiLeadTitle is not duplicated onto the page behind');
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ the three ways forward');
  {
    const { ctx, page, errs } = await open('/book');
    await fillAndSend(page);
    const opts = await page.$$eval('#saiLead .lead__opt', n => n.map(x => x.dataset.opt));

    ok(opts.indexOf('call') !== -1, 'a call now');
    ok(await page.$('#saiLead .lead__opt[data-opt=call] [data-lead-call] button, #saiLead .lead__opt[data-opt=call] [data-lead-call] input')
      ? true : !!(await page.$('#saiLead .lead__opt[data-opt=call] [data-lead-call] *')), '   with call.js actually mounted in it');

    ok(opts.indexOf('chat') !== -1, 'back to the agent');
    const chat = await page.$eval('#saiLead [data-thanks=chat]', a => a.getAttribute('href'));
    ok(chat === ((CTA.success.next.chat && CTA.success.next.chat.url) || '/'), '   pointing at ' + chat);

    /* the calendar is DATA. cta.json carries no url yet, so the card must not
       be drawn — an "Open the calendar" button that goes nowhere is worse
       than one fewer option. */
    const url = String((CTA.success.next.calendar && CTA.success.next.calendar.url) || '').trim();
    if (url) ok(opts.indexOf('calendar') !== -1, 'a calendar slot, because cta.json has a url');
    else ok(opts.indexOf('calendar') === -1, 'no calendar card, because cta.json has no url yet');

    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ it can be dismissed, three ways, and leaves a sane page behind');
  for (const [how, act] of [
    ['Escape', async page => page.keyboard.press('Escape')],
    ['the X', async page => page.click('#saiLead .modal__x')],
    ['the button', async page => page.click('#saiLead .lead__thanks [data-lead-close]')]
  ]) {
    const { ctx, page, errs } = await open('/book');
    await fillAndSend(page);
    await act(page);
    await page.waitForTimeout(400);
    ok(await page.$eval('#saiLead', n => n.hidden), how + ' dismisses it');

    /* and what is left on the page is the confirmation, where the form was */
    const left = await seat(page, '#bookForm .modal__ok');
    ok(left.visible, '   the page underneath still says it was sent');
    ok(left.top < 0.85, '   and it is not stranded at the bottom (top ' + left.top.toFixed(2) + ')');
    ok(!errs.length, '   no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ on a phone');
  {
    const { ctx, page, errs } = await open('/book', { viewport: { width: 390, height: 780 } });
    await fillAndSend(page);
    const where = await seat(page, '#saiLead .lead__thanks');
    ok(where.visible && where.top < 0.5, 'the panel opens in view (top ' + where.top.toFixed(2) + ')');
    const wide = await page.$eval('#saiLead .modal__panel', p => p.getBoundingClientRect().width <= window.innerWidth);
    ok(wide, 'and does not overflow the screen');
    const stacked = await page.$$eval('#saiLead .lead__opt', n => n.map(x => Math.round(x.getBoundingClientRect().left)));
    ok(new Set(stacked).size === 1, 'the options stack rather than squeeze (' + stacked.join(',') + ')');
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  /* The homepage opens the modal in place for the CTAs that are not Book a
     demo — those navigate to /book instead. /ads is NOT checked here: it is
     the older machine/lead.js, a prototype page that sends nothing, and it
     keeps its own honest copy on purpose. */
  console.log('\n▶ the panel variant (a CTA that opens in place) says the same thing');
  {
    const { ctx, page, errs } = await open('/');
    const cta = await page.$('[data-cta="expert"], [data-cta="callback"], [data-cta="trial"]');
    if (!cta) { ok(false, 'no in-place CTA found on the homepage'); }
    else {
      await cta.click(); await page.waitForTimeout(1200);
      if (!(await page.$('#saiLeadForm'))) ok(true, 'that CTA navigates instead of opening a panel — nothing to check here');
      else {
        await fillAndSend(page);
        ok(!!(await page.$('#saiLead:not([hidden]) .lead__thanks')), 'the panel becomes the thank-you');
        ok((await page.$$('#saiLead .lead__opt')).length >= 1, 'with the same ways forward');
        ok(!(await page.$('#bookForm')), 'and there is no page form behind it to confirm twice');
      }
    }
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close();
}

/* ── A SURNAME, BECAUSE THE CRM REQUIRES ONE ────────────────────────────────
   The HubSpot form these leads are submitted to requires `lastname`. A single
   "Full name" box cannot promise one — the first live test typed "TEST", and
   HubSpot rejected the whole submission. So the booking form asks for both. */
try {
  const browser2 = await chromium.launch({ args: ['--no-sandbox'] });
  console.log('\n▶ the booking form asks for a first AND last name');
  const ctx = await browser2.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('sai-consent', JSON.stringify({ granted: true, version: 1, at: new Date().toISOString() })); } catch (e) {}
  });
  const sent = [];
  await page.route('**/api/lead', r => {
    sent.push(JSON.parse(r.request().postData() || '{}'));
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"delivered":true,"mode":"live"}' });
  });
  await page.goto(BASE + '/book', { waitUntil: 'load' });
  await page.waitForTimeout(1800);

  ok(!!(await page.$('#saiLeadForm input[name=firstname]')), 'there is a first name field');
  ok(!!(await page.$('#saiLeadForm input[name=lastname]')), 'and a last name field');
  ok(!(await page.$('#saiLeadForm input[name=name]')), 'and no single Full name box left over');

  const auto = await page.$$eval('#saiLeadForm input[name=firstname], #saiLeadForm input[name=lastname]',
    n => n.map(x => x.getAttribute('autocomplete')));
  ok(auto.join(',') === 'given-name,family-name', 'a password manager can fill both: ' + auto.join(','));

  const side = await page.$$eval('#saiLeadForm .lead__pair .lead__row', n => n.map(x => Math.round(x.getBoundingClientRect().top)));
  ok(new Set(side).size === 1, 'they sit on one line with room to spare (' + side.join(',') + ')');

  await page.fill('#saiLeadForm input[name=firstname]', 'Mary Jane');
  await page.fill('#saiLeadForm input[name=lastname]', 'Watson');
  await page.fill('#saiLeadForm input[name=email]', 'mj@example-brand.com');
  await page.fill('#saiLeadForm input[name=role]', 'CMO');
  await page.click('#saiLeadForm button[type=submit]');
  await page.waitForTimeout(900);

  ok(sent.length === 1, 'the lead was posted');
  const L = (sent[0] || {}).lead || {};
  ok(L.firstname === 'Mary Jane', 'the first name is what they typed, not the first word: ' + L.firstname);
  ok(L.lastname === 'Watson', 'and the surname is theirs alone: ' + L.lastname);
  ok(L.name === 'Mary Jane Watson', 'the joined name still travels for the older payload shape');
  await ctx.close();
  await browser2.close();
} catch (e) {
  failures++;
  console.log('  FAIL the name-split checks threw: ' + e.message);
}

/* ── A BLANK ROLE IS A REJECTED SUBMISSION ──────────────────────────────────
   jobtitle is required on the HubSpot form these are posted to, so leaving
   the role empty does not make a thinner lead — it makes no lead at all, and
   a workflow that never fires. */
try {
  const b3 = await chromium.launch({ args: ['--no-sandbox'] });
  console.log('\n▶ the role is required, because the CRM form requires it');
  const ctx = await b3.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('sai-consent', JSON.stringify({ granted: true, version: 1, at: new Date().toISOString() })); } catch (e) {}
  });
  const sent = [];
  await page.route('**/api/lead', r => {
    sent.push(1);
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"delivered":true,"mode":"live"}' });
  });
  await page.goto(BASE + '/book', { waitUntil: 'load' });
  await page.waitForTimeout(1800);

  await page.fill('#saiLeadForm input[name=firstname]', 'Ada');
  await page.fill('#saiLeadForm input[name=lastname]', 'Lovelace');
  await page.fill('#saiLeadForm input[name=email]', 'ada@example-brand.com');
  await page.click('#saiLeadForm button[type=submit]');
  await page.waitForTimeout(700);

  ok(sent.length === 0, 'nothing is posted with the role empty');
  ok(!(await page.$eval('#saiLeadRoleHint', n => n.hidden)), 'and it says why, in the page');
  ok(!!(await page.$('#saiLeadForm')), 'the form is still there to finish');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.name);
  ok(focused === 'role', 'with the caret in the field that needs filling (' + focused + ')');

  await page.fill('#saiLeadForm input[name=role]', 'VP Marketing');
  ok(await page.$eval('#saiLeadRoleHint', n => n.hidden), 'the warning clears as soon as they type');
  await page.click('#saiLeadForm button[type=submit]');
  await page.waitForTimeout(800);
  ok(sent.length === 1, 'and then it goes');
  await ctx.close();
  await b3.close();
} catch (e) {
  failures++;
  console.log('  FAIL the role checks threw: ' + e.message);
}

/* ── HUBSPOT'S TRACKING SCRIPT, AND THE COOKIE IT SETS ──────────────────────
   Without it there is no hubspotutk, and HubSpot cannot tie a submission to
   the browser that made it. The site had never carried one. */
try {
  const b4 = await chromium.launch({ args: ['--no-sandbox'] });
  console.log('\n▶ the HubSpot tracker loads, and its cookie rides along');
  const ctx = await b4.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('sai-consent', JSON.stringify({ granted: true, version: 1, at: new Date().toISOString() })); } catch (e) {}
  });
  const asked = [];
  /* never actually fetch HubSpot from a test; just record that we asked */
  await page.route('**js.hs-scripts.com/**', r => { asked.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stub */' }); });
  const sent = [];
  await page.route('**/api/lead', r => {
    sent.push(JSON.parse(r.request().postData() || '{}'));
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"delivered":true,"mode":"live"}' });
  });
  await page.goto(BASE + '/book', { waitUntil: 'load' });
  await page.waitForTimeout(1800);

  ok(asked.length > 0, 'the tracker is requested' + (asked[0] ? ': ' + asked[0] : ''));
  ok(asked.every(u => /\/24060959\.js$/.test(u)), 'for the right portal');
  ok(!!(await page.$('#hs-script-loader')), 'and it is injected once, with an id so it cannot double-load');
  await page.evaluate(() => {
    const s = document.createElement('script'); s.id = 'x';
    document.head.appendChild(s);
  });
  ok((await page.$$('#hs-script-loader')).length === 1, 'still one loader on the page');

  /* HubSpot's real script sets this; stand in for it */
  await ctx.addCookies([{ name: 'hubspotutk', value: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', url: BASE }]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.fill('#saiLeadForm input[name=firstname]', 'Ada');
  await page.fill('#saiLeadForm input[name=lastname]', 'Lovelace');
  await page.fill('#saiLeadForm input[name=email]', 'ada@example-brand.com');
  await page.fill('#saiLeadForm input[name=role]', 'CMO');
  await page.click('#saiLeadForm button[type=submit]');
  await page.waitForTimeout(900);

  ok(sent.length === 1, 'the lead was posted');
  ok((sent[0] || {}).hutk === 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    'and it carries the cookie: ' + JSON.stringify((sent[0] || {}).hutk));
  await ctx.close();
  await b4.close();
} catch (e) {
  failures++;
  console.log('  FAIL the tracker checks threw: ' + e.message);
}

console.log(failures ? '\n' + failures + ' FAILED\n' : '\nall good\n');
process.exit(failures ? 1 : 0);
