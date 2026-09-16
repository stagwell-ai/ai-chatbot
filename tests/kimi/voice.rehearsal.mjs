/* ═══════════════════════════════════════════════════════════════════════════
   VOICE REHEARSAL QA — watch the story's pacing, headless.

   Opens the page with ?voicerehearse=1 (voice-rehearsal.js plays the model's
   half at a real speaking pace), taps "Chat with me", waits for the greeting
   and the pills, taps "What is Stagwell AI?", and then, every second until the
   stage is gone, takes a frame of the chat card and notes what is on stage.
   Out: a timeline (when each member landed against when its name was said),
   a contact sheet of the frames, and pass/fail on the pacing rules:

     · a member's card lands within 600 ms of its name being spoken
     · the members land in speaking order, at least 2 s apart
     · the story runs 45–90 s and the team assembles before the stage lifts

   Run:  node tests/kimi/voice.rehearsal.mjs [baseUrl] [outDir]
         (default http://localhost:8199, tests/kimi/.rehearsal)
   ═══════════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium;
for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { chromium = require(c).chromium; break; } catch (e) { /* next */ } }
if (!chromium) { console.error('playwright not found'); process.exit(2); }

const BASE = process.argv[2] || 'http://localhost:8199';
const OUT = process.argv[3] || path.join(path.dirname(new URL(import.meta.url).pathname), '.rehearsal');
const PACE = process.env.REHEARSE_QS || '';   /* e.g. '&wps=2.4&breath=1200' */
fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.message)));
await page.route('**/api/ask', r => r.abort());
await page.goto(BASE + '/next/index.html?voicerehearse=1' + PACE, { waitUntil: 'load' });
await page.waitForFunction(() => window.SAIKIMI && window.SAIVOICE && window.SAI && window.SAI.data && window.__SAIVOICE_TRANSPORT && window.__SAIVOICE_TRANSPORT.rehearsal, null, { timeout: 8000 });
await page.evaluate(() => {
  const a = window.SAIANALYTICS; window.__tracked = []; window.__t0 = performance.now(); window.__dt0 = Date.now();
  const stamp = (n, p) => window.__tracked.push([n, p || {}, Math.round(performance.now() - window.__t0)]);
  if (a && a.track) { const orig = a.track.bind(a); a.track = (n, p) => { stamp(n, p); return orig(n, p); }; }
  /* the words as they arrive, stamped: when was each member's name first said? */
  window.__said = [];
  const T = window.__SAIVOICE_TRANSPORT, origConnect = T.connect.bind(T);
  T.connect = async o => { const onEvent = o.onEvent; o.onEvent = ev => { if (ev && ev.type === 'response.output_audio_transcript.delta') window.__said.push([Math.round(performance.now() - window.__t0), ev.delta]); onEvent(ev); }; return origConnect(o); };
});
const pace = await page.evaluate(() => window.__SAIVOICE_TRANSPORT.pace);
console.log('\n▶ rehearsal at ' + pace.wps + ' words/s (' + pace.wordMs + ' ms a word, ' + pace.breath + ' ms breath before a member, ' + pace.stop + ' ms at a full stop)');

const card = () => page.$('#agentForm');
const frames = [];
const frame = async label => { const el = await card(); const f = path.join(OUT, 'f' + String(frames.length).padStart(2, '0') + '.png'); await el.screenshot({ path: f }); frames.push({ f, label, t: await page.evaluate(() => Math.round(performance.now() - window.__t0)) }); };

/* 1 · Chat with me → the greeting arrives at pace, the pills under it */
await page.click('#voiceStart');
await page.waitForFunction(() => window.SAIVOICE.phase() === 'live', null, { timeout: 8000 });
ok(await page.$eval('#voiceStart', b => /Chat is live/.test(b.textContent)), 'live without a secret (rehearsal mint)');
const tGreetStart = await page.evaluate(() => Math.round(performance.now() - window.__t0));
await page.waitForSelector('#agentThread .turnb__chips--starters .tag--hero', { timeout: 30000 });
const tGreet = await page.evaluate(() => Math.round(performance.now() - window.__t0));
const greetWords = await page.$eval('#agentThread .turnb--ai .turnb__text', e => e.textContent.trim().split(/\s+/).length);
console.log('  ·    greeting: ' + greetWords + ' words in ' + ((tGreet - tGreetStart) / 1000).toFixed(1) + ' s, then the pills');
ok(!(await page.$('.vstage')), 'no pictures during the greeting');
await frame('greeting + pills');

