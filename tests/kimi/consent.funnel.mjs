/* ═══════════════════════════════════════════════════════════════════════════
   CONSENT — the one thing that must be true: NOTHING reaches a third party
   before a visitor says yes.

   This suite does not check that a banner appears. It watches the network.
   Three trackers arrived within a day of each other — Contentsquare, HubSpot,
   Mixpanel — and a gate that renders correctly while one of them quietly
   loads anyway is worse than no gate, because it looks like compliance.

   Run:  node tests/kimi/consent.funnel.mjs [baseUrl]
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://127.0.0.1:8200';
let failures = 0;
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else { failures++; console.log('  FAIL ' + m); } };

const TRACKERS = [
  ['Contentsquare', /t\.contentsquare\.net/],
  ['HubSpot', /js\.hs-scripts\.com/],
  ['Mixpanel', /cdn\.mxpnl\.com|api[^.]*\.mixpanel\.com/]
];
const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function open(url, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts || {}));
  const page = await ctx.newPage();
  const hits = [];
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  /* record every third-party request and answer it locally: the point is what
     the page TRIED to fetch */
  page.on('request', r => { const u = r.url(); TRACKERS.forEach(([n, re]) => { if (re.test(u)) hits.push(n); }); });
  await page.route('**t.contentsquare.net**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**js.hs-scripts.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**cdn.mxpnl.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.mixpanel={init(){},register(){},track(){}};' }));
  await page.route('**mixpanel.com/**', r => r.abort());
  await page.route('**/api/ask', r => r.abort());
  await page.goto(BASE + (url || '/book'), { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  return { ctx, page, hits, errs };
}

try {
  console.log('\n▶ before anyone is asked, nothing is fetched');
  {
    const { ctx, page, hits, errs } = await open('/book');
    ok(hits.length === 0, 'no tracker was requested: ' + (hits.join(', ') || 'none'));
    ok(!!(await page.$('#saiConsent')), 'the visitor is asked');
    ok(!(await page.evaluate(() => document.cookie.indexOf('hubspotutk') !== -1)), 'and no HubSpot cookie exists');
    ok(await page.$eval('#saiConsent', n => n.getAttribute('role') === 'region'), 'the bar is a landmark, not a trap');
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ on Accept, all three load — and only then');
  {
    const { ctx, page, hits, errs } = await open('/book');
    ok(hits.length === 0, 'still nothing while the bar is up');
    await page.click('#saiConsent .yes');
    await page.waitForTimeout(1500);
    TRACKERS.forEach(([n]) => ok(hits.indexOf(n) !== -1, n + ' loads after the yes'));
    ok(!(await page.$('#saiConsent')), 'and the bar goes away');
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ on Decline, nothing loads — then or later');
  {
    const { ctx, page, hits, errs } = await open('/book');
    await page.click('#saiConsent .no');
    await page.waitForTimeout(1200);
    ok(hits.length === 0, 'nothing was fetched: ' + (hits.join(', ') || 'none'));

    /* and a refusal survives a reload, without asking again */
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    ok(hits.length === 0, 'still nothing after a reload');
    ok(!(await page.$('#saiConsent')), 'and they are not asked a second time');
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ a yes is remembered too');
  {
    const { ctx, page, hits } = await open('/book');
    await page.click('#saiConsent .yes');
    await page.waitForTimeout(1200);
    const first = hits.length;
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    ok(!(await page.$('#saiConsent')), 'not asked again on the next page');
    ok(hits.length > first, 'and the trackers load there without a second yes');
    await ctx.close();
  }

  console.log('\n▶ Global Privacy Control is an answer already given');
  {
    const { ctx, page, hits } = await open('/book', { extraHTTPHeaders: { 'sec-gpc': '1' } });
    /* the header alone is what a real GPC browser sends; the property is what
       the page can read, so set both */
    await page.addInitScript(() => { Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    ok(hits.length === 0, 'nothing loads under GPC: ' + (hits.join(', ') || 'none'));
    ok(!(await page.$('#saiConsent')), 'and they are not asked to reconsider — that would be nagging');
    await ctx.close();
  }

  console.log('\n▶ every page carries the gate');
  for (const path of ['/', '/book', '/products', '/the-machine', '/s/bera', '/p/holiday']) {
    const { ctx, page, hits } = await open(path);
    const asked = !!(await page.$('#saiConsent'));
    ok(asked && hits.length === 0, path + ': asks first, fetches nothing');
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? '\n' + failures + ' FAILED\n' : '\nall good\n');
process.exit(failures ? 1 : 0);
