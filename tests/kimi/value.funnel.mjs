/* ═══════════════════════════════════════════════════════════════════════════
   VALUE BEFORE THE NEXT QUESTION — Amy (2026-09-10): "we're asking a lot of
   questions of the user without giving them any info … it feels very 'data
   miney' right now without giving them any value before asking for a ton of
   info", and "there should be an option for the user to visit the relevant
   product page from this chat".

   Every model off, so this is the deterministic floor.

   Run:  node tests/kimi/value.funnel.mjs [baseUrl]   (default http://localhost:8199)
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

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const state = { errors: [], tracked: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.route('**/api/ask', r => r.abort());
  await page.route('**/api/lead', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: false, mode: 'mock' }) }));
  await page.goto(BASE + '/next/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);
  /* listen to what the analytics layer is told, without sending anything anywhere */
  await page.evaluate(() => {
    const a = window.SAIANALYTICS; window.__tracked = [];
    if (a && a.track) { const orig = a.track.bind(a); a.track = (n, p) => { window.__tracked.push([n, p || {}]); return orig(n, p); }; }
  });
  return { ctx, page, state };
}
const settle = page => page.waitForFunction(() => document.querySelector('#heroLeadForm') || (!document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text')), null, { timeout: 12000 });
const say = async (page, text) => { await page.fill('#agentInput', text); await page.press('#agentInput', 'Enter'); await settle(page); await page.waitForTimeout(250); };
const chip = async (page, label) => {
  await page.click('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled]):has-text("' + label + '")');
  await settle(page); await page.waitForTimeout(250);
};
/* the last AI bubble, in the order a reader meets it */
const last = page => page.evaluate(() => {
  const b = [...document.querySelectorAll('#agentThread .turnb--ai')].pop();
  if (!b) return null;
  const order = [...b.children].map(el => el.classList.contains('point__intro') ? 'intro' : el.classList.contains('point') ? 'pointers' : el.classList.contains('turnb__chips') ? 'chips' : el.classList.contains('turnb__text') ? 'text' : el.tagName.toLowerCase());
  return {
    order,
    texts: [...b.querySelectorAll('.turnb__text')].map(e => e.textContent.trim()),
    intro: (b.querySelector('.point__intro') || {}).textContent || null,
    items: [...b.querySelectorAll('.point__item')].map(a => ({ id: a.getAttribute('data-kimi-pointer'), href: a.getAttribute('href'), name: a.querySelector('.point__name').textContent.trim(), line: (a.querySelector('.point__line') || {}).textContent || '', go: a.querySelector('.point__go').textContent.trim() })),
    chips: [...b.querySelectorAll('.turnb__chips .tag')].map(t => t.textContent.trim())
  };
});
const pointerBubbles = page => page.$$eval('#agentThread .turnb--ai .point', els => els.length);
/* "anytime that we show a link in the chat history, it should open a new tab.
   Otherwise we're going to lose the whole conversation" (client) */
const linksKeepTheChat = async (page, label) => {
  const links = await page.$$eval('#agentThread a[href]', els => els.map(a => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel })));
  const bad = links.filter(l => !/^#/.test(l.href) && (l.target !== '_blank' || !/\bnoopener\b/.test(l.rel)));
  ok(links.length > 0 && bad.length === 0, label + ': all ' + links.length + ' links in the thread open a new tab' + (bad.length ? ' — NOT: ' + bad.map(l => l.href).join(', ') : ''));
};

try {
  console.log('\n▶ a real need, typed: the product is named before anything is asked');
  {
    const { ctx, page, state } = await open();
    await say(page, 'I want to create my own surveys');
    const b = await last(page);
    ok(b.items.length >= 1 && b.items[0].id === 'questdiy', 'QuestDIY is pointed at first (' + b.items.map(i => i.id).join(',') + ')');
    ok(b.items[0].href === '/s/questdiy', 'the pointer is the product page (' + b.items[0].href + ')');
    ok(b.items[0].line.length > 20, 'with the catalog\'s own line: "' + b.items[0].line.slice(0, 60) + '…"');
    ok(/Read about QuestDIY/.test(b.items[0].go), 'and a door: "' + b.items[0].go + '"');
    ok(b.intro && /point you/.test(b.intro), 'led in with "' + b.intro + '"');
    const q = b.texts[b.texts.length - 1];
    ok(/\?/.test(q), 'then the question still follows: "' + q + '"');
    ok(b.order.indexOf('pointers') < b.order.lastIndexOf('text') && b.order.lastIndexOf('text') < b.order.indexOf('chips'), 'in reading order: where to look → the question → its chips (' + b.order.join(' → ') + ')');
    ok(!/couple of quick questions/i.test(b.texts.join(' ')), 'no "a couple of quick questions" preamble');
    await linksKeepTheChat(page, 'pointers');
    /* "try it out and you will see how it jumps": a tall answer must open at
       its first line, not scrolled to its last */
    const view = await page.evaluate(() => {
      const t = document.querySelector('#agentThread'), b = [...t.querySelectorAll('.turnb--ai')].pop();
      const tr = t.getBoundingClientRect(), br = b.getBoundingClientRect();
      return { top: Math.round(br.top - tr.top), tall: br.height > t.clientHeight, more: t.classList.contains('is-more'), room: t.clientHeight, height: Math.round(br.height) };
    });
    ok(view.top >= -2 && view.top + view.height <= view.room + 2, 'the whole answer is in view (bubble ' + view.height + 'px at ' + view.top + 'px in a ' + view.room + 'px window)');
    ok(!view.more, 'nothing hidden below, no fade');
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.pointers && st.pointers.kind === 'reco', 'the flow carries the pointers as the running (' + (st.pointers && st.pointers.kind) + ')');
    const shown = await page.evaluate(() => window.__tracked.filter(t => t[0] === 'kimi_pointer_shown'));
    ok(shown.length === 1 && shown[0][1].products.startsWith('questdiy'), 'kimi_pointer_shown tracked once');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a pill: the goal\'s own shortlist, then the question — and not again under the next one');
  {
    const { ctx, page, state } = await open();
    await page.click('#agentTags .tag[data-goal="competition"]');
    await settle(page); await page.waitForTimeout(250);
    const b = await last(page);
    ok(b.items.length === 2 && b.items[0].id === 'newintel', 'two products to know, NewIntel first (' + b.items.map(i => i.id).join(',') + ')');
    ok(b.intro && /products to know/.test(b.intro), 'led in as a shortlist, not a recommendation: "' + b.intro + '"');
    ok(b.items.every(i => /^\/(s\/|[a-z-]+$)/.test(i.href)), 'every item links to a page on this site');
    ok(b.texts[0] && /Tracking the competition/.test(b.texts[0]) && !/narrow down/.test(b.texts[0]), 'the ack is one short line: "' + b.texts[0] + '"');
    ok((await pointerBubbles(page)) === 1, 'one pointer block so far');
    await chip(page, "I'd rather not say");
    ok((await pointerBubbles(page)) === 1, 'the role question does not repeat the same two');
    await chip(page, 'Marketing manager');
    ok((await pointerBubbles(page)) === 1, 'nor does the goal\'s own first question');
    /* small talk in place of an answer holds the question — and adds no list */
    await say(page, 'hello');
    ok((await pointerBubbles(page)) === 1, 'nor does a hold turn');
    /* the discriminator turns the shortlist into the running */
    const before = await pointerBubbles(page);
    const chips = (await last(page)).chips;
    const pick = chips.find(c => /competitor|pricing|week|move|live/i.test(c)) || chips[0];
    await chip(page, pick);
    const after = await pointerBubbles(page);
    const st = await page.evaluate(() => window.SAIKIMI.state());
    const form = await page.$('#heroLeadForm');
    ok(after === before + 1 || !!form, 'once there is evidence the running is drawn again (' + before + ' → ' + after + (form ? ', straight to the form' : '') + ')');
    ok(st.pointers && st.pointers.kind === 'reco', 'and it is the running now (' + (st.pointers && st.pointers.kind) + ')');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a short window: the tall answer opens at its first line, not its last ("you will see how it jumps")');
  for (const vp of [{ width: 1360, height: 640 }, { width: 400, height: 860 }]) {
    const { ctx, page, state } = await open({ viewport: vp });
    await page.click('#agentTags .tag[data-goal="audience_growth"]');
    await settle(page); await page.waitForTimeout(400);
    const v = await page.evaluate(() => {
      const t = document.querySelector('#agentThread'), b = [...t.querySelectorAll('.turnb--ai')].pop(), ack = b.querySelector('.turnb__text');
      const tr = t.getBoundingClientRect(), br = b.getBoundingClientRect(), ar = ack.getBoundingClientRect();
      return { top: Math.round(br.top - tr.top), ackTop: Math.round(ar.top - tr.top), tall: br.height > t.clientHeight, more: t.classList.contains('is-more'), room: t.clientHeight, height: Math.round(br.height) };
    });
    const label = vp.width + '×' + vp.height;
    ok(v.tall, label + ': the answer is taller than the window (' + v.height + ' > ' + v.room + ')');
    ok(v.top >= -2 && v.top <= 4, label + ': it opens at its first line (bubble top ' + v.top + 'px)');
    ok(v.ackTop >= -2, label + ': the ack is the first thing read ("…top ' + v.ackTop + 'px")');
    ok(v.more, label + ': the foot fades to say there is more below');
    await page.evaluate(() => { const t = document.querySelector('#agentThread'); t.scrollTop = t.scrollHeight; t.dispatchEvent(new Event('scroll')); });
    await page.waitForTimeout(50);
    ok(!(await page.$eval('#agentThread', t => t.classList.contains('is-more'))), label + ': scrolled to the end, the fade goes');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ the contact form is not the only way to the product');
  {
    const { ctx, page, state } = await open();
    await say(page, 'we need to know what competitors are doing this week, can you call me');
    ok(!!(await page.$('#heroLeadForm')), 'the form is open');
    const skip = await page.$eval('#agentThread .turnb--form .askform__skip', a => ({ href: a.getAttribute('href'), text: a.textContent.trim(), id: a.getAttribute('data-kimi-pointer') }));
    ok(skip.href === '/s/newintel' && skip.id === 'newintel', 'a skip link to the NewIntel page sits under the form (' + skip.href + ')');
    ok(/skip this and read about NewIntel/.test(skip.text), 'in plain words: "' + skip.text + '"');
    await linksKeepTheChat(page, 'the form (skip link and privacy notice)');
    /* the click is recorded as a hand-off from the form, without leaving the page here */
    await page.evaluate(() => document.querySelector('.askform__skip').addEventListener('click', e => e.preventDefault(), { once: true }));
    await page.click('.askform__skip');
    const clicks = await page.evaluate(() => window.__tracked.filter(t => t[0] === 'kimi_product_clicked'));
    ok(clicks.length === 1 && clicks[0][1].from === 'form' && clicks[0][1].product === 'newintel', 'kimi_product_clicked from=form product=newintel');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a bare fast track has nothing to point at, so it points at nothing');
  {
    const { ctx, page } = await open();
    await say(page, 'can you call me');
    ok(!!(await page.$('#heroLeadForm')), 'the form is open');
    ok(!(await page.$('.askform__skip')), 'no skip link invented for a product nobody was matched to');
    await ctx.close();
  }

  console.log('\n▶ restraint: small talk earns no product list');
  {
    const { ctx, page } = await open();
    await say(page, 'hello');
    ok((await pointerBubbles(page)) === 0, 'nothing pointed at on "hello"');
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(!st.pointers || !st.pointers.items.length, 'the flow has no pointers either');
    await ctx.close();
  }

  console.log('\n▶ a pointer mid-conversation is recorded as a hand-off from the chat');
  {
    const { ctx, page } = await open();
    await say(page, 'we need live competitive intelligence');
    const b = await last(page);
    ok(b.items.length && b.items[0].id === 'newintel', 'NewIntel is pointed at (' + b.items.map(i => i.id).join(',') + ')');
    await page.evaluate(() => document.querySelector('.point__item').addEventListener('click', e => e.preventDefault(), { once: true }));
    await page.click('.point__item');
    const clicks = await page.evaluate(() => window.__tracked.filter(t => t[0] === 'kimi_product_clicked'));
    ok(clicks.length === 1 && clicks[0][1].from === 'chat', 'kimi_product_clicked from=chat');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all green'));
process.exit(failures ? 1 : 0);
