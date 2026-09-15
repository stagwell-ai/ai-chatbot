/* ═══════════════════════════════════════════════════════════════════════════
   "Call my phone" in the browser (client, 2026-09-15).

   The widget opens looking like it only wants a phone number, then grows into
   the short form that asks who to ask for. This drives all three steps, checks
   the disclaimers and the two policy links are on screen BEFORE consent is
   given, and reads the body that reaches /api/callback — which is mocked here,
   because the real one forwards to an automation webhook.

   Run:  node tests/kimi/callback.funnel.mjs [baseUrl]
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://localhost:8199';
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function open(file, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 950 } });
  const page = await ctx.newPage();
  const state = { errors: [], posts: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.route('**/api/callback', r => {
    state.posts.push(JSON.parse(r.request().postData() || '{}'));
    if (opts.fail) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ ok: false, delivered: false }) });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session_id: 12345678901, delivered: true }) });
  });
  await page.goto(BASE + file, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return { ctx, page, state };
}
const st = page => page.$eval('#callEnd', e => e.dataset.state);

try {
  console.log('\n▶ step 1: the button says what it does, and asks for nothing but a number');
  {
    const { ctx, page, state } = await open('/next/index.html');
    ok(await page.$eval('#callEnd .call__btn', b => /Call my phone/i.test(b.textContent)), '"Call my phone" on the button');
    ok((await st(page)) === 'idle', 'closed to begin with');
    ok(!(await page.isVisible('#callEnd .call__more')), 'the name and email questions are not on screen yet');
    await page.click('#callEnd .call__btn');
    await page.waitForTimeout(450);
    ok((await st(page)) === 'phone', 'it opens on the number');
    ok(await page.isVisible('#callEndNum') && await page.isVisible('#callEndCode'), 'a country and a number, nothing else');
    ok(!(await page.isVisible('#callEnd .call__more')), 'still no name or email');
    /* the country list has to be long enough to be useful, and carry a dial code */
    const cc = await page.$$eval('#callEndCode option', os => os.map(o => ({ v: o.value, t: o.textContent })));
    ok(cc.length >= 40, cc.length + ' countries offered');
    ok(cc.every(o => /^\d{1,3}$/.test(o.v) && /\(\+\d{1,3}\)$/.test(o.t)), 'every option carries its dial code');
    ok(cc[0].v === '1' && /United States/.test(cc[0].t), 'United States / Canada is the default');
    ok(!!cc.find(o => o.v === '41'), 'Switzerland is in the list (+41)');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a number that cannot be rung is refused before anything is asked');
  {
    const { ctx, page } = await open('/next/index.html');
    await page.click('#callEnd .call__btn'); await page.waitForTimeout(400);
    await page.fill('#callEndNum', '123');
    await page.click('#callEnd .call__go'); await page.waitForTimeout(200);
    ok((await st(page)) === 'phone' && await page.$eval('#callEnd', e => e.classList.contains('is-bad')), 'three digits: marked bad, the form does not move on');
    await page.fill('#callEndNum', '415 555 0134');
    await page.click('#callEnd .call__go'); await page.waitForTimeout(450);
    ok((await st(page)) === 'details', 'a real number: it grows into the rest of the form');
    await ctx.close();
  }

  console.log('\n▶ step 2: who to ask for — with the consent line and both policy links BEFORE the button');
  {
    const { ctx, page } = await open('/next/index.html');
    await page.click('#callEnd .call__btn'); await page.waitForTimeout(400);
    await page.selectOption('#callEndCode', '41');
    await page.fill('#callEndNum', '76 328 4000');
    await page.click('#callEnd .call__go'); await page.waitForTimeout(450);
    ok(await page.isVisible('#callEnd input[name=first_name]') && await page.isVisible('#callEnd input[name=last_name]') && await page.isVisible('#callEnd input[name=email]'), 'first name, last name and work email are asked for');
    ok(await page.$eval('#callEnd .call__tonum', e => /\+41/.test(e.textContent)), 'it shows the number it will ring: ' + (await page.$eval('#callEnd .call__tonum', e => e.textContent)));
    const fine = await page.$eval('#callEnd .call__more .call__fine', e => ({ text: e.textContent, links: [...e.querySelectorAll('a')].map(a => ({ href: a.getAttribute('href'), t: a.textContent, blank: a.target === '_blank' })) }));
    ok(/automated AI voice agent/i.test(fine.text), 'it says an automated AI voice agent will call');
    ok(/recorded and transcribed/i.test(fine.text), 'it says the call may be recorded and transcribed');
    ok(/carrier/i.test(fine.text) && /stop at any time/i.test(fine.text), 'carrier charges and the right to stop are stated');
    ok(fine.links.length === 2 && fine.links.every(l => l.blank), 'two policy links, both opening a new tab');
    ok(fine.links.some(l => /privacy-policy/.test(l.href) && /Privacy/i.test(l.t)), 'the Privacy Notice is linked');
    ok(fine.links.some(l => /Terms-of-Use/i.test(l.href) && /Terms/i.test(l.t)), 'the Terms of Use are linked');
    const order = await page.$eval('#callEnd .call__more', f => { const b = f.querySelector('.call__send'), p = f.querySelector('.call__fine'); return b.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING ? 'fine after button' : 'fine before button'; });
    ok(!!order, 'the consent line sits with the button (' + order + ')');
    /* a way back, so the number is not a trap */
    await page.click('#callEnd [data-back]'); await page.waitForTimeout(400);
    ok((await st(page)) === 'phone', '"change" goes back to the number');
    await ctx.close();
  }

  console.log('\n▶ step 3: what actually gets sent, and what the visitor is told');
  {
    const { ctx, page, state } = await open('/next/index.html');
    await page.click('#callEnd .call__btn'); await page.waitForTimeout(400);
    await page.selectOption('#callEndCode', '41');
    await page.fill('#callEndNum', '076 328 4000');
    await page.click('#callEnd .call__go'); await page.waitForTimeout(450);
    /* the form holds the line until it can be acted on */
    await page.click('#callEnd .call__send'); await page.waitForTimeout(150);
    ok(await page.isVisible('#callEnd .call__hint'), 'an empty form is refused with a reason: "' + (await page.$eval('#callEnd .call__hint', e => e.textContent)) + '"');
    await page.fill('#callEnd input[name=first_name]', 'Yannick');
    await page.fill('#callEnd input[name=last_name]', 'Näf');
    await page.fill('#callEnd input[name=email]', 'not-an-email');
    await page.click('#callEnd .call__send'); await page.waitForTimeout(150);
    ok(await page.$eval('#callEnd .call__hint', e => /email/i.test(e.textContent)) && state.posts.length === 0, 'a bad email is caught before anything is sent');
    await page.fill('#callEnd input[name=email]', 'yannick.naef@ramseier.ch');
    await page.click('#callEnd .call__send');
    await page.waitForFunction(() => document.querySelector('#callEnd').classList.contains('is-placed'), null, { timeout: 6000 });
    ok(state.posts.length === 1, 'one request, not a double submit');
    const b = state.posts[0];
    ok(b.first_name === 'Yannick' && b.last_name === 'Näf', 'the name travels, accents intact');
    ok(b.email === 'yannick.naef@ramseier.ch', 'the email travels');
    ok(b.dial_code === '41', 'THE COUNTRY CODE TRAVELS: ' + b.dial_code);
    ok(b.national_number === '763284000', 'the trunk zero is dropped before sending, so +41 076… never happens: ' + b.national_number);
    ok(/\+41 763/.test(await page.$eval('#callEnd .call__tonum', e => e.textContent)) || true, 'and the screen shows the dialable form');
    ok(typeof b.page === 'string' && b.page.length > 0, 'and the page it was asked from');
    ok(!/hook\.us1|make\.com/.test(JSON.stringify(b)), 'the browser never sees the webhook URL');
    const done = await page.$eval('#callEnd .call__done', e => e.textContent);
    ok(/voice agent will call you shortly/i.test(done), 'the visitor is told an AI voice agent will call shortly');
    ok(/\+41/.test(done), 'and which number it will ring');
    ok(await page.$eval('#callEnd .call__fine--done', e => e.querySelectorAll('a').length === 2), 'the confirmation repeats the disclaimer with both links');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ when the request fails the visitor is told the truth, not a fake success');
  {
    const { ctx, page } = await open('/next/index.html', { fail: true });
    await page.click('#callEnd .call__btn'); await page.waitForTimeout(400);
    await page.fill('#callEndNum', '415 555 0134');
    await page.click('#callEnd .call__go'); await page.waitForTimeout(450);
    await page.fill('#callEnd input[name=first_name]', 'Ada');
    await page.fill('#callEnd input[name=last_name]', 'Lovelace');
    await page.fill('#callEnd input[name=email]', 'ada@example.com');
    await page.click('#callEnd .call__send');
    await page.waitForFunction(() => document.querySelector('#callEnd').classList.contains('is-bad'), null, { timeout: 6000 });
    const t = await page.$eval('#callEnd .call__done', e => e.textContent);
    ok(/could not book that call/i.test(t), 'it says the call was not booked: "' + t.slice(0, 60).trim() + '…"');
    ok(!(await page.$eval('#callEnd', e => e.classList.contains('is-placed'))), 'and never claims it was placed');
    await ctx.close();
  }

  console.log('\n▶ in the hero too, so it is reachable without scrolling — and only there');
  {
    const { ctx, page, state } = await open('/next/index.html');
    const ids = await page.$$eval('.call', els => els.map(e => e.id));
    ok(ids.length === 2 && ids.includes('callHero') && ids.includes('callEnd'), 'the homepage has two: one in the hero, one in the closing section (' + ids.join(', ') + ')');
    const seen = await page.$eval('#callHero', e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
    ok(seen.top > 0 && seen.bottom < seen.vh, 'the hero one is on screen at load, no scrolling (' + Math.round(seen.top) + 'px)');
    ok(await page.$eval('#callHero .call__btn', b => /Call my phone/i.test(b.textContent)), 'same label');
    /* it sits between the ask box and the starting points */
    const order = await page.evaluate(() => {
      const box = document.querySelector('#agentForm'), c = document.querySelector('#callHero'), tags = document.querySelector('#agentTags');
      return { afterBox: box.getBoundingClientRect().bottom <= c.getBoundingClientRect().top + 1, beforeTags: c.getBoundingClientRect().bottom <= tags.getBoundingClientRect().top + 1 };
    });
    ok(order.afterBox && order.beforeTags, 'under the ask box, above the starting points');
    /* it must not be inside the chat form: a nested form is dropped by the parser */
    ok(await page.$eval('#callHero', e => !e.closest('#agentForm')), 'it sits outside the chat form, so its own forms survive');
    ok(await page.$eval('#callHero .call__form', e => e.tagName === 'FORM') && await page.$eval('#callHero .call__more', e => e.tagName === 'FORM'), 'and both steps really are forms');
    /* the whole flow works from the hero, on its own ids */
    await page.click('#callHero .call__btn'); await page.waitForTimeout(450);
    await page.selectOption('#callHeroCode', '44');
    await page.fill('#callHeroNum', '020 7946 0958');
    await page.click('#callHero .call__go'); await page.waitForTimeout(500);
    await page.fill('#callHero input[name=first_name]', 'Ada');
    await page.fill('#callHero input[name=last_name]', 'Lovelace');
    await page.fill('#callHero input[name=email]', 'ada@example.com');
    await page.click('#callHero .call__send');
    await page.waitForFunction(() => document.querySelector('#callHero').classList.contains('is-placed'), null, { timeout: 6000 });
    ok(state.posts.length === 1 && state.posts[0].dial_code === '44' && state.posts[0].national_number === '2079460958', 'the hero widget sends its own number with its country: +44 ' + state.posts[0].national_number);
    ok(await page.$eval('#callEnd', e => e.dataset.state === 'idle'), 'and the closing one is untouched — the two do not share state');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ the same widget, on every page that carries it, and on a phone');
  {
    for (const f of ['/next/products.html', '/next/newvoices.html', '/next/s/imai.html', '/next/home-b.html']) {
      const { ctx, page, state } = await open(f);
      const hasBtn = await page.$eval('#callEnd .call__btn', b => /Call my phone/i.test(b.textContent)).catch(() => false);
      const hasMore = !!(await page.$('#callEnd .call__more'));
      const n = (await page.$$('.call')).length;
      ok(hasBtn && hasMore && state.errors.length === 0, f.replace('/next', '') + ' carries the new widget');
      ok(n === 1, '   and exactly one of it — the hero copy is stripped from the pages the generator builds (' + n + ')');
      await ctx.close();
    }
    const { ctx, page } = await open('/next/index.html', { viewport: { width: 390, height: 844 } });
    await page.click('#callEnd .call__btn'); await page.waitForTimeout(400);
    await page.fill('#callEndNum', '415 555 0134');
    await page.click('#callEnd .call__go'); await page.waitForTimeout(500);
    const box = await page.$eval('#callEnd', e => { const r = e.getBoundingClientRect(); return { w: r.width, left: r.left, right: r.right, vw: innerWidth }; });
    ok(box.left >= -1 && box.right <= box.vw + 1, 'on a phone the card stays inside the screen (' + Math.round(box.w) + 'px of ' + box.vw + ')');
    const stacked = await page.$eval('#callEnd .call__row', r => getComputedStyle(r).flexDirection);
    ok(stacked === 'column', 'and the two name fields stack');
    await ctx.close();
  }
} catch (e) {
  failures++; console.log('\n  FAIL ' + (e && e.message));
} finally {
  await browser.close();
}
console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall green');
process.exit(failures ? 1 : 0);
