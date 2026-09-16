/* ═══════════════════════════════════════════════════════════════════════════
   THE ORDER — the client's steps, as they stand after 2026-09-16:
     1) what do they want to solve
     2) their WORK EMAIL — its domain is the website, so one answer does two
     2b) …and only if that address is a personal one, their website
     3) here is some insights we have about your website (if any)
     4) how large is your org
     5) what's your role
     6) here are some recommendations we have
     7) book a call — where the name and the number are asked for by the
        booking and the "Call my phone" widget, not by the conversation
   ("let's ask for the work email first, and if they put in a Gmail or some
   ambiguous email, then we'll ask for the website"; "it's just when they click
   contact us or book us that they get asked the extra questions about phone
   number, name".) Both halves are flags in kimi.json — emailFirst and
   phoneStep — because the client is still moving the email around.
   Plus: no "I'd rather not say" on the website — a non-address is asked once
   more, then accepted as the company's name. The lead is created on the
   email, at the top, and updated as the rest is learned.

   Every model off; the site lookup is mocked known / unknown.

   Run:  node tests/kimi/order.funnel.mjs [baseUrl]   (default http://localhost:8199)
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://localhost:8199';
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

const KNOWN = { ok: true, known: true, name: 'Acme Hotels', domain: 'acmehotels.com', employees: 4200, industry: 'hospitality', competitors: ['Marriott', 'Hilton', 'Accor'] };
const UNKNOWN = { ok: true, known: false, name: null, domain: null, employees: null, industry: null, competitors: [] };

const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function open(research) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const state = { leads: [], errors: [], researched: [] };
  page.on('pageerror', e => state.errors.push(String(e.message)));
  await page.route('**/api/ask', r => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (body.mode === 'research' && research) {
      state.researched.push(body.domain);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(research) });
    }
    r.abort();                                                              /* every model off */
  });
  await page.route('**/api/lead', r => {
    state.leads.push(JSON.parse(r.request().postData() || '{}'));
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, delivered: true, mode: 'mock', destination: 'hubspot-mock' }) });
  });
  /* "Book a call" goes to the booking page (lead.js): stand it in, so the
     test can see the page it went to without leaving the server */
  await page.route('**/book*', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Book</title><h1 id="stub-book">booking page</h1>' }));
  await page.goto(BASE + '/next/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);
  /* the event log is kept in localStorage too, so it survives that navigation */
  await page.evaluate(() => {
    const a = window.SAIANALYTICS; window.__tracked = [];
    try { localStorage.removeItem('__tracked'); } catch (e) {}
    if (a && a.track) { const orig = a.track.bind(a); a.track = (n, p) => { window.__tracked.push([n, p || {}]); try { localStorage.setItem('__tracked', JSON.stringify(window.__tracked)); } catch (e) {} return orig(n, p); }; }
  });
  return { ctx, page, state };
}
const settle = async page => { await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait') && document.querySelector('#agentThread .turnb--ai .turnb__text'), null, { timeout: 15000 }); await page.waitForTimeout(250); };
const say = async (page, text) => { await page.fill('#agentInput', text); await page.press('#agentInput', 'Enter'); await settle(page); };
const chip = async (page, label) => { await page.click('#agentThread .turnb--ai:last-child .turnb__chips .tag:not([disabled]):has-text("' + label + '")'); await settle(page); };
const st = page => page.evaluate(() => window.SAIKIMI.state());
const lastText = page => page.$$eval('#agentThread .turnb--ai:last-child .turnb__text', els => els.map(e => e.textContent.trim()).filter(Boolean).pop() || '');
const chips = page => page.$$eval('#agentThread .turnb--ai:last-child .turnb__chips .tag', els => els.map(e => e.textContent.trim()));
const composer = page => page.$eval('#agentInput', el => ({ disabled: el.disabled, placeholder: el.placeholder, inputmode: el.getAttribute('inputmode') }));
const tracked = (page, name) => page.evaluate(n => { let l = window.__tracked; if (!l) { try { l = JSON.parse(localStorage.getItem('__tracked') || '[]'); } catch (e) { l = []; } } return l.filter(t => t[0] === n); }, name);

try {
  console.log('\n▶ a pill, a work address, an unknown site: every step in order');
  {
    const { ctx, page, state } = await open(UNKNOWN);
    /* 1) what do they want to solve */
    await page.click('#agentTags .tag[data-goal="competition"]');
    await settle(page);
    let s = await st(page);
    ok(s.primaryGoal === 'competition', '1) what they want to solve — the pill (' + s.primaryGoal + ')');
    /* 2) their work email — one answer for two questions */
    ok(s.question && s.question.id === 'work_email', '2) the WORK EMAIL is asked next (' + (s.question && s.question.id) + ')');
    ok((await chips(page)).length === 0, '   with no chip out of it — it is typed');
    ok((await page.$$('#agentThread .point, #agentThread .reco__card')).length === 0, '   and no product is named yet: recommendations come once, at step 6');
    let c = await composer(page);
    ok(/@/.test(c.placeholder) && c.inputmode === 'email', '   the composer asks for an address, keyboard set to email ("' + c.placeholder + '")');
    await say(page, 'not an email');
    ok(/does not look like/i.test(await lastText(page)) && (await st(page)).question.id === 'work_email', '   a bad address is asked again');
    await say(page, 'ada@acme-brands.com');
    /* 3) insights, if any — none here. The address carried the site with it. */
    ok(state.researched.includes('acme-brands.com'), '3) the site was looked up, from the address alone');
    ok(/couldn\'t find much/i.test(await page.$eval('#agentThread', e => e.textContent)), '   and it says plainly there was nothing to show');
    ok((await st(page)).website === 'acme-brands.com', '   the website is answered without ever being asked');
    ok(state.leads.length === 1 && state.leads[0].lead.email === 'ada@acme-brands.com' && state.leads[0].lead.name == null && state.leads[0].lead.phone == null,
      '   and the lead exists already, on the address alone — nothing is lost if they leave here');
    /* 4) how large the org is */
    s = await st(page);
    ok(s.question && s.question.id === 'company_size', '4) how large the org is (' + (s.question && s.question.id) + ')');
    await chip(page, '51 to 250');
    /* 5) the role */
    s = await st(page);
    ok(s.question && s.question.id === 'role', '5) the role (' + (s.question && s.question.id) + ')');
    await chip(page, 'Marketing manager');
    /* a bare goal has nothing to recommend from yet: its own opener, once */
    s = await st(page);
    ok(s.question && s.question.id === 'competition_type', '   a bare goal gets its own opener once (' + (s.question && s.question.id) + ')');
    await chip(page, "What they're doing right now");
    /* 6) the recommendation */
    s = await st(page);
    ok((await page.$$('#agentThread .point')).length === 0, '   no product was named before this point');
    ok((await page.$$('.reco__card--best')).length === 1, '6) the recommendation is shown');
    ok(await page.$eval('.reco__card--best .reco__name', e => /NewIntel/.test(e.textContent)), '   NewIntel, best fit');
    ok(await page.$eval('.turnb--reco .turnb__text', e => /where I\'d start|fits best/.test(e.textContent)), '   under its own heading: "' + (await page.$eval('.turnb--reco .turnb__text', e => e.textContent.trim())) + '"');
    ok(!(await page.$('#heroLeadForm')), '   and there is no form');
    ok((await page.$$eval('#agentThread .turnb--ai .turnb__text', els => els.filter(e => /work email/i.test(e.textContent)).length)) <= 1, '   the address is never asked for twice');
    /* 7) the call — and the number is asked for by the things that need it */
    ok(s.status === 'BOOK', '7) straight to the call: the address was taken at the top (' + s.status + ')');
    ok(state.leads.length >= 1 && state.leads[state.leads.length - 1].discovery.primary === 'newintel'
      && state.leads[state.leads.length - 1].discovery.companySize === 'mid'
      && state.leads[state.leads.length - 1].discovery.role === 'manager', '   the lead carries the recommendation, the size and the role');
    ok(state.leads.every(l => !l.lead.phone), '   and no number: the conversation never asks for one');
    const btn = await page.$('#agentThread .turnb--book [data-kimi-cta="BOOK"]');
    ok(!!btn && (await btn.evaluate(b => b.textContent.trim() + '|' + b.getAttribute('data-cta'))) === 'Book a call|demo', '   one button: "Book a call", wired to the booking');
    ok(!!(await page.$('#agentThread .turnb--book .call')), '   with "Call my phone" beside it — where the name and the number ARE asked');
    ok(/NewIntel/.test(await page.$eval('.turnb--book', e => e.textContent)), '   named for the product they were recommended');
    ok(/ada@acme-brands\.com/.test(await page.$eval('.turnb--book', e => e.textContent)), '   and says we follow up by email either way');
    c = await composer(page);
    ok(c.disabled, '   the composer is closed');
    const asked = (await st(page)).askedQuestionIds.join(' → ');
    ok(asked === 'work_email → company_size → role → competition_type', '   the questions were asked in order: ' + asked);
    const names = await page.evaluate(() => window.__tracked.map(t => t[0]));
    ['kimi_recommendation_generated', 'kimi_email_captured', 'kimi_book_offered'].forEach(n => ok(names.includes(n), '   event ' + n));
    ok(!names.includes('kimi_phone_captured'), '   and no phone step');
    const leak = await page.evaluate(() => JSON.stringify(window.SAI.events.list()).includes('ada@acme-brands.com'));
    ok(!leak, '   no full email address on the event bus');
    await Promise.all([page.waitForNavigation({ timeout: 10000 }), btn.click()]);
    ok(/\/book/.test(page.url()) && !!(await page.$('#stub-book')), '   and it takes them to the booking page (' + new URL(page.url()).pathname + ')');
    ok((await tracked(page, 'kimi_book_clicked')).length === 1, '   the click was recorded before leaving');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a personal address is kept, and the website is asked for next');
  {
    const { ctx, page, state } = await open(KNOWN);
    await page.click('#agentTags .tag[data-goal="competition"]');
    await settle(page);
    ok((await st(page)).question.id === 'work_email', 'the work email is asked');
    await say(page, 'ada@gmail.com');
    let s = await st(page);
    ok(s.email === 'ada@gmail.com' && s.emailFree === true, 'a personal address is recognised as one (' + s.email + ')');
    ok(state.leads.length === 1 && state.leads[0].lead.email === 'ada@gmail.com', '   and still creates the lead — it is how we reach them');
    ok(state.researched.length === 0, '   nothing was looked up: gmail.com is not their company');
    ok(s.question && s.question.id === 'website', '   so the website is asked next (' + (s.question && s.question.id) + ')');
    ok(/personal address/i.test(await page.$eval('#agentThread', e => e.textContent)), '   and it says why');
    await say(page, 'acmehotels.com');
    ok(state.researched.includes('acmehotels.com'), '   the site they name is looked up');
    s = await st(page);
    ok(s.website === 'acmehotels.com' && s.question && s.question.id === 'role', '   size came from the lookup, so the role is next (' + (s.question && s.question.id) + ')');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a typed need, a known site: insights shown, size not asked, no discriminator, phone declined');
  {
    const { ctx, page, state } = await open(KNOWN);
    await say(page, 'we need live competitive intelligence on what rivals are doing');
    let s = await st(page);
    ok(s.question && s.question.id === 'work_email', 'the work email is asked (' + (s.question && s.question.id) + ')');
    await say(page, 'cmo@acmehotels.com');
    /* 3) insights — from the address alone */
    const rows = await page.$$eval('.found__row', els => els.map(e => e.querySelector('dt').textContent.trim() + '=' + e.querySelector('dd').textContent.trim()));
    ok(rows.some(r => /^INDUSTRY=hospitality$/i.test(r)) && rows.some(r => /251 or more/.test(r)), '3) insights about the site are shown: ' + rows.join(', '));
    s = await st(page);
    ok(s.question && s.question.id === 'role', '4→5) size was read from the site, so the role comes next (' + (s.question && s.question.id) + ')');
    await chip(page, 'C-suite');
    s = await st(page);
    ok((await page.$$('.reco__card--best')).length === 1 && s.status === 'BOOK', '6→7) an intent was known, so no discriminator: cards, then the call (' + s.status + ')');
    ok(s.askedQuestionIds.join(' → ') === 'work_email → role', '   asked only: ' + s.askedQuestionIds.join(' → '));
    const last = state.leads[state.leads.length - 1];
    ok(state.leads.length >= 1 && last.discovery.companySize === 'large' && last.discovery.industry === 'hospitality' && last.discovery.siteKnown === true, '   the lead carries what the lookup read');
    ok(last.discovery.primary && last.lead.email === 'cmo@acmehotels.com', '   and the recommendation it ended on (' + last.discovery.primary + ')');
    ok(/cmo@acmehotels\.com/.test(await page.$eval('.turnb--book', e => e.textContent)) && !/0100/.test(await page.$eval('.turnb--book', e => e.textContent)), '   the follow-up line names the email only');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ no way out of the website question on a chip — asked once more, then the company\'s name is kept');
  {
    const { ctx, page, state } = await open(UNKNOWN);
    await page.click('#agentTags .tag[data-goal="brand_impact"]');
    await settle(page);
    /* a personal address gets us to the website question, which is where the
       decline behaviour lives */
    await say(page, 'someone@gmail.com');
    let s = await st(page);
    ok(s.question && s.question.id === 'website', 'a personal address leads to the website question');
    await say(page, "I'd rather not say");
    s = await st(page);
    ok(s.question && s.question.id === 'website' && /web address itself/i.test(await lastText(page)), 'a decline is met with one more ask for the address: "' + (await lastText(page)) + '"');
    ok((await tracked(page, 'kimi_website_nudged')).length === 1, '   recorded as a nudge');
    await say(page, 'Acme Brands');
    s = await st(page);
    ok(s.question && s.question.id === 'company_size', '   the second answer is accepted and the size is asked (' + (s.question && s.question.id) + ')');
    ok(s.company === 'Acme Brands' && s.website === '__skip__', '   what they typed is kept as the company\'s name (' + s.company + ')');
    ok(state.researched.length === 0, '   nothing was looked up for a name that is not an address');
    await chip(page, 'Under 20');
    await chip(page, 'Founder');
    await chip(page, 'Revenue, pricing power');
    const last = state.leads[state.leads.length - 1];
    ok(state.leads.length >= 1 && last.lead.company === 'Acme Brands', '   the lead carries the company name (' + (last && last.lead.company) + ')');
    ok(last.lead.email === 'someone@gmail.com', '   and the personal address, which is still how we reach them');
    ok(state.errors.length === 0, state.errors.length ? 'page errors: ' + state.errors.join(' | ') : 'no page errors');
    await ctx.close();
  }

  console.log('\n▶ a domain typed straight after the decline is still looked up');
  {
    const { ctx, page, state } = await open(KNOWN);
    await page.click('#agentTags .tag[data-goal="competition"]');
    await settle(page);
    await say(page, 'nope@gmail.com');                     /* a personal address → the website question */
    await say(page, 'no');
    await say(page, 'acmehotels.com');
    ok(state.researched.includes('acmehotels.com'), 'the address given on the second ask is looked up');
    ok((await st(page)).website === 'acmehotels.com', 'and kept');
    await ctx.close();
  }

  console.log('\n▶ the fast track is unchanged: "call me" is the form, then the cards, then done');
  {
    const { ctx, page, state } = await open(UNKNOWN);
    await say(page, 'we need to know what competitors are doing this week, can you call me');
    ok(!!(await page.$('#heroLeadForm')), 'the form opens at once');
    await page.fill('#heroLeadForm [name=name]', 'Test Visitor');
    await page.fill('#heroLeadForm [name=email]', 'visitor@example-brand.com');
    await page.fill('#heroLeadForm [name=phone]', '+1 212 555 0100');
    await page.click('#heroLeadForm .askform__go');
    await page.waitForSelector('.reco__card--best', { timeout: 12000 });
    await page.waitForTimeout(300);
    ok((await composer(page)).disabled, 'the composer closes on the cards — the details were already given');
    ok(state.leads.length === 1 && state.leads[0].lead.name === 'Test Visitor' && state.leads[0].lead.phone === '+1 212 555 0100', 'one lead, complete');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all green'));
process.exit(failures ? 1 : 0);
