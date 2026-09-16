/* ═══════════════════════════════════════════════════════════════════════════
   START OVER — "when you are chatting with the ai chat, there should be a
   button that lets you start over." (client, 2026-09-10.)

   The button is hidden until the first turn, then sits at the left of the
   composer bar. Pressing it must return the card to its opening state from
   anywhere: mid-questions, on the contact form, after the cards — and a turn
   that was still in flight when it was pressed must not repopulate the box.

   Run with every model off, so the deterministic floor carries it.

   Run:  node tests/kimi/restart.funnel.mjs [baseUrl]   (default http://localhost:8199)
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
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const state = { lead: null, errors: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.route('**/api/ask', async r => {                              /* every model off … */
    if (opts.askDelay) await new Promise(res => setTimeout(res, opts.askDelay)); /* … slowly, if asked */
    r.abort();
  });
  await page.route('**/api/lead', r => {
    state.lead = JSON.parse(r.request().postData() || '{}');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: false, mode: 'mock' }) });
  });
  await page.goto(BASE + (opts.path || '/next/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);
  return { ctx, page, state };
}
const say = async (page, text) => {
  await page.fill('#agentInput', text);
  await page.press('#agentInput', 'Enter');
  await page.waitForFunction(() => document.querySelector('#heroLeadForm') || (!document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text')), null, { timeout: 12000 });
  await page.waitForTimeout(250);
};
const fill = async page => {
  await page.fill('#heroLeadForm [name=name]', 'Test Visitor');
  await page.fill('#heroLeadForm [name=email]', 'visitor@example-brand.com');
  await page.click('#heroLeadForm .askform__go');
  await page.waitForFunction(() => !document.querySelector('#heroLeadForm'), null, { timeout: 12000 });
  await page.waitForTimeout(300);
};
/* one snapshot of everything Start over is meant to put back */
const snap = page => page.evaluate(() => {
  const inp = document.querySelector('#agentInput'), btn = document.querySelector('#agentRestart');
  const sec = document.querySelector('#agentInput').closest('section') || document.body;
  const st = window.SAIKIMI.state();
  return {
    turns: document.querySelectorAll('#agentThread .turnb').length,
    btnHidden: !btn || btn.hidden,
    inputDisabled: inp.disabled,
    placeholder: inp.placeholder,
    goHidden: !!(document.querySelector('.askbox__go') || {}).hidden,
    chat: !!document.querySelector('.is-chat'),
    closed: !!document.querySelector('.is-closed'),
    form: !!document.querySelector('#heroLeadForm'),
    cards: document.querySelectorAll('.reco__card').length,
    pillsOff: [...document.querySelectorAll('#agentTags .tag')].filter(b => b.disabled).length,
    asked: st.askedQuestionIds.length, goal: st.primaryGoal, contactRequest: st.contactRequest, ui: st.uiAction
  };
});
const startText = 'What do you need help solving?';
const isOpening = (s, label) => {
  ok(s.turns === 0, label + ': the thread is empty (' + s.turns + ' bubbles)');
  ok(s.btnHidden, label + ': the Start over button is hidden again');
  ok(!s.inputDisabled && !s.goHidden, label + ': the composer is typable and the send disc is back');
  ok(s.placeholder === startText, label + ': the placeholder is the opening hint ("' + s.placeholder + '")');
  ok(!s.chat && !s.closed, label + ': the card is out of chat/closed mode');
  ok(!s.form && s.cards === 0, label + ': no form, no cards');
  ok(s.pillsOff === 0, label + ': every starting-point pill is enabled');
  ok(s.asked === 0 && s.goal === null && s.contactRequest === null, label + ': the flow state is blank');
};

try {
  console.log('\n▶ before anything is said');
  {
    const { ctx, page } = await open();
    const s = await snap(page);
    ok(s.btnHidden, 'the button is hidden until there is something to start over from');
    await say(page, 'hello');
    ok(!(await snap(page)).btnHidden, 'it appears after the first turn');
    await ctx.close();
  }

  console.log('\n▶ mid-questions, after a pill and an answer');
  {
    const { ctx, page, state } = await open();
    await page.click('#agentTags .tag[data-goal="competition"]');
    await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'), null, { timeout: 12000 });
    await page.waitForTimeout(250);
    await say(page, 'ada@acme-brands.com');   /* the work email: its domain is the site (2026-09-16) */
    const before = await snap(page);
    ok(before.turns >= 3 && before.goal === 'competition' && before.chat, 'a real conversation is under way (' + before.turns + ' bubbles, goal ' + before.goal + ')');
    await page.click('#agentRestart');
    await page.waitForTimeout(200);
    isOpening(await snap(page), 'after Start over');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'agentInput'), 'focus lands back in the field');
    /* and the box works again from scratch */
    await say(page, 'we need to know what competitors are doing');
    const again = await snap(page);
    ok(again.turns === 2 && !again.btnHidden, 'a fresh first turn renders as a first turn (' + again.turns + ' bubbles)');
    ok(again.pillsOff === 0 || again.pillsOff === 4, 'the pills behave as on a fresh page (' + again.pillsOff + ' disabled)');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ on the contact form');
  {
    const { ctx, page, state } = await open();
    await say(page, 'can you call me');
    ok((await snap(page)).form, 'the fast-track form is open');
    await page.click('#agentRestart');
    await page.waitForTimeout(200);
    isOpening(await snap(page), 'after Start over');
    await say(page, 'hello');
    const s = await snap(page);
    ok(!s.form && s.contactRequest === null, 'a new "hello" does not reopen the old call request');
    ok(state.lead === null, 'nothing was sent as a lead');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ after the cards, when the composer is closed');
  {
    const { ctx, page, state } = await open();
    await say(page, 'we need to know what competitors are doing this week, can you call me');
    await page.fill('#heroLeadForm [name=phone]', '+1 212 555 0100');
    await fill(page);
    const before = await snap(page);
    ok(before.cards > 0 && before.closed && before.inputDisabled, 'the cards are up and the composer is closed');
    ok(!before.btnHidden, 'Start over is still offered on the closed card');
    await page.click('#agentRestart');
    await page.waitForTimeout(200);
    isOpening(await snap(page), 'after Start over');
    await say(page, 'hello');
    ok((await snap(page)).turns === 2, 'the reopened composer takes a message');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ pressed while an answer is still in flight');
  {
    const { ctx, page, state } = await open({ askDelay: 1500 });
    await page.fill('#agentInput', 'our sign-up rates are dropping');
    await page.press('#agentInput', 'Enter');
    await page.waitForSelector('#agentThread .turnb--wait', { timeout: 5000 });
    await page.click('#agentRestart');
    await page.waitForTimeout(200);
    isOpening(await snap(page), 'immediately');
    await page.waitForTimeout(2500);                                        /* the abandoned turn lands now */
    const s = await snap(page);
    ok(s.turns === 0 && s.btnHidden, 'the abandoned answer does not repopulate the box (' + s.turns + ' bubbles)');
    ok(!s.inputDisabled, 'the composer was not re-locked by the stale turn');
    await say(page, 'hello');
    ok((await snap(page)).turns === 2, 'and the box still takes a new message');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a product page carries the same button');
  {
    const { ctx, page, state } = await open({ path: '/next/s/newintel.html' });
    ok(await page.$('#agentRestart'), 'the button is in the generated page');
    /* the product page opens the chat from its own field at the close */
    await page.fill('#ppAskInput', 'hello');
    await page.press('#ppAskInput', 'Enter');
    await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'), null, { timeout: 12000 });
    await page.waitForTimeout(250);
    ok(!(await snap(page)).btnHidden, 'it shows after the first turn');
    await page.click('#agentRestart');
    await page.waitForTimeout(200);
    isOpening(await snap(page), 'after Start over');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all green'));
process.exit(failures ? 1 : 0);
