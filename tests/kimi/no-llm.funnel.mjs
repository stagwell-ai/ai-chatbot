/* ═══════════════════════════════════════════════════════════════════════════
   NO-LLM FUNNEL — brief §49D, mandatory: every model off, the whole funnel
   through pills only, on the real homepage in headless Chromium.

   /api/ask is aborted at the network layer (so the page behaves exactly as it
   does when every provider is down), /api/lead is answered by a stub that
   says "delivered:false, mode:mock" (what the real endpoint says with no
   HubSpot token). Six goals on desktop/light, one on phone/dark, one typed
   sentence. Asserts: the conversation ends on the form, the form ends on a
   best-fit card, the card names an active product with a CTA, the analytics
   events fired, no full email address reached the event bus, no page errors.

   Run:  node tests/kimi/no-llm.funnel.mjs [baseUrl]   (default http://localhost:8199)
   Needs Playwright + Chromium (the sandbox has both at /opt/node22 and /opt/pw-browsers).
   ═══════════════════════════════════════════════════════════════════════════ */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { DATA } from './_data.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://localhost:8199';
const OUT = process.env.KIMI_SHOTS || path.join(process.cwd(), 'tests', 'artifacts', 'kimi');
fs.mkdirSync(OUT, { recursive: true });

const goals = DATA.goals.goals;
const PICKS = { competition: ['current_activity'], brand_impact: ['revenue'], brand_awareness: ['ai_search', 'recommends'], audience_growth: ['identity'], reputation: ['early', 'single'], operations: ['conversations', 'phone'] };
const EXPECT = { competition: 'NewIntel', brand_impact: 'BERA.ai', brand_awareness: 'GEOPulse', audience_growth: 'Stagwell ID Graph', reputation: 'The Knowledge Machine', operations: 'NewVoices' };

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

