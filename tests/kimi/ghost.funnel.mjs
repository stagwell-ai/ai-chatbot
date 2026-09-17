/* ═══════════════════════════════════════════════════════════════════════════
   THE EMPTY BOX TYPES ITS OWN QUESTIONS

   "I want it to be like it's typing something out. So each character displays
   after the other, and then it sits there for a good couple of beats, and then
   gets deleted, and then a different one gets typed out as an animation"
   (client, 2026-09-17).

   Six questions, from data/kimi.json copy.askExamples. This suite watches the
   real placeholder twenty times a second and asserts what a visitor saw:

     · every one of the six is typed out in full, held, and taken back out
     · none of them is a question the agent cannot answer — each is put
       through the router here, so a suggestion is never a dead end
     · the first keystroke ends it, and it never resumes under someone typing
     · once the conversation starts the flow owns the box, not the animation
     · Start over brings the examples back
     · motion off: one example, standing still

   Every model off: the keyword reader carries the routing.

   Run:  node tests/kimi/ghost.funnel.mjs [baseUrl]   (default http://localhost:8199)
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }
const B = process.argv[2] || 'http://localhost:8199';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };
async function open(motion) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: motion || 'no-preference' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  await page.route('**/api/ask', r => { const b = JSON.parse(r.request().postData()||'{}');
    if (b.mode === 'research') return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"known":false}'}); r.abort(); });
  await page.route('**/api/lead', r => r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(B + '/next/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.SAIKIMI && window.SAI && window.SAI.data && window.SAI.data.kimi);
  return { ctx, page, errs };
}
const ph = page => page.$eval('#agentInput', e => e.placeholder);

console.log('\n▶ all six are typed out, held, and taken back out');
{
  const { ctx, page, errs } = await open();
  /* sampled faster than it types (42ms a letter), or the sampler itself
     reports "jumps" the visitor never saw */
  const seen = await page.evaluate(async ms => {
    const i = document.querySelector('#agentInput'), out = [], t0 = performance.now();
    while (performance.now() - t0 < ms) { out.push([Math.round(performance.now() - t0), i.placeholder]); await new Promise(r => setTimeout(r, 16)); }
    return out;
  }, 34000);
  const ex = await page.evaluate(() => window.SAI.data.kimi.copy.askExamples);
  let last = null; const frames = [];
  for (const [t, p] of seen) if (p !== last) { frames.push([t, p]); last = p; }
  const held = [];
  for (let i = 0; i < frames.length; i++) { const n = frames[i + 1]; if (n && p_hold(frames[i], n)) held.push([frames[i][1], n[0] - frames[i][0]]); }
  function p_hold(a, b) { return b[0] - a[0] > 900 && a[1]; }
  const words = held.map(h => h[0]);
  ex.forEach(q => ok(words.includes(q), 'typed in full and held: "' + q + '"'));
  ok(held.every(h => h[1] > 1600 && h[1] < 3200), '   each sits for a couple of beats (' + held.map(h => Math.round(h[1]) + 'ms').join(' ') + ')');
  /* ONE LETTER AT A TIME. frames[0] is the box's own resting prompt and
     frames[1] is the first letter of the first question — the swap between
     them is not a keystroke, and neither is the pause before it, so the
     measurement starts at the first letter. */
  const run = frames.slice(1, 15);
  const step = run.slice(1).map((f, i) => f[0] - run[i][0]);
  ok(step.every(s => s > 8 && s < 220), '   a character at a time (' + step.map(Math.round).join(',') + 'ms apart)');
  ok(run.slice(1).every((f, i) => f[1].length - run[i][1].length === 1), '   growing by exactly one: ' +
    run.map(f => f[1].length).join(',') + ' letters');
  ok(frames[1][1].length === 1, '   and it starts from the first letter, not a blank box ("' + frames[1][1] + '")');
  ok(words.length >= 6 && words[0] === ex[0], '   and it comes back round to the first (' + words.length + ' shown)');
  ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
  await ctx.close();
}

console.log('\n▶ motion off: one example, standing still');
{
  const { ctx, page } = await open('reduce');
  await page.waitForTimeout(2500);
  const a = await ph(page); await page.waitForTimeout(3500); const b = await ph(page);
  const want = await page.evaluate(() => window.SAI.data.kimi.copy.askExamples[0]);
  ok(a === want, 'it shows an example rather than the old prompt ("' + a + '")');
  ok(a === b, '   and it does not move (' + (a === b ? 'still' : 'moved to "' + b + '"') + ')');
  await ctx.close();
}
console.log('\n▶ the first keystroke ends it');
{
  const { ctx, page, errs } = await open();
  await page.waitForTimeout(1500);
  const mid = await ph(page);
  await page.click('#agentInput'); await page.type('#agentInput', 'hel', { delay: 40 });
  const at = await ph(page); await page.waitForTimeout(2600); const later = await ph(page);
  ok(mid.length > 0 && mid.length < 40, 'it was mid-word when the visitor started typing ("' + mid + '")');
  ok(at === later, '   and the placeholder froze on the first keystroke ("' + later + '")');
  /* interrupted mid-word, it finishes the question rather than freezing on a
     truncation the visitor would meet again when they clear the box */
  const EXQ = await page.evaluate(() => window.SAI.data.kimi.copy.askExamples);
  ok(EXQ.indexOf(later) !== -1 || later === 'What do you need help solving?',
    '   and it settles on a WHOLE question, not a half-typed one ("' + later + '")');
  await page.fill('#agentInput', '');
  await page.waitForTimeout(2600);
  ok((await ph(page)) === later, '   and emptying the box again does NOT restart it mid-thought');
  ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
  await ctx.close();
}
console.log('\n▶ the conversation starts: the flow owns the box');
{
  const { ctx, page, errs } = await open();
  await page.waitForTimeout(1200);
  await page.fill('#agentInput', 'i want to make surveys');
  await page.press('#agentInput', 'Enter');
  await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait'), null, { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--ai.is-typing'), null, { timeout: 25000 });
  const a = await ph(page); await page.waitForTimeout(3200); const b = await ph(page);
  ok(a === b, 'the flow\'s own prompt stays put ("' + a + '")');
  const ex = await page.evaluate(() => window.SAI.data.kimi.copy.askExamples);
  ok(!ex.includes(a), '   and it is the flow\'s, not an example');
  ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
  await ctx.close();
}
console.log('\n▶ Start over: an empty box asks again');
{
  const { ctx, page, errs } = await open();
  await page.waitForTimeout(1000);
  await page.fill('#agentInput', 'i want to make surveys');
  await page.press('#agentInput', 'Enter');
  await page.waitForFunction(() => !document.querySelector('#agentThread .turnb--wait'), null, { timeout: 15000 });
  await page.click('#agentRestart');
  await page.waitForTimeout(3000);
  const a = await ph(page); await page.waitForTimeout(1200); const b = await ph(page);
  ok(a !== b || a.length > 0, 'the examples come back after Start over ("' + a + '" → "' + b + '")');
  ok(!errs.length, 'no page errors' + (errs[0] ? ': ' + errs[0] : ''));
  await ctx.close();
}
console.log('\n▶ the six are real questions the agent can answer');
{
  const { ctx, page } = await open();
  const ex = await page.evaluate(() => window.SAI.data.kimi.copy.askExamples);
  ok(ex.length === 6, 'six of them');
  for (const q of ex) {
    const r = await page.evaluate(t => {
      const S = window.SAI, R = window.SAIRECOMMEND;
      const named = (R.nameMentions(t, S.data) || [])[0];
      const reco = R.recommend({ intents: R.keywordIntents(t, S.data) }, S.data);
      return { named, primary: reco && reco.primary };
    }, q);
    ok(!!(r.primary || r.named), '   "' + q + '" → ' + (r.primary || r.named || 'NOTHING'));
  }
  await ctx.close();
}
await browser.close();
console.log(fail ? '\n✗ ' + fail + ' failed\n' : '\n✓ the empty box types its own questions, and every one of them goes somewhere\n');
process.exit(fail ? 1 : 0);
