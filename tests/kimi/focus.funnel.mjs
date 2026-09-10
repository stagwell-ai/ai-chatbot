/* ═══════════════════════════════════════════════════════════════════════════
   THE CARET — a conversation you cannot type into is not a conversation
   (client, 2026-09-10: "if I tap here, and then write a question, and then try
   and type after the AI gives me an answer, I can't type — I need to click
   around the text input").

   Three ways in, and after the agent's answer the visitor must be able to keep
   typing without touching the mouse:
     · the bar's chat bubble → the overlay → Enter (closing the overlay used to
       hand focus back to the bubble, and the question travelled to the hero
       without the caret);
     · a sentence typed into the hero field;
     · a starting point tapped (the chip is disabled once answered, and a
       disabled element drops focus onto <body>).

   And three restraints, so the fix does not become its own bug:
     · on a touch screen a pill tap must NOT raise the keyboard;
     · focus the visitor deliberately moved elsewhere is left alone;
     · the contact form takes the caret at its first field, and the composer is
       closed once the cards are up.

   Run:  node tests/kimi/focus.funnel.mjs [baseUrl]   (default http://localhost:8199)
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium, devices;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
  try { ({ chromium, devices } = require(c)); break; } catch (e) { /* next */ }
}
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://localhost:8199';
const PAGE = BASE + '/next/index.html';

/* the model, stood in for: every message reads as one competitive intent, so
   the conversation is the same shape every run */
const MOCK = {
  detectedGoals: [], detectedIntents: ['competitive_activity'],
  inferred: { industry: null, companySize: null, creatorProgramSize: null, geographicScope: null },
  userNeedSummary: 'Wants live competitor signal.', confidence: 0.9,
  ack: 'Got it — a live view of what competitors are doing.', reply: ''
};

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

async function prepare(ctx) {
  const page = await ctx.newPage();
  await page.route('**/api/ask', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, interpretation: MOCK, llm: { provider: 'mock', chainIndex: 0, fallbacks: 0 } }) }));
  await page.route('**/api/lead', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: false, mode: 'mock' }) }));
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);
  return page;
}
const active = page => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.name || a.className || a.tagName) : 'null'; });
const answered = page => page.waitForFunction(
  () => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'),
  null, { timeout: 15000 });