async function run(browser, opts) {
  const { name, goal, text, viewport, dark, picks, expect } = opts;
  console.log('\n▶ ' + name);
  const ctx = await browser.newContext({ viewport, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  let askCalls = 0, leadBody = null;
  await page.route('**/api/ask', r => { askCalls++; r.abort(); });
  await page.route('**/api/lead', r => { leadBody = JSON.parse(r.request().postData() || '{}'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: false, mode: 'mock', destination: 'hubspot-mock' }) }); });
  await page.goto(BASE + '/next/index.html', { waitUntil: 'load' });
  if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);

  if (text) { await page.fill('#agentInput', text); await page.press('#agentInput', 'Enter'); }
  else await page.click('#agentTags .tag[data-goal="' + goal + '"]');

  /* small talk, before anything else: the agent answers and stays put — no
     question is consumed, no form appears, the six goals stay on offer */
  if (opts.smallTalk) {
    for (const line of opts.smallTalk) {
      await page.waitForFunction(() => document.querySelector('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])'), null, { timeout: 8000 });
      await page.fill('#agentInput', line); await page.press('#agentInput', 'Enter');
      await page.waitForFunction(n => document.querySelectorAll('#agentThread .turnb--me').length >= n, (opts.smallTalk.indexOf(line) + 2), { timeout: 8000 });
      await page.waitForTimeout(150);
    }
    await page.waitForFunction(() => document.querySelector('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])'), null, { timeout: 8000 });
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(!(await page.$('#heroLeadForm')), 'small talk never produced the form');
    ok(st.askedQuestionIds.length === 0 && st.status === 'DISCOVERY', 'still in discovery, no question consumed (' + st.askedQuestionIds.length + ' asked)');
    ok(st.suggestions.length === 6, 'the six goals are still on offer');
    const lines = await page.$$eval('#agentThread .turnb--ai .turnb__text', els => els.map(e => e.textContent.trim()));
    ok(new Set(lines).size === lines.length, 'each reply is different: ' + lines.map(l => l.slice(0, 30) + '…').join(' | '));
  }

  /* answer until the conversation runs out of questions. The cards now appear
     part-way through — the client's order of 2026-09-16 shows them the moment
     the address step is behind them — so a card on screen is no longer the
     signal that it is over: no question left is. */
  const trail = [];
  let previewAt = -1;
  const settled = () => page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && (document.querySelector('.reco__card--best') || document.querySelector('#agentThread .turnb--ai:last-child .turnb__text')), null, { timeout: 12000 });
  for (let i = 0; i < 8; i++) {
    await settled(); await page.waitForTimeout(150);
    const st = await page.evaluate(() => window.SAIKIMI.state());
    if (previewAt < 0 && st.previewed) previewAt = trail.length;
    if (!st.question && st.uiAction !== 'ASK') break;
    /* the typed steps: the work email first — its domain IS the website — and
       the website itself only when the address gave us nothing */
    if (st.question && st.question.field === 'email') {
      trail.push('work_email→ada@example-brand.com');
      await page.fill('#agentInput', 'ada@example-brand.com'); await page.press('#agentInput', 'Enter');
      continue;
    }
    if (st.question && st.question.id === 'website') {
      trail.push('website→example-brand.com');
      await page.fill('#agentInput', 'example-brand.com'); await page.press('#agentInput', 'Enter');
      continue;
    }
    await page.waitForFunction(() => document.querySelector('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])'), null, { timeout: 8000 });
    const chips = await page.$$eval('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])', els => els.map(e => e.textContent.trim()));
    const want = (st.suggestions || []).find(s => picks.includes(s.id) || picks.includes(s.value));
    const label = want ? want.label : (st.question && st.question.id === 'company_size' ? chips[1] : chips[0]);
    trail.push((st.question ? st.question.id : '?') + '→' + label);
    await page.click('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled]):has-text("' + label.replace(/"/g, '') + '")');
  }
  await settled(); await page.waitForTimeout(200);
  ok(await page.$('.reco__card--best'), 'reached the recommendation after: ' + trail.join(' · '));
  ok(trail.length >= 3 && trail.length <= 5, 'asked ' + trail.length + ' question(s)');
  /* the value before the qualification: shown after the address, with real
     questions still to come under them */
  ok(previewAt >= 0, 'the products were shown early, after ' + previewAt + ' answer(s)');
  ok(previewAt > 0 && previewAt < trail.length, '   …with ' + (trail.length - previewAt) + ' question(s) still to come under them');
  ok((await page.$$('#agentThread .turnb--reco')).length === 2, '   the first look and the recommendation are two bubbles');
  ok(!(await page.$('#heroLeadForm')), 'no form: the details are asked in the conversation');
  /* the email was asked SECOND now (flags.emailFirst, 2026-09-16), so the
     recommendation is followed by the call, not by another ask */
  const end = await page.evaluate(() => window.SAIKIMI.state());
  ok(end.status === 'BOOK', 'the recommendation is followed by the call (' + end.status + ')');
  ok(end.email && /@example-brand\.com$/.test(end.email), 'and the address was taken at the top: ' + end.email);

  ok(await page.$('.turnb--book [data-kimi-cta="BOOK"]'), 'ends on "Book a call"');
  /* the number is NOT asked in the conversation any more: it belongs to the
     things that need it — Book a call, and the "Call my phone" widget beside
     it (client, 2026-09-16) */
  ok(!(await page.$('.turnb--book .call')) === false, 'and offers "Call my phone" beside it');

  /* the LAST card bubble is the recommendation proper; the first is the look
     they were given before the questions */
  const card = await page.$$eval('.reco__card--best', els => [els[els.length - 1]].map(e => ({ name: e.querySelector('.reco__name').textContent.trim(), why: e.querySelector('.reco__why').textContent.trim(), cta: e.querySelector('.reco__go') && e.querySelector('.reco__go').textContent.trim(), learn: e.querySelector('.reco__learn') && e.querySelector('.reco__learn').getAttribute('href') }))[0]);
  ok(card.name === expect, 'best fit is ' + card.name + (card.name === expect ? '' : ' (expected ' + expect + ')'));
  ok(card.why.length > 20 && card.cta, 'card has a why (' + card.why.length + ' chars) and a CTA "' + card.cta + '"');
  ok(card.learn && /^\/(s\/|newvoices|the-machine|targeting-machine|agent-cloud)/.test(card.learn), 'Learn more points into the site: ' + card.learn);
  const also = await page.$$eval('#agentThread .turnb--reco:last-of-type .reco__card--also', els => els.length);
  ok(also <= 2, also + ' secondary card(s)');

  const events = await page.evaluate(() => window.SAI.events.list().map(e => e.type));
  ['kimi_started', 'kimi_recommendation_generated', 'kimi_email_captured', 'kimi_book_offered'].forEach(t => ok(events.includes(t), 'event ' + t));
  ok(!events.includes('kimi_phone_captured'), 'and no phone step in the conversation');
  ok(askCalls === 0 || events.includes('kimi_deterministic_mode'), askCalls ? 'event kimi_deterministic_mode after a failed model call' : 'no model call was needed');
  const leak = await page.evaluate(() => JSON.stringify(window.SAI.events.list()).includes('ada@example-brand.com'));
  ok(!leak, 'no full email address on the event bus');
  /* the lead is created on the address at the top and has no number yet: the
     number is asked for by the booking, not by the conversation */
  ok(leadBody && leadBody.lead && leadBody.lead.email === 'ada@example-brand.com' && !leadBody.lead.phone, 'the lead write carries the address taken at the top, and no number');
  ok(leadBody && leadBody.discovery && leadBody.discovery.primary, 'and the structured discovery (primary=' + (leadBody && leadBody.discovery && leadBody.discovery.primary) + ')');
  ok(askCalls >= 0 && (await page.evaluate(() => window.SAIKIMI.state().llmStatus)) === 'DETERMINISTIC', 'ran in DETERMINISTIC mode (' + askCalls + ' blocked /api/ask call(s))');
  ok(errors.length === 0, errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');

  const shot = path.join(OUT, name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png');
  await page.locator('#agentThread').screenshot({ path: shot }).catch(() => page.screenshot({ path: shot }));
  console.log('  shot ' + shot);
  await ctx.close();
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  for (const g of goals) {
    await run(browser, { name: 'pill ' + g.id + ' (desktop, light)', goal: g.id, viewport: { width: 1360, height: 900 }, dark: false, picks: PICKS[g.id], expect: EXPECT[g.id] });
  }
  await run(browser, { name: 'pill reputation (phone, dark)', goal: 'reputation', viewport: { width: 390, height: 844 }, dark: true, picks: PICKS.reputation, expect: EXPECT.reputation });
  await run(browser, { name: 'typed: call center misses leads overnight', text: 'Our call center misses leads overnight', viewport: { width: 1360, height: 900 }, dark: false, picks: ['phone', 'mid'], expect: 'NewVoices' });
  await run(browser, { name: 'typed: hello, hello, hello — then a pill', text: 'hello', smallTalk: ['hi there', 'what is this?'], viewport: { width: 1360, height: 900 }, dark: false, picks: ['competition', 'current_activity'], expect: 'NewIntel' });
} finally {
  await browser.close();
}
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all green'));
process.exit(failures ? 1 : 0);
