/* ═══════════════════════════════════════════════════════════════════════════
   THE ANSWER ARRIVES — "when this popped out, it scrolled down forcibly to the
   end, thats a mistake, it shouldnt scroll me down, it should let me read the
   response, and i want the response to animate in like an ai chatbot, like its
   typing up the response in a cool animation" (client, 2026-09-16).

   Two things, and they are one thing: the recommendation has to land where the
   reader is, at its FIRST line, and it has to arrive as writing rather than as
   a wall. So this suite runs with motion ON (every other browser suite runs
   reducedMotion:'reduce', which is exactly the state where the reveal is meant
   to be skipped) and checks:

     · the window does not travel to the foot of the page when the cards land
     · the thread opens on the head of the recommendation, not its foot
     · the words are dealt out one at a time and end up all present
     · the pills and the buttons wait for the last word
     · with motion off nothing is hidden, ever

   Every model off: the keyword reader carries the flow.

   Run:  node tests/kimi/reveal.funnel.mjs [baseUrl]   (default http://localhost:8199)
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://localhost:8199';
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

const UNKNOWN = { ok: true, known: false, name: null, domain: null, employees: null, industry: null, competitors: [] };
const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function open(motion) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: motion });
  const page = await ctx.newPage();
  const state = { errors: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.route('**/api/ask', r => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (body.mode === 'research') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(UNKNOWN) });
    r.abort();                                                              /* every model off */
  });
  await page.route('**/api/lead', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: true, mode: 'mock' }) }));
  await page.goto(BASE + '/next/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);
  return { ctx, page, state };
}
/* the thinking dots are gone and an answer is on the thread. The words may
   still be uncovering — that is what this suite is here to watch. */
const settle = async page => {
  await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'), null, { timeout: 15000 });
  await page.waitForTimeout(120);
};
const done = page => page.waitForFunction(() => !document.querySelector('#agentThread .turnb--ai.is-typing'), null, { timeout: 15000 });
const say = async (page, text) => { await page.fill('#agentInput', text); await page.press('#agentInput', 'Enter'); await settle(page); await done(page); };
const chip = async (page, label) => {
  await done(page);
  await page.click('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled]):has-text("' + label + '")');
  await settle(page); await done(page);
};
/* the six answers that reach a recommendation without a model */
const toCards = async (page) => {
  await page.click('#agentTags .tag[data-goal="competition"]');
  await settle(page); await done(page);
  await say(page, 'ada@acme-brands.com');   /* the work email: its domain is the site (2026-09-16) */
  await chip(page, '51 to 250');
  await chip(page, 'Marketing manager');
  await chip(page, "What they're doing right now");
};

