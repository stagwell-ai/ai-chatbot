/* ═══════════════════════════════════════════════════════════════════════════
   WHICH ONES THEY WANT TO HEAR ABOUT

   "this should also have a multi select where you can pick which companies you
   want to hear more about" (client, 2026-09-17). The booking form carries the
   catalog as toggles, under the role field.

   Two things this suite is really here for.

   ONE: the names. They come from data/solutions.json and nowhere else —
   `displayName` where there is one, so the routing label "Stagwell's Machines
   (family frame)" can never reach a visitor — and only products that are
   active. A hard-coded list here would rot the first time a product is added.

   TWO: the pre-tick SURVIVES A NAVIGATION. Book a demo does not open a panel
   in place; it goes to /book. The conversation and the product page are both
   gone by the time the form renders, so the ids ride across in sessionStorage
   (lead.js remember()) and in ?p=. Every CTA that names a product is checked
   here from the page a visitor actually clicks it on.

   Run:  node tests/kimi/picks.funnel.mjs [baseUrl]
         needs the rewrite-aware server: /book, /s/{id} and /the-machine must
         resolve as they do in production.
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
const SOL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'solutions.json'), 'utf8')).solutions;
const ACTIVE = SOL.filter(p => p.active !== false);
let failures = 0;
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else { failures++; console.log('  FAIL ' + m); } };

const browser = await chromium.launch({ args: ['--no-sandbox'] });
async function open(url) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  await page.route('**/api/ask', r => { const b = JSON.parse(r.request().postData() || '{}');
    if (b.mode === 'research') return r.fulfill({ status: 200, contentType: 'application/json',
      body: '{"ok":true,"known":true,"name":"Acme","domain":"acme-brands.com","employees":400}' });
    r.abort(); });
  await page.route('**/api/lead', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.route('**t.contentsquare.net**', r => r.abort());
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  return { ctx, page, errs };
}
const picked = page => page.$$eval('input[name=products]:checked', e => e.map(x => x.value));
const shown = page => page.$$eval('.lead__pick span', e => e.map(x => x.textContent.trim()));

try {
  console.log('\n▶ the catalog, and only the catalog');
  {
    const { ctx, page, errs } = await open('/book');
    const names = await shown(page);
    ok(names.length === ACTIVE.length, 'one toggle per active product (' + names.length + ' of ' + ACTIVE.length + ')');
    ACTIVE.forEach(p => {
      const want = p.displayName || p.name;
      ok(names.indexOf(want) !== -1, '   ' + p.id + ' shows as "' + want + '"');
    });
    ok(!names.some(n => /\(|family frame|internal/i.test(n)), 'no routing label among them');
    const off = SOL.filter(p => p.active === false);
    ok(!off.some(p => names.indexOf(p.displayName || p.name) !== -1),
      'and nothing retired is offered' + (off.length ? ' (' + off.map(p => p.id).join(',') + ' held back)' : ''));
    ok((await picked(page)).length === 0, 'nothing is ticked when nothing led here');
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ …and it arrives ticked from wherever they came');
  for (const [from, want] of [['/s/bera', 'bera'], ['/s/geopulse', 'geopulse'],
                              ['/the-machine', 'machines_family'], ['/newvoices', 'newvoices']]) {
    const { ctx, page, errs } = await open(from);
    const cta = await page.$('button[data-cta="session"], button[data-cta="demo"]');
    ok(!!cta, from + ' has a Book a demo');
    if (cta) {
      await cta.click(); await page.waitForLoadState('load'); await page.waitForTimeout(1800);
      ok(/\/book/.test(page.url()), '   it goes to the form (' + new URL(page.url()).pathname + ')');
      ok((await picked(page)).indexOf(want) !== -1, '   and ' + want + ' is already ticked: ' + JSON.stringify(await picked(page)));
    }
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ a link can say it too');
  {
    const { ctx, page } = await open('/book?p=newvoices,geopulse');
    const on = await picked(page);
    ok(on.indexOf('newvoices') !== -1 && on.indexOf('geopulse') !== -1, '?p= ticks them: ' + JSON.stringify(on));
    const { ctx: c2, page: p2 } = await open('/book?p=not_a_product');
    ok((await picked(p2)).length === 0, 'and an id that is not a product ticks nothing');
    await ctx.close(); await c2.close();
  }

  console.log('\n▶ what the form does with them');
  {
    const { ctx, page, errs } = await open('/book?p=newvoices');
    await page.evaluate(() => { window.__ev = [];
      const bus = window.SAI && window.SAI.events;
      if (bus) { const o = bus.emit.bind(bus); bus.emit = (t, x) => { window.__ev.push([t, x]); return o(t, x); }; }
      else window.SAI = { events: { emit: (t, x) => window.__ev.push([t, x]) } }; });
    await page.click('.lead__pick:has-text("The Machine") input');
    await page.fill('#saiLeadForm [name=email]', 'ada@acme-brands.com');
    await page.click('#saiLeadForm button[type=submit]');
    await page.waitForTimeout(900);
    const ev = await page.evaluate(() => window.__ev || []);
    const req = ev.find(e => e[0] === 'products_requested');
    ok(!!req, 'submitting reports what they picked');
    ok(req && req[1].products.indexOf('newvoices') !== -1 && req[1].products.indexOf('machines_family') !== -1,
      '   both of them, by id: ' + JSON.stringify(req && req[1].products));
    ok(req && !/@|ada/i.test(JSON.stringify(req[1])), '   and nothing about the person rides with it');
    ok(await page.evaluate(() => !!document.querySelector('.modal__ok')), '   the form still completes');
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ reachable without a mouse');
  {
    const { ctx, page } = await open('/book');
    await page.focus('#saiLeadForm [name=role]');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    ok((await picked(page)).length === 1, 'tab from the role field reaches the first one, space ticks it');
    const ring = await page.$eval('.lead__pick input:checked', e => getComputedStyle(e.nextElementSibling).backgroundColor);
    ok(ring && ring !== 'rgba(0, 0, 0, 0)', '   and a ticked one looks different (' + ring + ')');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? '\n✗ ' + failures + ' failed\n' : '\n✓ the form asks which ones they want to hear about\n');
process.exit(failures ? 1 : 0);
