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
    /* the pills wait for the last word — when the question has any. A typed
       question carries no pill row at all now (2026-09-17). */
    const pills = await page.$('#agentThread .turnb--ai .turnb__chips');
    if (pills) ok(await pills.evaluate(e => parseFloat(getComputedStyle(e).opacity) > .9), '   the pills arrive after it');
    else ok(true, '   this question is typed: no pill row to wait for');
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

/* ── THE CARD ARRIVES ──
   "when this card comes out, id like to see more images and animation, it
   should be exciting. use the content from the product pages" (client,
   2026-09-17). Measured, not declared: the card is in the DOM long before it is
   seen — .reco is held at opacity 0 for the whole of .is-typing — so a stagger
   that starts on append plays to nobody. What follows records real
   animationstart/-end events and asserts the order the reader saw them in.

   Two runs: a product whose page has a picture (The Machine) and one that
   stands on a Stagwell gradient, because the band is built from whichever the
   product page itself uses. */
const RECORD = () => {
  window.__r = { t0: 0, ev: [], wrote: -1, lastWord: -1 };
  const watch = card => {
    if (card.__w) return; card.__w = 1;
    /* the words of THE BUBBLE THIS CARD IS IN — the question that follows the
       cards types too, and counting its words said the card had jumped the gun */
    const turn = card.closest('.turnb');
    if (turn && !turn.__ww) {
      turn.__ww = 1;
      turn.addEventListener('animationstart', e => {
        if (e.animationName === 'wordIn' && window.__r.t0) window.__r.lastWord = performance.now() - window.__r.t0;
      });
    }
    ['animationstart', 'animationend'].forEach(t => card.addEventListener(t, e => {
      const el = e.target, r = el.getBoundingClientRect();
      window.__r.ev.push({ n: e.animationName, t: performance.now() - window.__r.t0, ev: t.slice(9),
        cls: String(el.className).split(' ')[0],
        /* IN VIEW, not opaque: a fade-in is at zero on its first frame by
           definition — what matters is that it played where it could be seen */
        seen: r.top < innerHeight && r.bottom > 0 && r.width > 0 });
    }));
  };
  new MutationObserver(ms => {
    ms.forEach(m => {
      if (m.type === 'attributes' && m.target.classList && m.target.classList.contains('turnb--ai')
          && !m.target.classList.contains('is-typing') && window.__r.wrote < 0 && window.__r.t0)
        window.__r.wrote = performance.now() - window.__r.t0;
      (m.addedNodes || []).forEach(n => {
        if (n.nodeType !== 1 || !n.querySelectorAll) return;
        if (n.classList.contains('reco__card')) watch(n);
        n.querySelectorAll('.reco__card').forEach(watch);
      });
    });
  }).observe(document.querySelector('#agentThread'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
};

for (const [what, goal, answer] of [['a product with a picture of its own', 'efficiency', 'connect our marketing tools and data, the teams work in silos'],
                                    ['a product on a Stagwell ground', 'competition', null]]) {
  console.log('\n▶ the card ARRIVES — ' + what + ': it waits for the last word, then opens picture first');
  const { ctx, page, state } = await open('no-preference');
  await page.evaluate(RECORD);
  if (answer) { await say(page, answer); } else { await page.click('#agentTags .tag[data-goal="' + goal + '"]'); await settle(page); await done(page); }
  /* answer whatever it asks until the recommendation lands. The clock is reset
     before EVERY step, so the last reset is the one the cards are measured from */
  for (let i = 0; i < 9; i++) {
    if (await page.$('.reco__card--best')) break;
    await page.evaluate(() => { window.__r.t0 = performance.now(); window.__r.ev = []; window.__r.wrote = -1; window.__r.lastWord = -1; });
    const tags = await page.$$('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])');
    if (tags.length) { await tags[Math.min(1, tags.length - 1)].click(); await settle(page); await done(page); }
    else await say(page, (await page.$eval('#agentInput', e => e.placeholder)).indexOf('@') !== -1 ? 'ada@acme-brands.com' : 'acme-brands.com');
  }
  await page.waitForSelector('.reco__card--best');
  await done(page);
  await page.waitForTimeout(2600);
  const r = await page.evaluate(() => window.__r);
  const first = n => r.ev.find(e => e.n === n && e.ev === 'start');
  const rise = first('recoIn');
  const has = await page.$$eval('.reco__card--best .reco__shot', e => e.length);
  ok(!!rise, 'the card opens (recoIn' + (rise ? ' at ' + Math.round(rise.t) + 'ms' : ' NEVER') + ')');
  /* the card waits for the LAST WORD of the line above it — not for the 340ms
     of fade after it, which is when .is-typing finally comes off */
  ok(r.lastWord > 0 && rise && rise.t >= r.lastWord - 40,
    '   AFTER the last word of the answer above it (last word at ' + Math.round(r.lastWord) + 'ms, written out at ' + Math.round(r.wrote) + 'ms)');
  const band = first('recoBand'), row = first('recoRow'), sheen = first('recoSheen'), shot = first('recoShot');
  ok(!!band && band.t >= rise.t - 1, '   then the band opens (' + (band ? Math.round(band.t) + 'ms' : 'NEVER') + ')');
  ok(!!row && row.t >= band.t - 1, '   then the words under it (' + (row ? Math.round(row.t) + 'ms' : 'NEVER') + ')');
  ok(!!sheen, '   and a light passes over it (' + (sheen ? Math.round(sheen.t) + 'ms' : 'NEVER') + ')');
  ok(has ? !!shot : !shot, has ? '   the picture drifts as it opens (' + (shot ? Math.round(shot.t) + 'ms' : 'NEVER') + ')'
                               : '   no picture on this one, so nothing drifts — the ground carries it');
  const unseen = r.ev.filter(e => e.ev === 'start' && !e.seen);
  ok(unseen.length === 0, '   every part of it moved WHERE IT COULD BE SEEN' +
    (unseen.length ? ' — ' + unseen.length + ' did not: ' + [...new Set(unseen.map(e => e.cls))].join(',') : ''));
  const rows = r.ev.filter(e => e.n === 'recoRow' && e.ev === 'start').map(e => e.t).sort((a, b) => a - b);
  ok(rows.length >= 5, '   the lines come one after another (' + rows.length + ' of them)');
  ok(rows[rows.length - 1] - rows[0] > 200, '   spread over ' + Math.round(rows[rows.length - 1] - rows[0]) + 'ms, not all at once');
  const shown = await page.$$eval('.reco__card--best, .reco__card--best .reco__rv, .reco__card--best .reco__bandin>*, .reco__card--best .reco__proof li',
    els => els.map(e => +getComputedStyle(e).opacity));
  ok(shown.length > 4 && shown.every(v => v === 1), '   and it all ends up visible (' + shown.length + ' parts)');
  /* the band is the product PAGE's own opening, never something invented here */
  const art = await page.$eval('.reco__card--best', e => ({
    shot: (e.querySelector('.reco__shot') || {}).currentSrc || null,
    ground: (e.querySelector('.reco__band').className.match(/reco__band--(\w+)/) || [])[1],
    name: e.querySelector('.reco__name').textContent.trim(),
    names: e.querySelectorAll('.reco__name').length,
    proof: e.querySelectorAll('.reco__proof li').length
  }));
  ok(!!(art.shot || art.ground), 'the band carries that page\'s opening: ' + (art.shot ? art.shot.split('/').pop() : 'the ' + art.ground + ' ground'));
  ok(art.names === 1 && art.name.length > 1, '   with the name on it once, not twice: "' + art.name + '"');
  ok(!/\(|family frame/i.test(art.name), '   and it is a name for people, not a routing label');
  ok(!state.errors.length, 'no page errors' + (state.errors[0] ? ': ' + state.errors[0] : ''));
  await ctx.close();
}

console.log('\n▶ motion off: the card is simply there, picture and all');
{
  const { ctx, page } = await open('reduce');
  await toCards(page);
  await page.waitForSelector('.reco__card--best');
  await page.waitForTimeout(400);
  const moving = await page.$$eval('.reco__card--best *', els => els
    .filter(e => getComputedStyle(e).display !== 'none')
    .filter(e => getComputedStyle(e).animationName !== 'none' || +getComputedStyle(e).opacity < 1)
    .map(e => String(e.className).split(' ')[0]));
  ok(moving.length === 0, 'nothing on the card animates or is held back' + (moving.length ? ' — ' + [...new Set(moving)].join(',') : ''));
  const clip = await page.$eval('.reco__card--best .reco__band', e => getComputedStyle(e).clipPath);
  ok(clip === 'none', '   and the band is not left clipped shut (' + clip + ')');
  await ctx.close();
}

} finally {
  await browser.close();
}

console.log(failures ? '\n✗ ' + failures + ' failed\n' : '\n✓ the answer writes itself in, and stays where it can be read\n');
process.exit(failures ? 1 : 0);