/* 2 · the hero pill → the story; a frame every second until the stage is gone */
const V = await page.evaluate(() => window.SAI.data.kimi.copy.voice);
await page.click('#agentThread .turnb__chips--starters .tag--hero');
const tTap = await page.evaluate(() => Math.round(performance.now() - window.__t0));
await page.waitForSelector('.vstage.is-open', { timeout: 3000 });
let last = '';
const spots = [];
for (let i = 0; i < 120; i++) {
  const s = await page.evaluate(() => {
    const st = document.querySelector('.vstage'); if (!st) return null;
    const cur = st.querySelector('.vstage__tile.is-current'); const cap = st.querySelector('.vstage__caption');
    const lit = st.querySelector('.vstage__badge.is-speaking');
    return { cls: st.className.replace('vstage ', ''), current: cur ? cur.dataset.product : null,
      badges: st.querySelectorAll('.vstage__badge.is-in').length, caption: cap ? cap.textContent.slice(-48) : '',
      lit: lit ? lit.dataset.product : null, glow: lit ? getComputedStyle(lit.querySelector('.vstage__emblem'), '::after').opacity : null,
      dim: [...st.querySelectorAll('.vstage__badge.is-in')].filter(b => parseFloat(getComputedStyle(b).opacity) < .6).length };
  });
  if (!s) break;
  spots.push(s);
  const label = (s.cls.includes('is-team') ? 'TEAM' : s.current || (s.cls.includes('is-hero') ? 'NewVoices' : 'burst')) + ' · ' + s.badges + ' on roster';
  await frame(label);
  if (label !== last) { console.log('  ·    ' + ((frames[frames.length - 1].t - tTap) / 1000).toFixed(1).padStart(5) + ' s  ' + label + (s.caption ? '   "…' + s.caption + '"' : '')); last = label; }
  await page.waitForTimeout(1000);
}
const tEnd = await page.evaluate(() => Math.round(performance.now() - window.__t0));
await frame('after the story');

/* 3 · the timeline: when each name was said vs when its card landed */
const said = await page.evaluate(() => window.__said);
/* WHEN THE VOICE SAID IT, not when the text arrived. The transcript comes in a
   burst — that is the whole point — so measuring a reveal against the text
   would pass no matter how far ahead the pictures ran. The harness publishes
   the audio schedule; this is the only honest ruler. */
const voiced = await page.evaluate(() => (window.__voiced || []).map(([t, w]) => [Math.round(t - window.__dt0), w]));
const reveals = (await page.evaluate(() => window.__tracked.filter(t => t[0] === 'voice_showcase_reveal'))).map(t => ({ id: t[1].id, via: t[1].via, at: t[2] }));
const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const products = V.showcase.products.map(p => ({ id: p.id, name: (window_name => window_name)(p.line.split(' — ')[0]) }));
let acc = '', firstSaid = {};
for (const [t, w] of voiced) { acc += ' ' + w; for (const p of products) if (!firstSaid[p.id] && squash(acc).includes(squash(p.name))) firstSaid[p.id] = t; }
let textAcc = '', firstTyped = {};
for (const [t, d] of said) { textAcc += d; for (const p of products) if (!firstTyped[p.id] && squash(textAcc).includes(squash(p.name))) firstTyped[p.id] = t; }
console.log('\n  member                  typed at   voiced at   landed at      lag');
let prev = 0, inOrder = true, spaced = true, tight = true;
products.forEach((p, i) => {
  const r = reveals.find(x => x.id === p.id); const named = firstSaid[p.id];
  const lag = r && named != null ? r.at - named : null;
  if (r && r.at < prev) inOrder = false;
  if (r && prev && r.at - prev < 2000) spaced = false;
  /* LATE IS FINE, EARLY IS THE BUG: a picture that lands a beat after its name
     reads as the screen keeping up; one that lands before it is the thing the
     client saw. So the window is tight on the early side and forgiving on the
     late one. */
  if (lag == null || lag < -400 || lag > 2200) tight = false;
  console.log('  ' + p.name.padEnd(22) + (firstTyped[p.id] != null ? ((firstTyped[p.id] - tTap) / 1000).toFixed(1).padStart(7) + ' s' : '      —  ') + (named != null ? ((named - tTap) / 1000).toFixed(1).padStart(8) + ' s' : '       —  ') + (r ? ((r.at - tTap) / 1000).toFixed(1).padStart(9) + ' s' : '        —  ') + (lag != null ? String(lag).padStart(7) + ' ms' : '       —') + (r ? '  (' + r.via + ')' : ''));
  if (r) prev = r.at;
});
const total = (tEnd - tTap) / 1000;
ok(reveals.length === products.length, 'every member landed (' + reveals.length + '/' + products.length + ')');
ok(reveals.every(r => r.via === 'voice'), 'each one on the voice, none by the clock');
ok(tight, 'each card lands ON the voice saying its name — never before it, never more than a beat after');
/* …and it is the VOICE they follow, not the text. Only worth asserting when
   the text really did arrive in a burst — with &textwps low the harness puts
   the two in step on purpose, and then there is nothing to tell apart. */
