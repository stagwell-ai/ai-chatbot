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

  /* answer until the form arrives */
  const trail = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForFunction(() => document.querySelector('#heroLeadForm') || document.querySelector('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])'), null, { timeout: 8000 });
    if (await page.$('#heroLeadForm')) break;
    const chips = await page.$$eval('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])', els => els.map(e => e.textContent.trim()));
    const st = await page.evaluate(() => window.SAIKIMI.state());
    const want = (st.suggestions || []).find(s => picks.includes(s.id) || picks.includes(s.value));
    const label = want ? want.label : (st.question && st.question.id === 'company_size' ? chips[1] : chips[0]);
    trail.push((st.question ? st.question.id : '?') + '→' + label);
    await page.click('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled]):has-text("' + label.replace(/"/g, '') + '")');
  }
  ok(await page.$('#heroLeadForm'), 'reached the contact form after: ' + trail.join(' · '));
  ok(trail.length >= 1 && trail.length <= 5, 'asked ' + trail.length + ' question(s)');

  /* validation: empty submit shakes, bad email hints, then a good submit */
  await page.click('#heroLeadForm .askform__go');
  ok(!(await page.$('.reco__card')), 'empty form does not submit');
  await page.fill('#heroLeadForm [name=name]', 'Test Visitor');
  await page.fill('#heroLeadForm [name=email]', 'not-an-email');
  await page.fill('#heroLeadForm [name=phone]', '+1 212 555 0100');
  await page.click('#heroLeadForm .askform__go');
  ok(await page.$eval('#heroLeadHint', e => !e.hidden && e.textContent.length > 0), 'bad email shows the hint');
  await page.fill('#heroLeadForm [name=email]', 'visitor@example-brand.com');
  await page.click('#heroLeadForm .askform__go');
  await page.waitForSelector('.reco__card--best', { timeout: 8000 });

  const card = await page.$eval('.reco__card--best', e => ({ name: e.querySelector('.reco__name').textContent.trim(), why: e.querySelector('.reco__why').textContent.trim(), cta: e.querySelector('.reco__go') && e.querySelector('.reco__go').textContent.trim(), learn: e.querySelector('.reco__learn') && e.querySelector('.reco__learn').getAttribute('href') }));
  ok(card.name === expect, 'best fit is ' + card.name + (card.name === expect ? '' : ' (expected ' + expect + ')'));
  ok(card.why.length > 20 && card.cta, 'card has a why (' + card.why.length + ' chars) and a CTA "' + card.cta + '"');
  ok(card.learn && /^\/next\//.test(card.learn), 'Learn more points into the site: ' + card.learn);
  const also = await page.$$eval('.reco__card--also', els => els.length);
  ok(also <= 2, also + ' secondary card(s)');

  const events = await page.evaluate(() => window.SAI.events.list().map(e => e.type));
  ['kimi_started', 'kimi_contact_viewed', 'kimi_contact_submitted', 'kimi_recommendation_generated'].forEach(t => ok(events.includes(t), 'event ' + t));
  ok(askCalls === 0 || events.includes('kimi_deterministic_mode'), askCalls ? 'event kimi_deterministic_mode after a failed model call' : 'no model call was needed');
  const leak = await page.evaluate(() => JSON.stringify(window.SAI.events.list()).includes('visitor@example-brand.com'));
  ok(!leak, 'no full email address on the event bus');
  ok(leadBody && leadBody.lead && leadBody.lead.email === 'visitor@example-brand.com' && leadBody.discovery && leadBody.discovery.primary, 'lead payload carries the contact and the structured discovery (primary=' + (leadBody && leadBody.discovery && leadBody.discovery.primary) + ')');
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
