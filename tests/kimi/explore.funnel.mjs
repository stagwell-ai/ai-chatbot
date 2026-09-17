/* ═══════════════════════════════════════════════════════════════════════════
   GOING DEEPER, WITHOUT REPRODUCING THE PAGE — "we dont want to simply
   reproduce the whole https://…/the-machine page in the chat window, we want it
   to be dynamic, and iterative, and animated, and let the use click things and
   ask questions" (client, 2026-09-17).

   So the three things this suite holds:
     · ITERATIVE — one node at a time. The chat never holds more of the page
       than the visitor asked for, and the detour is capped.
     · CLICKABLE — the chips under the card open it, the chips inside it walk it.
     · IT COMES BACK — the question that was on screen when they wandered off is
       handed straight back when they are done. The conversation is still going
       somewhere.

   Every model off: the detour is entirely deterministic, so it works when the
   model is slow, down, or the visitor is mid-sentence on voice.

   Run:  node tests/kimi/explore.funnel.mjs [baseUrl]   (default http://localhost:8199)
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

async function open(motion) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, reducedMotion: motion || 'reduce' });
  const page = await ctx.newPage();
  const state = { errors: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.route('**/api/ask', r => {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.mode === 'research') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"known":false}' });
    r.abort();                                                              /* every model off */
  });
  await page.route('**/api/lead', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.goto(BASE + '/next/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.explainers);
  await page.evaluate(() => { const a = window.SAIANALYTICS; window.__tracked = []; if (a && a.track) { const o = a.track.bind(a); a.track = (n, p) => { window.__tracked.push([n, p || {}]); return o(n, p); }; } });
  return { ctx, page, state };
}
const settle = async page => { await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait'), null, { timeout: 15000 }); await page.waitForTimeout(400); };
const st = page => page.evaluate(() => window.SAIKIMI.state());
const tap = async (page, label) => { await page.click(`#agentThread .tag:not([disabled]):text-is("${label}")`); await settle(page); await page.waitForTimeout(300); };
const rows = page => page.$$eval('#agentThread .xpanel li b', e => e.map(x => x.textContent));
const say = async (page, text) => { await page.fill('#agentInput', text); await page.press('#agentInput', 'Enter'); await settle(page); };
/* to a card for The Machine, the way a visitor gets there */
async function toCard(page) {
  await say(page, 'we need our marketing tools and data connected, teams are working in silos');
  await say(page, 'ada@acme-brands.com');
  await page.waitForFunction(() => window.SAIKIMI.state().previewed, null, { timeout: 15000 });
  await page.waitForTimeout(600);
}

try {
  console.log('\n▶ the card offers the way in, and nothing deeper is on screen until it is asked for');
  {
    const { ctx, page, state } = await open();
    await toCard(page);
    const s = await st(page);
    ok(s.cards.some(c => /Machine/.test(c.productName || '')), 'the card is The Machine (' + s.cards.map(c => c.productName).join(', ') + ')');
    const chips = await page.$$eval('.turnb__chips--explore .tag', e => e.map(x => x.textContent));
    ok(chips.length === 3, 'three ways in, under the card: ' + chips.join(' | '));
    ok((await rows(page)).length === 0, 'and no detail on screen yet — the page is not reproduced');
    const words = await page.evaluate(() => document.querySelector('#agentThread').textContent.length);
    ok(words < 2600, 'the thread is still a conversation, not a page (' + words + ' chars)');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ iterative: a node at a time, and only what was asked for');
  {
    const { ctx, page, state } = await open();
    await toCard(page);
    await tap(page, 'What do teams use it for?');
    let s = await st(page);
    ok(s.uiAction === 'EXPLORE' && s.explore.node === 'usecases', 'the use cases open (' + s.explore.node + ')');
    ok((await rows(page)).length === 0, '   the groups are offered as chips, not listed out');
    ok(s.suggestions.length === 6, '   five groups and the way out: ' + s.suggestions.map(x => x.label).join(' | '));

    await tap(page, 'Creative and content');
    s = await st(page);
    const r = await rows(page);
    ok(s.explore.node === 'g:creative' && s.explore.depth === 2, 'one group opens (' + s.explore.node + ', depth ' + s.explore.depth + ')');
    ok(r.length === 4, '   its four use cases, and only those: ' + r.join(' | '));
    const all = await page.evaluate(() => document.querySelector('#agentThread').textContent);
    ok(!/Social listening/.test(all), '   nothing from a group they did not open is on the thread');
    ok(!s.suggestions.some(x => x.label === 'Creative and content'), '   the group they are in is not offered again');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ capped: it cannot become the whole page');
  {
    const { ctx, page, state } = await open();
    await toCard(page);
    const max = await page.evaluate(() => window.SAI.data.kimi.flags.exploreMaxDepth);
    await tap(page, 'What do teams use it for?');
    await tap(page, 'Creative and content');
    await tap(page, 'Governance and delivery');
    const s = await st(page);
    ok(s.explore.depth === max, 'the cap is reached at depth ' + s.explore.depth + ' (flags.exploreMaxDepth = ' + max + ')');
    ok(s.suggestions.length === 1 && /carry on/i.test(s.suggestions[0].label), '   and only the way out is offered: ' + s.suggestions.map(x => x.label).join(' | '));
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ it comes back: the question that was on screen is handed straight back');
  {
    const { ctx, page, state } = await open();
    await toCard(page);
    const before = await st(page);
    ok(before.question && before.question.id === 'company_size', 'the conversation was on ' + (before.question && before.question.id));
    await tap(page, 'How is it different?');
    ok((await rows(page)).length === 3, '   the three differentiators are shown');
    await tap(page, 'Carry on');
    const after = await st(page);
    ok(after.uiAction === 'ASK' && after.question && after.question.id === before.question.id,
      'and it is handed back, not restarted (' + after.uiAction + ' / ' + (after.question && after.question.id) + ')');
    ok(after.suggestions.length === before.suggestions.length, '   with its own answers again: ' + after.suggestions.map(x => x.label).join(' | '));
    /* and answering it still works — the detour changed nothing */
    await tap(page, '51 to 250');
    const done = await st(page);
    ok(done.companySize === 'mid', 'the answer still lands after the detour (' + done.companySize + ')');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ what it will not say: the does-NOT-do list is never offered as a chip');
  {
    const { ctx, page, state } = await open();
    await toCard(page);
    const notDo = await page.evaluate(() => window.SAI.data.explainers.products.machines_family.notDo.map(n => n.claim));
    for (const node of ['differentiators', 'usecases', 'connects']) {
      const s = await page.evaluate(n => window.SAIKIMI.explore(n, { productId: 'machines_family' }), node);
      const labels = s.suggestions.map(x => x.label).join(' ');
      ok(!notDo.some(c => labels.indexOf(c) !== -1), node + ': no does-not-do claim among the chips');
    }
    const thread = await page.evaluate(() => document.querySelector('#agentThread').textContent);
    ok(!notDo.some(c => thread.indexOf(c) !== -1), 'and none of them is on the thread');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ animated: the rows are dealt out, and motion-off simply shows them');
  {
    const { ctx, page, state } = await open('no-preference');
    await toCard(page);
    await tap(page, 'What does it connect to?');
    const anim = await page.$$eval('#agentThread .xpanel li', els => els.map(e => ({
      name: getComputedStyle(e).animationName, delay: getComputedStyle(e).animationDelay
    })));
    ok(anim.length === 4 && anim.every(a => a.name === 'xrow'), 'every row is dealt in (' + anim.length + ' rows)');
    ok(new Set(anim.map(a => a.delay)).size === anim.length, '   one after another, not all at once: ' + anim.map(a => a.delay).join(' '));
    await page.waitForTimeout(900);
    const shown = await page.$$eval('#agentThread .xpanel li', els => els.every(e => +getComputedStyle(e).opacity === 1));
    ok(shown, '   and they all end up visible');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }
  {
    const { ctx, page } = await open('reduce');
    await toCard(page);
    await tap(page, 'What does it connect to?');
    const vis = await page.$$eval('#agentThread .xpanel li', els => els.map(e => +getComputedStyle(e).opacity));
    ok(vis.length === 4 && vis.every(v => v === 1), 'motion off: the rows are simply there (' + vis.join(',') + ')');
    await ctx.close();
  }

  console.log('\n▶ the detour is recorded, so we can see what people ask about');
  {
    const { ctx, page } = await open();
    await toCard(page);
    await tap(page, 'What do teams use it for?');
    await tap(page, 'Creative and content');
    await tap(page, 'Carry on');
    const t = await page.evaluate(() => window.__tracked.filter(x => /explore/.test(x[0])).map(x => x[0] + ':' + (x[1].node || x[1].depth)));
    ok(t.length >= 3, 'every step is tracked: ' + t.join(' · '));
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? '\n✗ ' + failures + ' failed\n' : '\n✓ the detour goes deep, stays small, and comes back\n');
process.exit(failures ? 1 : 0);
