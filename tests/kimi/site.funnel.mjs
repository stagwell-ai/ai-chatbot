/* ═══════════════════════════════════════════════════════════════════════════
   READING THEIR SITE — "it should have asked me about my website, and then it
   should do a quick search to see what info it can pull up and show me the
   info and then keep talking to me with added relevance" (client, 2026-09-10),
   and "at this point it should ask for my domain name, and then what is my
   role in the company".

   So every conversation opens: website → the lookup → what it found → role →
   only then the discriminating questions. What the lookup learns is used: the
   size band it returns means the size question is never asked.

   The honesty line matters as much as the feature. /api/ask mode:'research'
   answers known:false rather than guessing, and a domain it does not
   recognise must produce one plain sentence and nothing that looks like a
   fact. This asserts the invented names of a stand-in "unknown" reply never
   reach the page.

   Run:  node tests/kimi/site.funnel.mjs [baseUrl]   (default http://localhost:8199)
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://localhost:8199';
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

const NOTHING = { detectedGoals: [], detectedIntents: [], inferred: {}, userNeedSummary: '', confidence: 0, ack: '', reply: '' };
const KNOWN = { ok: true, known: true, name: 'Acme Hotels', domain: 'acmehotels.com', employees: 4200, industry: 'hospitality', competitors: ['Marriott', 'Hilton', 'Accor'] };
const UNKNOWN = { ok: true, known: false, name: null, domain: null, employees: null, industry: null, competitors: [] };

const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function open(research, interpretation) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const state = { lead: null, errors: [], researched: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.route('**/api/ask', r => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (body.mode === 'research') {
      state.researched.push(body.domain);
      if (research === 'down') return r.abort();
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(research) });
    }
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, interpretation: interpretation || NOTHING, llm: { provider: 'mock' } }) });
  });
  await page.route('**/api/lead', r => {
    state.lead = JSON.parse(r.request().postData() || '{}');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: false, mode: 'mock' }) });
  });
  await page.goto(BASE + '/next/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);
  return { ctx, page, state };
}
const settle = page => page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait'), null, { timeout: 15000 });
const say = async (page, text) => { await page.fill('#agentInput', text); await page.press('#agentInput', 'Enter'); await settle(page); await page.waitForTimeout(250); };
/* the question is the LAST text in the bubble: since the way-finding went in,
   a bubble can open with the ack, then the products to read about, then ask */
const lastAsk = page => page.$$eval('#agentThread .turnb--ai:last-child .turnb__text', els => els.map(e => e.textContent.trim()).filter(Boolean).pop() || '');
const thread = page => page.$eval('#agentThread', e => e.textContent);