const burst = products.every(p => firstTyped[p.id] != null && firstSaid[p.id] != null) &&
  (firstSaid[products[0].id] - firstTyped[products[0].id]) > 5000;
if (burst) {
  const early = products.filter(p => reveals.find(x => x.id === p.id) && (reveals.find(x => x.id === p.id).at - firstTyped[p.id]) < 2000);
  ok(early.length === 0, 'and none of them followed the TEXT, which arrived in a burst ' +
    Math.round((firstSaid[products[0].id] - firstTyped[products[0].id]) / 1000) + ' s ahead of the voice' +
    (early.length ? ': ' + early.map(p => p.name).join(', ') : ''));
} else {
  console.log('  ·    the transcript was in step with the voice this run — nothing to tell apart');
}
ok(inOrder && spaced, 'in speaking order, at least 2 s apart');
ok(frames.some(f => /TEAM/.test(f.label)), 'the team assembles at the pivot');
ok(total >= 35 && total <= 75, 'the story runs ' + total.toFixed(1) + ' s (35–75)');

/* 3b · THE SPOTLIGHT — "each of the names and descriptions is mentioned, it
   should time with highlighting that company" (client, 2026-09-16). At every
   sample where a product's tile is on the deck, the LIT badge has to be that
   same product, its halo has to be painted, and the rest have to be dimmed. */
const deck = spots.filter(s => s.current && !s.cls.includes('is-team'));
const mismatched = deck.filter(s => s.lit && s.lit !== s.current && s.lit !== 'more');
ok(deck.length >= products.length, 'the deck was sampled through the story (' + deck.length + ' frames)');
ok(mismatched.length === 0, 'the lit badge is always the company on the deck' +
  (mismatched.length ? ': ' + mismatched.map(s => s.lit + '≠' + s.current).join(', ') : ''));
ok(deck.filter(s => s.lit).length >= products.length, 'something is lit while each one is described (' + deck.filter(s => s.lit).length + ' frames)');
ok(deck.filter(s => s.lit).every(s => s.glow === null || parseFloat(s.glow) > .5), 'and its halo is painted behind the icon');
const many = deck.filter(s => s.badges > 1);
ok(many.length === 0 || many.every(s => s.dim >= 1), 'the rest of the roster steps back while one is named');
/* it ENDS on IMAI: nothing after it is ever named aloud */
ok(products[products.length - 1].id === 'imai', 'the last one named is IMAI');
ok(!spots.some(s => s.current === 'geopulse' || s.current === 'agent_cloud'), 'GEOPulse and Agent Cloud are never put on the deck');
/* and it puts them down on the question it opened with */
const landed = await page.evaluate(() => ({
  pills: [...document.querySelectorAll('#agentThread .turnb--team .turnb__chips .tag')].map(t => t.textContent.trim()),
  card: !!document.querySelector('#agentThread .turnb--team'),
  gone: !document.querySelector('.vstage')
}));
ok(landed.gone && landed.card, 'the stage lifts and the team stays in the thread');
ok(landed.pills.length === ((await page.evaluate(() => window.SAI.data.goals.goals.length))), 'the starting points are offered again, under the card: ' + landed.pills.length + ' pills');
ok(errors.length === 0, errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');

/* 4 · the contact sheet — one picture of the whole thing */
const sheet = await ctx.newPage();
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');   /* a blank page cannot load file:// */
const cells = frames.filter((f, i) => i === 0 || i === frames.length - 1 || i % 2 === 1).map(f => '<figure><img src="' + b64(f.f) + '"><figcaption>' + ((f.t - tTap) / 1000).toFixed(0) + ' s · ' + f.label.replace(/</g, '&lt;') + '</figcaption></figure>').join('');
await sheet.setContent('<style>body{margin:0;background:#111;font:12px system-ui;color:#ddd}h1{margin:14px 16px 6px;font-size:15px;font-weight:600}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 16px 16px}figure{margin:0}img{width:100%;display:block;border-radius:6px}figcaption{padding:4px 2px;color:#bbb}</style><h1>Rehearsal · ' + pace.wps + ' words/s · story ' + total.toFixed(1) + ' s · ' + reveals.length + '/' + products.length + ' landed on their words</h1><div class="g">' + cells + '</div>');
await sheet.setViewportSize({ width: 1400, height: 400 });
await sheet.screenshot({ path: path.join(OUT, 'contact-sheet.png'), fullPage: true });
console.log('\n  frames: ' + frames.length + ' → ' + OUT + '/contact-sheet.png');
await browser.close();
console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall green');
process.exit(failures ? 1 : 0);
