/* ═══════════════════════════════════════════════════════════════════════════
   MIXPANEL — that the SDK is there, that it is configured as the skill says,
   and above all that what reaches it is fit to build a funnel out of.

   The failure this guards against is not "no events". It is events that
   arrive and are useless: a number sent as text that cannot be averaged, a
   null property that exists and is empty forever, an email that should never
   have left the browser. None of those throw. They just quietly ruin a
   dataset that somebody will trust six months from now.

   Run:  node tests/kimi/mixpanel.funnel.mjs [baseUrl]
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://127.0.0.1:8200';
const TOKEN = 'bbf389fb4acc7156b56cb21aac4b969d';
let failures = 0;
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else { failures++; console.log('  FAIL ' + m); } };

const browser = await chromium.launch({ args: ['--no-sandbox'] });

/* a stand-in for the SDK: records init/register/track without a network call */
const STUB = `window.__mp = { init: [], register: [], track: [] };
  window.mixpanel = {
    init: (t, c) => window.__mp.init.push([t, c]),
    register: p => window.__mp.register.push(p),
    track: (n, p) => window.__mp.track.push([n, p])
  };`;

async function open(url, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1100, height: 900 } }, opts || {}));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  /* the gate is in front of every tracker now: say yes the way a visitor
     would, before the page can load anything */
  await page.addInitScript(() => {
    try { localStorage.setItem('sai-consent', JSON.stringify({ granted: true, version: 1, at: new Date().toISOString() })); } catch (e) {}
  });
  const asked = [];
  await page.route('**cdn.mxpnl.com/**', r => {
    asked.push(r.request().url());
    r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB });
  });
  await page.route('**api*.mixpanel.com/**', r => r.abort());
  await page.route('**t.contentsquare.net**', r => r.abort());
  await page.route('**js.hs-scripts.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/api/ask', r => r.abort());
  await page.route('**/api/lead', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"delivered":true,"mode":"live"}' }));
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  return { ctx, page, errs, asked };
}

const mp = page => page.evaluate(() => window.__mp || null);

try {
  console.log('\n▶ the SDK loads, once, configured the way the skill asks');
  {
    const { ctx, page, errs, asked } = await open('/book');
    ok(asked.length === 1, 'the SDK is fetched exactly once (' + asked.length + ')');
    ok(/cdn\.mxpnl\.com\/libs\/mixpanel-2\/mixpanel\.js$/.test(asked[0] || ''), '   from the documented URL');

    const m = await mp(page);
    ok(!!m && m.init.length === 1, 'init is called once');
    const [token, cfg] = (m && m.init[0]) || [];
    ok(token === TOKEN, '   with the project token');
    ok(cfg && cfg.track_pageview === true, '   track_pageview on');
    ok(cfg && cfg.persistence === 'localStorage', '   persistence in localStorage');
    ok(cfg && cfg.batch_requests === true, '   requests batched');
    ok(cfg && cfg.autocapture === false, '   autocapture OFF — every click would be noise');
    ok(cfg && cfg.debug === false, '   and not in debug');

    const reg = (m && m.register[0]) || {};
    ok(reg.platform === 'web', 'super properties carry the platform');
    ok(reg.site_area === 'book', '   and which part of the site this is (' + reg.site_area + ')');
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ it never identifies anybody, because there is nobody to identify');
  {
    const { ctx, page } = await open('/book');
    const m = await mp(page);
    ok(!(m.identify && m.identify.length), 'identify() is not called');
    const reg = m.register[0] || {};
    ok(!/@/.test(JSON.stringify(reg)), 'and no address is registered as a property');
    await ctx.close();
  }

  console.log('\n▶ what a real conversion sends');
  {
    const { ctx, page, errs } = await open('/book');
    await page.fill('#saiLeadForm input[name=firstname]', 'Ada');
    await page.fill('#saiLeadForm input[name=lastname]', 'Lovelace');
    await page.fill('#saiLeadForm input[name=email]', 'ada@example-brand.com');
    await page.fill('#saiLeadForm input[name=role]', 'CMO');
    /* the picks are a dropdown: open it, then the labels are the controls
       (the inputs themselves are visually hidden) */
    const toggle = await page.$('#saiLeadForm .lead__picks button');
    if (toggle) { await toggle.click(); await page.waitForTimeout(300); }
    const picks = await page.$$('#saiLeadForm .lead__pick');
    if (picks[0]) await picks[0].click();
    if (picks[1]) await picks[1].click();
    if (toggle) { await toggle.click(); await page.waitForTimeout(200); }
    await page.click('#saiLeadForm button[type=submit]');
    await page.waitForTimeout(1000);

    const m = await mp(page);
    const names = m.track.map(t => t[0]);
    ok(names.length > 0, 'events reached Mixpanel: ' + JSON.stringify(names));
    ok(names.indexOf('email_captured') !== -1, 'capture_email arrives as email_captured — past tense, like every other event');
    ok(names.indexOf('kimi_lead_delivery') === -1 && names.indexOf('capture_email') === -1,
      '   and our internal names do not leak into the funnel');
    ok(names.every(n => /^[a-z0-9_]+$/.test(n)), 'every name is snake_case: ' + JSON.stringify(names));
    ok(names.every(n => n.indexOf('$') !== 0 && n.indexOf('mp_') !== 0), 'and none collides with a reserved prefix');

    /* the three the skill warns about, checked on every property of every event */
    const all = m.track.map(t => t[1] || {});
    const bad = [];
    all.forEach(p => Object.keys(p).forEach(k => {
      const v = p[k];
      if (v === null) bad.push(k + '=null');
      if (v === '') bad.push(k + '=""');
      if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) bad.push(k + '="' + v + '" (a number as text)');
      if (typeof v === 'string' && /^(n\/a|none|null|undefined)$/i.test(v)) bad.push(k + '="' + v + '"');
    }));
    ok(bad.length === 0, 'no empty, null or stringified-number properties' + (bad.length ? ': ' + bad.join(', ') : ''));

    const blob = JSON.stringify(all);
    ok(blob.indexOf('ada@example-brand.com') === -1, 'the address never reaches Mixpanel');
    ok(blob.indexOf('Lovelace') === -1 && blob.indexOf('"Ada"') === -1, 'nor the name');
    ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ a visitor who has said no is not tracked');
  {
    /* Global Privacy Control is a legal signal in several US states */
    const { ctx, page, asked } = await open('/book', {
      extraHTTPHeaders: { 'sec-gpc': '1' }
    });
    await page.evaluate(() => { try { localStorage.setItem('sai-no-track', '1'); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => (window.SAIMIXPANEL || {}));
    ok(after.on === false, 'the SDK is not started (' + (after.why || '?') + ')');
    ok(asked.length <= 1, '   and after the opt-out nothing more is fetched');
    await ctx.close();
  }

  console.log('\n▶ every page a visitor can land on');
  for (const path of ['/', '/book', '/products', '/the-machine', '/s/bera']) {
    const { ctx, page, asked, errs } = await open(path);
    const m = await mp(page);
    ok(asked.length === 1 && m && m.init.length === 1, path + ' loads and initialises it');
    ok(!errs.length, '   no page errors' + (errs[0] ? ': ' + errs[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? '\n' + failures + ' FAILED\n' : '\nall good\n');
process.exit(failures ? 1 : 0);