try {
  console.log('\n▶ a site the model knows');
  {
    const { ctx, page, state } = await open(KNOWN);
    await page.click('#agentTags .tag[data-goal="operations"]');
    await settle(page); await page.waitForTimeout(250);
    ok(/website/i.test(await lastAsk(page)), 'the first question is the website');
    await say(page, 'acmehotels.com');
    ok(state.researched.includes('acmehotels.com'), 'the domain was looked up');
    const rows = await page.$$eval('.found__row', els => els.map(e => e.querySelector('dt').textContent.trim() + '=' + e.querySelector('dd').textContent.trim()));
    ok(rows.some(r => /^INDUSTRY=hospitality$/i.test(r)), 'it shows the industry');
    ok(rows.some(r => /2,500\+/.test(r)), 'it shows the size band');
    ok(rows.some(r => /Marriott, Hilton, Accor/.test(r)), 'it shows the comparison set');
    ok(/Acme Hotels/.test(await thread(page)), 'it names the company it recognised');
    ok(/role/i.test(await lastAsk(page)), 'then it asks the role');

    await page.click('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled]):nth-child(3)');
    await settle(page); await page.waitForTimeout(250);
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.companySize === 'enterprise', 'the size it read is kept (' + st.companySize + ')');
    ok(st.role === 'director_vp', 'the role is kept (' + st.role + ')');

    /* the size question must never be asked now — the lookup answered it */
    for (let i = 0; i < 5 && !(await page.$('#heroLeadForm')); i++) {
      const chip = await page.$('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])');
      if (!chip) break;
      await chip.click(); await settle(page); await page.waitForTimeout(250);
    }
    const asked = (await page.evaluate(() => window.SAIKIMI.state())).askedQuestionIds;
    ok(!asked.includes('company_size'), 'the size question is never asked: ' + asked.join(' → '));
    ok(!!(await page.$('#heroLeadForm')), 'the conversation still reaches the form');

    await page.fill('#heroLeadForm [name=name]', 'Ada Lovelace');
    await page.fill('#heroLeadForm [name=email]', 'ada@acmehotels.com');
    await page.fill('#heroLeadForm [name=phone]', '+1 212 555 0100');
    await page.click('#heroLeadForm .askform__go');
    await page.waitForFunction(() => !document.querySelector('#heroLeadForm'), null, { timeout: 12000 });
    const d = state.lead.discovery;
    ok(d.website === 'acmehotels.com', 'the lead carries the website');
    ok(d.role === 'director_vp', 'the lead carries the role');
    ok(d.companySize === 'enterprise' && d.industry === 'hospitality', 'the lead carries what the lookup read');
    ok(d.siteKnown === true, 'the lead records that the site was recognised');
    ok(state.errors.length === 0, state.errors.length ? state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a site it does not recognise — one honest line, nothing invented');
  {
    const { ctx, page, state } = await open(UNKNOWN);
    await page.click('#agentTags .tag[data-goal="competition"]');
    await settle(page); await page.waitForTimeout(250);
    await say(page, 'some-unknown-brand-xyz.com');
    const text = await thread(page);
    ok(/couldn't find much/i.test(text), 'it says plainly that it found nothing');
    ok((await page.$$('.found__row')).length === 0, 'no fact list is drawn');
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.companySize === null && !st.findings, 'nothing was invented into the state');
    ok(/role/i.test(await lastAsk(page)), 'and it carries on to the role');
    await ctx.close();
  }

  console.log('\n▶ the lookup is down entirely');
  {
    const { ctx, page, state } = await open('down');
    await page.click('#agentTags .tag[data-goal="competition"]');
    await settle(page); await page.waitForTimeout(250);
    await say(page, 'acmehotels.com');
    ok(/role/i.test(await lastAsk(page)), 'the conversation carries on regardless');
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.website === 'acmehotels.com', 'the website is still captured for the lead');
    ok(state.errors.length === 0, 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ declining, and typing a title instead of picking one');
  {
    const { ctx, page, state } = await open(KNOWN);
    await page.click('#agentTags .tag[data-goal="competition"]');
    await settle(page); await page.waitForTimeout(250);
    await page.click('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled])');   /* I'd rather not say */
    await settle(page); await page.waitForTimeout(250);
    ok(state.researched.length === 0, 'declining looks nothing up');
    ok(/role/i.test(await lastAsk(page)), 'and it moves straight to the role');
    await say(page, "I'm the CMO");
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.role === 'c_suite', 'a typed title lands on a band (' + st.role + ')');
    ok(!(await page.$('.found__row')), 'nothing was shown about a site nobody gave');
    await ctx.close();
  }

  console.log('\n▶ a website inside the first message answers the question before it is asked');
  {
    const { ctx, page, state } = await open(KNOWN, Object.assign({}, NOTHING, { detectedIntents: ['competitive_activity'], confidence: 0.9 }));
    await say(page, "we're acmehotels.com and we need to track competitors");
    const st = await page.evaluate(() => window.SAIKIMI.state());
    ok(st.website === 'acmehotels.com', 'the site was taken from their own sentence');
    ok(!st.askedQuestionIds.includes('website'), 'so the website question is skipped: ' + st.askedQuestionIds.join(' → '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all green'));
process.exit(failures ? 1 : 0);
