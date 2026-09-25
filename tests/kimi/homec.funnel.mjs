/* ═══════════════════════════════════════════════════════════════════════════
   C'S TWO WAYS IN — the catalogue homepage (next/home-c.html), which is what
   "/" serves.

   Two regressions the client found on it, and neither would have been caught
   by any other suite, because every other suite drives next/index.html:

   1. "this stopped working, it should have the same functionality as the
      previous button we made" (2026-09-16). C carried its own hand-written
      Call me markup, driven by a block that used to live in home.js. That
      block moved out to call.js when the widget was rebuilt, and C never
      loaded the new file: both its Call me buttons — the bar's pill and the
      closing tile — went dead. They are [data-call] mounts now.

   2. "when i tap this, i get a full screen splash, but none of the
      functionality of the interactive chat appears in this view, make it
      work" (2026-09-16). The full-screen overlay was a drawing of the chat:
      a field and six pills that closed themselves and threw the reader back
      to the hero at the top. The real card is lent to the overlay now.

   Both are DOM-shape tests as much as behaviour tests: a page that stops
   loading call.js, or a card that stops travelling, fails here.

   Run:  node tests/kimi/homec.funnel.mjs [baseUrl]   (default http://localhost:8199)
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

async function open(page_) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const state = { errors: [], posts: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.route('**/api/ask', r => {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.mode === 'research') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, known: false, competitors: [] }) });
    r.abort();                                                              /* every model off */
  });
  await page.route('**/api/callback', r => {
    state.posts.push(JSON.parse(r.request().postData() || '{}'));
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session_id: 1, delivered: true }) });
  });
  await page.goto(BASE + '/next/' + page_, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data);
  await page.waitForTimeout(250);
  return { ctx, page, state };
}
const settle = async page => {
  await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'), null, { timeout: 15000 });
  await page.waitForTimeout(150);
};
/* the widget, from the button to the confirmation, wherever it is mounted */
const ring = async (page, sel) => {
  await page.click(sel + ' .call__btn');
  await page.waitForTimeout(200);
  await page.fill(sel + ' .call__num', '415 555 0142');      /* reserved, fictional */
  await page.press(sel + ' .call__num', 'Enter');
  await page.waitForTimeout(250);
  const mid = await page.$eval(sel, e => e.dataset.state);
  /* the send is only on screen while the card is open: measure it here */
  const send = await page.$eval(sel + ' .call__send', e => Math.round(e.getBoundingClientRect().height));
  const ins = await page.$$(sel + ' .call__more input');
  await ins[0].fill('Test'); await ins[1].fill('Visitor'); await ins[2].fill('test@example.com');
  await page.click(sel + ' .call__send');
  await page.waitForTimeout(400);
  return { mid, send, end: await page.$eval(sel, e => e.dataset.state) };
};

