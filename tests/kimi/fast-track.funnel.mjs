/* ═══════════════════════════════════════════════════════════════════════════
   THE FAST TRACK — "if the person just ever cuts the chase that they want to
   be contacted, or they want to book a demo, or they want to try out
   something, we should just fast-track them to filling out the form. That's
   it, we're gold. Let's get their contact info and get a sales agent to reach
   out to them." (client, 2026-09-10.)

   Run with every model off, so this is the deterministic floor: the keyword
   reader in recommend.js has to carry it on its own.

   Run:  node tests/kimi/fast-track.funnel.mjs [baseUrl]   (default http://localhost:8199)
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

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const state = { lead: null, errors: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.route('**/api/ask', r => r.abort());                         /* every model off */
  await page.route('**/api/lead', r => {
    state.lead = JSON.parse(r.request().postData() || '{}');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: false, mode: 'mock' }) });
  });
  await page.goto(BASE + '/next/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);
  return { ctx, page, state };
}
const say = async (page, text) => {
  await page.fill('#agentInput', text);
  await page.press('#agentInput', 'Enter');
  await page.waitForFunction(() => document.querySelector('#heroLeadForm') || (!document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text')), null, { timeout: 12000 });
  await page.waitForTimeout(250);
};
const form = page => page.evaluate(() => {
  const f = document.querySelector('#heroLeadForm');
  if (!f) return null;
  return { title: f.querySelector('.askform__title').textContent.trim(), submit: f.querySelector('.askform__go').textContent.trim(), intro: f.closest('.turnb').querySelector('.turnb__text').textContent.trim() };
});
const fill = async (page, phone) => {
  await page.fill('#heroLeadForm [name=name]', 'Test Visitor');
  await page.fill('#heroLeadForm [name=email]', 'visitor@example-brand.com');
  await page.fill('#heroLeadForm [name=phone]', phone || '+1 212 555 0100');
  await page.click('#heroLeadForm .askform__go');
  await page.waitForFunction(() => !document.querySelector('#heroLeadForm'), null, { timeout: 12000 });
  await page.waitForTimeout(300);
};

try {
  for (const [text, kind, title] of [
    ['can you call me', 'call', 'Request a call'],
    ['how do i book a demo', 'demo', 'Book a demo'],
    ['I want to try it out', 'trial', 'Get started'],
    ['can I talk to someone', 'expert', 'Talk to a specialist'],
    ['how much does it cost', 'pricing', 'Talk to a specialist']
  ]) {
    console.log('\n▶ first message: "' + text + '"');
    const { ctx, page, state } = await open();
    await say(page, text);
    const f = await form(page);
    ok(!!f, 'the form is on screen straight away');
    if (f) {
      ok(f.title === title, 'it is titled "' + (f && f.title) + '"');
      ok(f.submit.length > 0 && !/recommendation/i.test(f.submit) || kind === null, 'the button says "' + f.submit + '"');
      ok(f.intro.length > 20, 'the agent answered in words first: "' + f.intro.slice(0, 60) + '…"');
    }
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.askedQuestionIds.length === 0, 'no discovery question was asked (' + st.askedQuestionIds.length + ')');
    ok(st.contactRequest === kind, 'the request is recorded as "' + st.contactRequest + '"');
    await fill(page, kind === 'call' ? '+1 212 555 0100' : null);
    ok(state.lead && state.lead.discovery && state.lead.discovery.contactRequest === kind, 'the lead carries contactRequest "' + (state.lead && state.lead.discovery && state.lead.discovery.contactRequest) + '"');
    ok(state.lead && state.lead.lead.phone === '+1 212 555 0100', 'the lead carries the phone number');
    const closing = await page.$eval('#agentThread .turnb:last-child .turnb__text', e => e.textContent.trim());
    ok(/in touch|call you|get you started|set up your demo|specialist/i.test(closing), 'it closes by saying a specialist is coming: "' + closing.slice(0, 70) + '…"');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a need AND a request in one message');
  {
    const { ctx, page, state } = await open();
    await say(page, 'we need to know what competitors are doing this week, can you call me');
    const f = await form(page);
    ok(!!f && f.title === 'Request a call', 'the form opens as a call request');
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.recommendation && st.recommendation.primary === 'newintel', 'what they told us is still routed (' + (st.recommendation && st.recommendation.primary) + ')');
    await fill(page);
    ok(state.lead.discovery.contactRequest === 'call' && state.lead.discovery.primary === 'newintel', 'the lead carries both the request and the product');
    ok(await page.$('.reco__card--best'), 'the recommendation is still shown after the details');
    await ctx.close();
  }

  console.log('\n▶ cutting to the chase mid-conversation');
  {
    const { ctx, page, state } = await open();
    await page.click('#agentTags .tag[data-goal="competition"]');
    await page.waitForFunction(() => document.querySelector('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])'), null, { timeout: 12000 });
    await page.waitForTimeout(250);
    const before = (await page.evaluate(() => window.SAIKIMI.state())).askedQuestionIds.length;
    await say(page, 'actually just get someone to call me');
    const f = await form(page);
    ok(!!f && f.title === 'Request a call', 'the questions stop and the form opens');
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.askedQuestionIds.length === before, 'no further question was asked');
    ok(st.primaryGoal === 'competition', 'the goal they picked is kept (' + st.primaryGoal + ')');
    await fill(page);
    ok(state.lead.discovery.primaryGoal === 'competition' && state.lead.discovery.contactRequest === 'call', 'the lead carries the goal and the request');
    await ctx.close();
  }

  console.log('\n▶ restraint: ordinary marketing talk still goes to discovery');
  {
    const { ctx, page } = await open();
    await say(page, 'our sign-up rates are dropping and we need to prove pricing power');
    ok(!(await page.$('#heroLeadForm')), 'no form — this is a problem to route, not a request');
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.contactRequest === null, 'nothing recorded as a contact request');
    ok(st.uiAction === 'ASK', 'the conversation carries on asking');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all green'));
process.exit(failures ? 1 : 0);