/* the visitor types with the mouse untouched; the words must land in the field */
async function typeBlind(page, words) {
  await page.keyboard.type(words);
  return page.$eval('#agentInput', e => e.value);
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const desktop = { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' };

  for (const via of ['the bar\'s chat bubble', 'typing in the hero field', 'tapping a starting point']) {
    console.log('\n▶ ' + via);
    const ctx = await browser.newContext(desktop);
    const page = await prepare(ctx);
    if (via.includes('bubble')) {
      await page.click('#navSearch');
      await page.waitForTimeout(400);
      await page.keyboard.type('we need to track competitors');
      await page.keyboard.press('Enter');
    } else if (via.includes('typing')) {
      await page.click('#agentInput');
      await page.keyboard.type('we need to track competitors');
      await page.keyboard.press('Enter');
    } else {
      await page.click('#agentTags .tag[data-goal="competition"]');
    }
    await answered(page);
    await page.waitForTimeout(300);
    const where = await active(page);
    ok(where === 'agentInput', 'the caret is in the field after the answer (' + where + ')');
    const landed = await typeBlind(page, 'what about pricing');
    ok(landed === 'what about pricing', 'typing lands without clicking first (' + JSON.stringify(landed) + ')');
    await ctx.close();
  }

  console.log('\n▶ restraint: a phone keyboard is not summoned by a pill');
  {
    const ctx = await browser.newContext(Object.assign({}, devices['iPhone 13'], { reducedMotion: 'reduce' }));
    const page = await prepare(ctx);
    await page.tap('#agentTags .tag[data-goal="competition"]');
    await answered(page);
    await page.waitForTimeout(300);
    ok((await active(page)) !== 'agentInput', 'a pill tap left the field alone');
    await page.tap('#agentInput');
    await page.keyboard.type('what are they charging');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    ok((await active(page)) === 'agentInput', 'after typing, the caret stays — the keyboard does not drop');
    await ctx.close();
  }

  console.log('\n▶ restraint: focus the visitor moved elsewhere, and the contact form');
  {
    const ctx = await browser.newContext(desktop);
    const page = await prepare(ctx);
    await page.click('#agentTags .tag[data-goal="competition"]');
    await page.evaluate(() => document.querySelector('.nav__acts [data-cta]').focus());   /* tabbed to Book a demo while it thought */
    await answered(page);
    await page.waitForTimeout(400);
    ok((await active(page)) !== 'agentInput', 'the button they focused kept the caret');

    for (let i = 0; i < 6 && !(await page.$('#heroLeadForm')); i++) {
      await page.click('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])');
      await page.waitForFunction(() => document.querySelector('#heroLeadForm') || document.querySelector('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])'), null, { timeout: 15000 });
      await page.waitForTimeout(250);
    }
    await page.waitForSelector('#heroLeadForm', { timeout: 15000 });
    await page.waitForTimeout(400);
    ok((await active(page)) === 'name', 'the contact form takes the caret at Full name');
    await page.fill('#heroLeadForm [name=name]', 'Test Visitor');
    await page.fill('#heroLeadForm [name=email]', 'visitor@example-brand.com');
    await page.fill('#heroLeadForm [name=phone]', '+1 212 555 0100');
    await page.click('#heroLeadForm .askform__go');
    await page.waitForSelector('.reco__card--best', { timeout: 15000 });
    await page.waitForTimeout(300);
    ok(await page.$eval('#agentInput', e => e.disabled), 'the composer is closed once the cards are up');
    await ctx.close();
  }
  console.log('\n▶ the whole card is the field, not just the line at the top');
  {
    const ctx = await browser.newContext(desktop);
    const page = await prepare(ctx);
    const box = await page.$eval('#agentForm', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const at = async (fx, fy) => { await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy); return active(page); };
    for (const [name, fx, fy] of [['the middle', .5, .5], ['the bottom left', .25, .82], ['beside the send disc', .8, .82]]) {
      /* click away first, so each probe starts from nothing */
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      const where = await at(fx, fy);
      ok(where === 'agentInput', 'clicking ' + name + ' of the card focuses the field (' + where + ')');
    }
    /* typing after one of those clicks must land */
    await page.keyboard.type('hello there');
    ok((await page.$eval('#agentInput', e => e.value)) === 'hello there', 'and the typing lands');

    /* the things that are their own targets still are */
    await page.fill('#agentInput', 'we need to track competitors');
    await page.click('.askbox__go');
    await answered(page);
    ok((await page.$$eval('#agentThread .turnb--me', els => els.length)) === 1, 'the send disc still sends rather than only focusing');
    const chips = await page.$$('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])');
    if (chips.length) {
      await chips[0].click();
      await answered(page);
      ok((await page.$$eval('#agentThread .turnb--me', els => els.length)) === 2, 'a chip in the thread still answers');
    }
    /* selecting a line the agent wrote must not yank the caret away mid-drag */
    /* the LAST answer, scrolled into view: the thread is a clipped, scrolling
       column, so the first line may sit outside it by now */
    const line = (await page.$$('#agentThread .turnb--ai .turnb__text')).pop();
    await line.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const lb = await line.boundingBox();
    /* along the FIRST line, in small steps: a coarse drag across a two-line
       block lands between the lines and selects nothing */
    await page.mouse.move(lb.x + 6, lb.y + 8);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(lb.x + 6 + i * 12, lb.y + 8); await page.waitForTimeout(15); }
    await page.mouse.up();
    const selected = await page.evaluate(() => String(getSelection() || '').trim());
    ok(selected.length > 0, 'a line of the answer can still be selected (' + JSON.stringify(selected.slice(0, 24)) + ')');
    ok((await active(page)) !== 'agentInput', 'and selecting it did not steal the caret');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all green'));
process.exit(failures ? 1 : 0);