try {
  console.log('\n▶ the recommendation lands where the reader is');
  {
    const { ctx, page, state } = await open('no-preference');
    await page.click('#agentTags .tag[data-goal="competition"]');
    await settle(page); await done(page);
    await say(page, 'ada@acme-brands.com');   /* the work email: its domain is the site (2026-09-16) */
    await chip(page, '51 to 250');
    await chip(page, 'Marketing manager');

    /* the last answer before the cards: remember where the window is */
    const before = await page.evaluate(() => scrollY);
    await chip(page, "What they're doing right now");
    await page.waitForSelector('.reco__card--best');
    await done(page);
    await page.waitForTimeout(400);                 /* any smooth scroll finishes */

    /* the cards are shown twice now — a first look before the business
       questions, then the recommendation proper — so it is the LAST bubble
       that has to land where the reader is */
    const after = await page.evaluate(() => {
      const last = sel => { const e = document.querySelectorAll(sel); return e[e.length - 1]; };
      return {
        y: scrollY,
        max: document.documentElement.scrollHeight - innerHeight,
        recoTop: last('.turnb--reco').getBoundingClientRect().top,
        bar: document.querySelector('#nav').getBoundingClientRect().height,
        cards: last('.reco__card--best').getBoundingClientRect().top
      };
    });
    ok(after.y < after.max - 40, 'the page is NOT thrown to the foot when the cards arrive (y=' + Math.round(after.y) + ' of ' + Math.round(after.max) + ')');
    ok(Math.abs(after.recoTop - (after.bar + 16)) < 24,
      'the page rests on the FIRST line of the answer, just under the bar (top=' + Math.round(after.recoTop) + ', bar=' + Math.round(after.bar) + ')');
    ok(after.cards > 0 && after.cards < 900, '   so the best fit is on screen, read from the top (at ' + Math.round(after.cards) + ')');
    ok(before >= 0, '   (came from y=' + Math.round(before) + ')');

    const thread = await page.evaluate(() => {
      const all = document.querySelectorAll('.turnb--reco');
      const t = document.querySelector('#agentThread'), r = all[all.length - 1];
      if (!r) return null;
      return { scrollTop: t.scrollTop, top: r.offsetTop, h: t.scrollHeight - t.clientHeight };
    });
    ok(thread && (thread.h < 4 || Math.abs(thread.scrollTop - thread.top) < 24),
      'the thread opens on the FIRST line of the recommendation, not its last (at ' + Math.round(thread.scrollTop) + ', head at ' + Math.round(thread.top) + ')');

    const text = await page.$$eval('.turnb--reco .turnb__text', els => els[els.length - 1].textContent.trim());
    ok(text.length > 4, 'and every word of the opening line is there once it has been written ("' + text + '")');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ the words are dealt out, not dropped in');
  {
    const { ctx, page, state } = await open('no-preference');
    await page.click('#agentTags .tag[data-goal="competition"]');
    /* catch the answer while it is still being written */
    await page.waitForSelector('#agentThread .turnb--ai.is-typing', { timeout: 15000 });
    const mid = await page.evaluate(() => {
      const b = document.querySelector('#agentThread .turnb--ai.is-typing');
      const words = [...b.querySelectorAll('.turnb__text .tw')];
      const seen = words.filter(w => parseFloat(getComputedStyle(w).opacity) > .5).length;
      const chipsRow = b.querySelector('.turnb__chips');
      return {
        words: words.length,
        seen,
        caret: !!b.querySelector('.turnb__caret'),
        chipsHidden: chipsRow ? parseFloat(getComputedStyle(chipsRow).opacity) < .5 : null,
        height: b.getBoundingClientRect().height,
      };
    });
    ok(mid.words > 3, 'the answer is cut into words (' + mid.words + ')');
    ok(mid.seen < mid.words, '   and only some of them are showing while it writes (' + mid.seen + ' of ' + mid.words + ')');
    ok(mid.caret, '   a caret rides the edge of what has been written');
    ok(mid.chipsHidden !== false, '   the answer pills wait for the last word');

    await done(page);
    const end = await page.evaluate(() => {
      const b = document.querySelector('#agentThread .turnb--ai');
      const words = [...b.querySelectorAll('.turnb__text .tw')];
      const chipsRow = b.querySelector('.turnb__chips');
      return {
        unseen: words.filter(w => parseFloat(getComputedStyle(w).opacity) < .99).length,
        caret: !!b.querySelector('.turnb__caret'),
        chips: chipsRow ? parseFloat(getComputedStyle(chipsRow).opacity) : 1,
        height: b.getBoundingClientRect().height,
        text: b.querySelector('.turnb__text').textContent.trim(),
      };
    });
    ok(end.unseen === 0, 'when it is done every word is there');
    ok(!end.caret, '   the caret is gone');
    ok(Math.abs(end.height - mid.height) < 2, '   and the bubble never changed height while writing (' + Math.round(mid.height) + ' → ' + Math.round(end.height) + ')');
    await page.waitForTimeout(500);
    ok(await page.$eval('#agentThread .turnb--ai .turnb__chips', e => parseFloat(getComputedStyle(e).opacity) > .9), '   the pills arrive after it');
    ok(end.text.length > 8, '   the words read as written ("' + end.text.slice(0, 60) + '…")');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }

  console.log('\n▶ motion off: the answer is simply there');
  {
    const { ctx, page, state } = await open('reduce');
    await toCards(page);
    await page.waitForSelector('.reco__card--best');
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => {
      const b = document.querySelector('.turnb--reco');
      return {
        typing: document.querySelectorAll('#agentThread .is-typing').length,
        wrapped: b.querySelectorAll('.tw').length,
        cards: parseFloat(getComputedStyle(b.querySelector('.reco')).opacity),
        text: b.querySelector('.turnb__text').textContent.trim(),
      };
    });
    ok(s.typing === 0 && s.wrapped === 0, 'nothing is animated and nothing is cut up');
    ok(s.cards > .9, 'and the cards are visible from the first frame');
    ok(s.text.length > 4, 'with the whole line written ("' + s.text + '")');
    ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
    await ctx.close();
  }
/* ── THE ORDER OF THE THREE THINGS ──
   "this response seems reversed. the chat should acknowledge that i dont want
   to give an email, say thats fine, and ill have a chance later in the
   conversation to provide more info if relevant, and only after show the
   answer" (client, 2026-09-17). The acknowledgement is a turn of its own,
   BEFORE the cards; the question that follows carries no second copy of it. */
console.log('\n▶ turning the address down: the answer to what they said comes before what we show them');
{
  const { ctx, page, state } = await open('reduce');
  await page.click('#agentTags .tag[data-goal="competition"]');
  await settle(page); await done(page);
  await say(page, "i'd rather not");
  await say(page, 'no thanks');
  await page.waitForFunction(() => window.SAIKIMI.state().previewed, null, { timeout: 15000 });
  await done(page); await page.waitForTimeout(400);
  const turns = await page.$$eval('#agentThread .turnb', els => els.map(e => ({
    kind: e.classList.contains('turnb--me') ? 'me' : e.classList.contains('turnb--reco') ? 'cards' : 'ai',
    text: e.textContent.replace(/\s+/g, ' ').trim()
  })));
  const iAck = turns.findIndex(t => t.kind === 'ai' && /that's fine/i.test(t.text));
  const iCards = turns.findIndex(t => t.kind === 'cards');
  ok(iAck !== -1, 'the refusal is answered in its own turn ("' + (turns[iAck] || {}).text?.slice(0, 60) + '…")');
  ok(iCards !== -1 && iAck < iCards, 'and it comes BEFORE the cards (ack at ' + iAck + ', cards at ' + iCards + ')');
  ok(/chance/i.test((turns[iAck] || {}).text || ''), '   it promises another chance to share more later');
  const after = turns.slice(iCards + 1).filter(t => t.kind === 'ai');
  ok(after.length >= 1 && !/that's fine/i.test(after[0].text), '   the question under the cards does not repeat it: "' + (after[0] || {}).text?.slice(0, 60) + '…"');
  ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
  await ctx.close();
}

} finally {
  await browser.close();
}

console.log(failures ? '\n✗ ' + failures + ' failed\n' : '\n✓ the answer writes itself in, and stays where it can be read\n');
process.exit(failures ? 1 : 0);