try {
  console.log('\n▶ both Call me buttons are the shared widget, and both ring');
  {
    const { ctx, page, state } = await open('home-c.html');
    ok(await page.evaluate(() => !!window.SAICALL), 'call.js is loaded on C at all — it was not, which is why they died');
    const mounts = await page.$$eval('.call', els => els.map(e => e.dataset.placement || e.id));
    ok(mounts.length === 2 && mounts.includes('callNav') && mounts.includes('callEnd'),
      'both mounts are built by call.js: ' + mounts.join(', '));
    ok((await page.$$('.call__more')).length === 2, '   each one has the second step — the name and the email — which the old markup never had');

    const bar = await ring(page, '.call--nav');
    ok(bar.mid === 'details', 'the bar\'s pill asks for the number first, then who to ask for (' + bar.mid + ')');
    ok(bar.end === 'done', '   and confirms the call (' + bar.end + ')');
    /* the card is taller than the bar: it must not be clipped to the bar's height */
    ok(await page.$eval('.call--nav', e => e.getBoundingClientRect().height > 180),
      '   the card is not clipped to the bar\'s 42px — it opens under it, at its own height');

    await page.evaluate(() => document.querySelector('.ask-end').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    const tile = await ring(page, '.ask-end .call');
    ok(tile.mid === 'details' && tile.end === 'done', 'the closing tile rings too (' + tile.mid + ' → ' + tile.end + ')');
    ok(tile.send > 30 && tile.send < 70,
      '   its send is a send, not one of the panel\'s 170px tiles (' + tile.send + 'px)');

    ok(state.posts.length === 2, 'two callbacks were asked for');
    ok(state.posts.every(p => p.dial_code === '1' && p.national_number === '4155550142' && p.email && p.first_name),
      '   each carries the country, the number and who to ask for');
    ok(state.posts.map(p => p.placement).sort().join(',') === 'callEnd,callNav', '   and says which one it came from: ' + state.posts.map(p => p.placement).join(', '));
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  for (const home of ['home-c.html', 'index.html']) {
    console.log('\n▶ the full screen IS the conversation — ' + home);
    {
      const { ctx, page, state } = await open(home);
      await page.evaluate(() => scrollTo(0, 2200));
      await page.waitForTimeout(400);
      const at = await page.evaluate(() => scrollY);
      const launcher = (await page.$('#hcLaunchBtn')) || (await page.$('#navSearch'));
      ok(!!launcher, 'there is a way back into the chat from down the page');
      await launcher.click();
      await page.waitForTimeout(400);

      ok(await page.evaluate(() => !!document.querySelector('.chat-over .chat')),
        'the real card is IN the overlay, not a drawing of one');
      ok(await page.evaluate(() => !!document.querySelector('.chat-over #agentTags')),
        '   with its starting points, which are its sibling and travel too');
      ok(await page.evaluate(() => document.querySelector('#askFormOver').hidden),
        '   and the mock field it used to show is out of the way');
      ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'agentInput'),
        '   the caret is in the real field');

      /* a real turn, held here */
      await page.click('.chat-over #agentTags .tag[data-goal="competition"]');
      await settle(page);
      ok(/competition/i.test(await page.$eval('.chat-over #agentThread .turnb--ai .turnb__text', e => e.textContent)),
        'the agent answers inside the overlay: "' + (await page.$eval('.chat-over #agentThread .turnb--ai .turnb__text', e => e.textContent.trim())).slice(0, 52) + '…"');
      ok((await page.$$('.chat-over #voiceStart')).length === 1, '   the voice is here too, not left behind in the hero');

      await page.click('#chatOverClose');
      await page.waitForTimeout(400);
      ok(await page.evaluate(() => { const c = document.querySelector('.chat'); return !!c && !c.closest('.chat-over'); }),
        'closing gives the card back to the page');
      ok(await page.$$eval('#agentThread .turnb', e => e.length) >= 2, '   with the conversation still on it');
      ok(Math.abs((await page.evaluate(() => scrollY)) - at) < 40,
        '   and the reader is where they left off (' + Math.round(await page.evaluate(() => scrollY)) + ' of ' + at + ')');
      ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
      await ctx.close();
    }
  }

  console.log('\n▶ the products menu still reads');
  {
    const { ctx, page, state } = await open('home-c.html');
    await page.click('.nav__droptrig');
    await page.waitForTimeout(300);
    const rows = await page.$$eval('.nav__pitem', els => els.map(a => {
      const n = a.querySelector('.nav__pname');
      return { name: n && n.textContent.trim(), colour: n && getComputedStyle(n).color, h: n ? n.getBoundingClientRect().height : 0 };
    }));
    ok(rows.length === 4 && rows.every(r => r.name && r.h > 8), 'every product is named: ' + rows.map(r => r.name).join(', '));
    const panel = await page.$eval('.nav__panel', e => getComputedStyle(e).backgroundColor);
    ok(rows.every(r => r.colour !== panel && !/255,\s*255,\s*255/.test(r.colour)),
      '   and the names are not the colour of the panel behind them (' + rows[0].colour + ' on ' + panel + ')');
    const all = await page.$eval('.nav__pall', e => ({ t: e.textContent.trim(), c: getComputedStyle(e).color }));
    ok(all.t && !/255,\s*255,\s*255/.test(all.c), '   "' + all.t + '" reads too');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? '\n✗ ' + failures + ' failed\n' : '\n✓ C rings, and its full screen is the conversation\n');
process.exit(failures ? 1 : 0);
