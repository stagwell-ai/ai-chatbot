# Stagwell AI — what changed

**Branch** `claude/conversation-logic-flow-yy5clg` · **Baseline** `d424a5a` on `main`
**Live** https://stagwell-ai-julian.vercel.app · Version B at `/b.html` · Changelog at `/upgrades.html`

Seventeen commits. 21 files, +4,208 / −286 lines of code. One serverless function, eight new assets.
Sections 1–17 cover the first wave (the conversation rebuild); **section 18 covers the second wave**
— the live-model surfaces and the five features built in parallel after it.

---

## 1. The change in one line

The original asked four or five fixed questions and assumed you owned the brand
you typed. It now asks **whose site it is** and branches from there, and the
single most important claim in the demo — that a model does not know your brand
— is **no longer scripted**.

---

## 2. Before and after

| | Original | Now |
| --- | --- | --- |
| Questions asked | 4–5, fixed order | **5–7**, path-dependent, plus a one-tap confirmation |
| Conditional beats | 1 (`competitors`) | **3** (`viewerSite`, `role`, `followup` variants) |
| Report modes | 1 — you own the brand | **4** — owner, duel, recon, category |
| Focus options | 4, pick one | **6 lenses, pick up to two** |
| Distinct report configurations | 4 | **144** |
| Contact captured | First name | **Email (gated), first name derived from it** |
| Correcting an answer | Impossible | **Editable read-back on every row** |
| Known brand profiles | 10 | **21** |
| Real network calls | 0 | **2** — brand favicons, and a live model |
| Link preview / icons | SVG favicon only | **OG + Twitter cards, 4 icon sizes** |

---

## 3. The conversation

### Original — 5 beats

```
website → focus → who → role → [competitors, if focus = Competitive positioning]
```

One branch. Every visitor was addressed in second person as the brand's owner.

### Now — 8 beats, 5–7 asked

| # | Beat | Runs when | Cost |
| --- | --- | --- | --- |
| 0 | `website` | always | type |
| 1 | `relationship` | always | 1 tap — **the master fork** |
| 2 | `viewerSite` | competitor path only | type or skip |
| 3 | `focus` | always | 1–2 taps of six |
| 4 | `followup` | always — **six different questions** | 1 tap or short type |
| 5 | `role` | owner and duel only | 1 tap |
| 6 | `email` | always | type — **gated** |
| 7 | `confirm` | always | editable read-back, then build |

Path lengths: **category 5 questions · owner 6 · recon 6 · duel 7.** Four of them
are single taps on every path.

The design rule throughout: **branches change which questions you get, never how
many.** A longer flow would have cost more in drop-off than it bought in
personalisation.

---

## 4. Four report modes (new)

The original had one implicit mode. The report's *subject* and its *reader* were
the same entity, so everything was written in second person. Splitting them is
what makes the rest of the variety possible.

| Mode | Reached by | Subject | Voice |
| --- | --- | --- | --- |
| **owner** | "That's us" | the site they typed | you / your |
| **duel** | "They're a competitor" → gives their own site | **flips to them**, rival becomes benchmark #1 | you / your |
| **recon** | "They're a competitor" → skips | the rival | they / their |
| **category** | "Neither — I'm looking at the category" | the site, read at category level | they / their |

The **duel** flip is the notable one. Type `nike.com`, say it's a competitor, give
`adidas.com`, and the report becomes *Adidas vs Nike* — addressed to you, about
your own position, with Nike as rival number one. It is the most useful report the
system produces and the highest-intent path in the funnel.

Mode drives pronouns everywhere. Before this, the report said *"your brand equity"*
about a company the reader had explicitly said wasn't theirs.

---

## 5. Six lenses replace four focuses

| Original | Now | Engine |
| --- | --- | --- |
| AI opportunities | **How AI describes us** | GEOPulse |
| Competitive positioning | **How we stack up against rivals** | NewIntel |
| Brand perception | **What people believe about us** | BERA |
| — | **What we've been doing lately** | NewIntel |
| Growth opportunities | **Where the growth is** | SATS |
| — | **Where we're exposed** | Future of News |

Pick up to two. Labels rewrite per mode — *"describes us"* / *"describes them"* /
*"describes this category"* — so all six read correctly on all four paths.

Whichever lens leads:
- hoists its section to sit directly under the executive summary (version A)
- opens that tab first instead of Overview (version B)
- reorders the ranked opportunities
- **picks the follow-up question**

Free text still works. An unmatched answer is matched on intent, and the visitor's
own words are quoted verbatim in the executive summary — carried over from the
original, and still the only place their language survives into the output.

---

## 6. The follow-up beat (new)

One beat, six mutually exclusive questions. Maximum apparent bespokeness for zero
added length.

| Lens | Question | What it changes |
| --- | --- | --- |
| How AI describes us | *What should someone be able to ask a model and get you as the answer?* | **runs it against a real model** |
| How we stack up | *Anyone else you measure by?* | the benchmark set |
| What people believe | *Is there a belief you're trying to change?* | quoted into the summary |
| What we've been doing | *How far back — 30 days, 90 days, the year?* | the window on every figure |
| Where the growth is | *New audience, new market, or more from the ones you have?* | opportunity ranking |
| Where we're exposed | *Anything specific worrying you?* | quoted into the summary |

---

## 7. The read-back (new)

Every path now ends on a card listing everything the visitor steered, with a
`change` link on each row. Three jobs:

- **the correction point** — cheaper than a wrong report
- **proof they steered something** — what makes it feel chosen rather than filled in
- **the only way back** — the thread is append-only, so this is the practical
  substitute for a back button

Editing `focus` correctly re-asks the follow-up behind it, since a new lens
invalidates the old answer.

---

## 8. Email gate (new)

The original captured a first name and nothing else. Now:

- Email is required — no address, no brief. The one place the machine refuses to move on.
- **First name is derived from the address**, then confirmed in the acknowledgement.
  `julian.caras@nike.com` → "Julian". One beat instead of two.
- Placeholder prefills the domain they typed: `you@nike.com`.
- A single-letter local part is treated as an initial, not a name.

**Nothing is sent.** There is no mail backend. The address is captured, echoed,
and shown in the brief masthead.

---

## 9. Reading theatre (new)

The original showed thinking dots, then a complete inference card. The claim
*"42 pages read, inferred in 1.4s"* sat above nothing that earned it.

Now the read is performed:

1. A crawl streams paths with status codes and latencies — industry-specific and
   seeded, so a company reads the same way twice
2. Page and entity counters climb as it goes
3. The crawl collapses into a one-line receipt
4. Inference rows land one at a time
5. Competitor list arrives last, with logos

A click or Enter hurries it, exactly like the typewriter.

The five loader lines were generic (*"Reading your website"*). They now name names:

> Reading nike.com · 47 pages → Understanding Nike — consumer & retail →
> Watching Adidas — 4 moves this week → Testing "best running shoes for flat
> feet" across eight models → Writing for Julian — board altitude

---

## 10. Real brand marks (new)

Live favicons for the subject, every competitor, the peer list, ranking rows, the
brief masthead and the comparison table.

This is the cheapest realism win available: *the actual logo of the actual company
they typed*. It is the only thing on screen that proves the page reached the real
internet.

Each mark sits over a monogram tile and removes the image if it fails to load, or
if the service returns its generic 16px globe. An unknown brand shows a letter —
never a broken box. 21 brands resolve from a name map; anything else falls back to
a domain guess, then the monogram.

---

## 11. A real LLM (new) — the headline change

**Everything in the original was scripted. There was no model, no network call, no
API key.** The "eight language models" were an array of strings; their scores were
a hash of the domain.

That is still true of the report's figures. It is **no longer true of the tested
prompt.**

`/api/ask` is a Vercel serverless function. The visitor's own question goes to a
live model; the answer comes back verbatim with the brands it actually named
highlighted.

```
POST /api/ask  { prompt, brands[] }
  → { ok, answer, named[], model, ms }
```

Working on production right now:

> **"best running shoes for flat feet"**
> *"Brooks Adrenaline GTS 23, ASICS Gel-Kayano 30, and Hoka Arahi 6 are the best
> stability running shoes for flat feet…"*
> **Nike: not named. Adidas: not named.**

A real model, asked a real buying question, does not mention Nike at all. That is
the entire pitch in one screen, and it is verifiable in the room.

### Configuration

| Variable | Value |
| --- | --- |
| `LLM_BASE_URL` | `https://api.kimi.com/coding/v1` |
| `LLM_MODEL` | `kimi-for-coding-highspeed` |
| `LLM_API_KEY` | stored encrypted in Vercel, all three environments |

Latency 2.5–3.0s end to end. `k3` gave better prose but took 11.7s — too slow to
hold a room.

Two gateway quirks worth recording:
- It **rejects any `temperature` but `1`**.
- It is a **reasoning model** emitting 200–400 `reasoning_content` tokens before
  the answer. A small `max_tokens` returns an **empty string, not an error**.
  Budget is 900.

### Honesty boundary

The live answer renders in its own panel marked *"not simulated"* with real
latency. The eight-model chart stays separate and labelled as modelled.

**They are different claims** — the live one names *brands*, the chart names
*models*. Merging them would misrepresent both.

Any failure — missing key, timeout past 12s, bad response — returns `null` and the
scripted figures take over silently. The demo cannot hang or show an error.

---

## 12. Share kit and icons (new)

- **Open Graph + Twitter cards** on both pages: a rendered 1200×630 card, canonical
  URLs, `theme-color`
- **Icons**: 32px tab favicon on a navy tile, 192px Android, full-bleed 180px
  apple-touch (iOS masks corners itself; a pre-rounded tile leaves white slivers),
  alongside the original SVG

Both images render from committed HTML sources in `assets/share/`, so the kit is
regenerable with a headless screenshot rather than a design tool.

---

## 13. Defects found and fixed

**Pre-existing in the original — four:**

| Defect | Consequence |
| --- | --- |
| Options render during the previous beat's reply, while `busy` is still true | An eager tap was **silently dropped**. Answers now queue. |
| Context meter divided by total beats, but beat 1 added two cards | The competitive path reported **120% captured** |
| `SIGNALS` rule 1 held `studio` | Media & Entertainment could **never** claim a film studio |
| 12 marquee peer brands had no profile | Fell through to the Technology default — the flagship **Nike-vs-Adidas duel called Adidas a software company** |
| Orphaned `deriveNumbers()` in `shared.js` | Referenced an out-of-scope `S`, never called. Removed. |

**Introduced during this work and fixed — three:**

| Defect | Consequence |
| --- | --- |
| Retired read-back card animated away but stayed in the DOM | Kept answering queries with stale rows |
| Single-letter email local part became a first name | *"Written for J, Founder or CEO"* |
| Signed `>>` on an unsigned 32-bit hash | Crawl displayed **negative latencies** (`-103ms`) |

---

## 14. Files changed

| File | Change |
| --- | --- |
| `shared.js` | +418. Modes, voices, six lenses, follow-ups, crawl data, brand-mark map, 11 new brand profiles, `askLive`, `statusLines`, `specRows` |
| `app.js` | +723 net. New 8-beat script, multi-select, read-back, live probe, reading theatre, subject-aware report, focus-driven section order |
| `b.js` | +506 net. Same, with dashboard tab ordering and the live panel |
| `styles.css` | +121. Multi-select, read-back, crawl feed, brand marks, live panel |
| `b.css` | +12. Narrow-panel overrides |
| `index.html`, `b.html` | +25 each. Share meta and icons |
| `api/ask.js` | **new**, 124 lines. The live model call |
| `assets/share/*` | **new**, 8 files. OG card, icons, and their sources |
| `README.md` | +52. Documents the flow and deep-link parameters |
| `.gitignore` | `.env*`, `.vercel`, `node_modules` |

---

## 15. What is still not real

Unchanged from the original, and worth being precise about:

- **Every figure** — brand equity, AI visibility, share of voice, creator counts,
  the eight-model chart, competitor scores, all opportunity lifts. Hashed from the
  domain.
- **The crawl.** No page is fetched. Paths are plausible fiction.
- **The site read.** Known brands have hand-written facts; unknown ones get their
  industry bucket's stock copy.
- **The email.** Captured, never sent.
- **The presenter video.** Animated and captioned, silent.
- **The follow-up box in version B.** Says "ask me anything else", does nothing.
- **Every CTA.** Opens a modal, submits nothing.

The **only** genuinely live things are the tested prompt and the brand favicons.

---

## 16. Operational notes

**Cost is now non-zero.** Every visitor who picks *How AI describes us* and types a
prompt spends tokens. There is **no rate limit and no per-IP cap.** Fine for
demos; needs a limit before any public link.

**Deploy is a CLI snapshot, not a git connection.** Pushing to the branch does not
redeploy. Connect the repo in the Vercel dashboard for auto-deploy.

**Two secrets need rotating.** The Vercel token and the Kimi key were both shared
in a chat transcript. The Kimi key is encrypted in Vercel env vars and is not in
the repo, but both should be reissued.

**Deep links** carry the full new state: `brief` / `dash`, `rel`, `vs`, `focus`
(one or two, comma-separated), `q`, `window`, `who`, `email`.

---

## 17. Open decisions

1. **Rate-limit `/api/ask`** before sharing the URL beyond the team.
2. **Real email delivery** — same serverless pattern, ~a day. Makes the gate pay off.
3. **Three story archetypes.** Every company still gets the same diagnosis: strong
   equity, weak AI visibility. Fine once; it collapses when someone runs two
   companies side by side.
4. **Post-report follow-up chips.** The highest-engagement moment is currently a
   dead end.
5. **A true two-column duel layout.** The duel mode reuses the single-subject
   layout with a "vs" headline.


---

## 18. The second wave — the demo goes live

Everything below section 17 was scripted theatre. The second wave attached a real model
(`/api/ask`, a Vercel function; key in env vars, never in the client) and grew five live
surfaces plus three interaction features. Every live element carries a receipt — model
name, latency, the word *unscripted* — and every live call falls back silently to the
scripted copy, unbadged, so the demo cannot hang or error in a room.

### 18.1 The live surfaces (real model calls)

| Surface | What happens | Where |
| --- | --- | --- |
| **Tested prompt** | The visitor's own buying question, asked verbatim; brands named/absent | conversation + brief §GEOPulse |
| **What the models say** | 3 real questions fired during the loader; answers quoted verbatim, badged Live | brief + dashboard |
| **GEOPulse mini-audit** | 3 brand-blind buying prompts; "Named in N of 3" is counted, not hashed | brief + dashboard |
| **Executive summary** | Written by the model from session context; strict validator (length, brand, ≥1 figure) or the template runs unbadged | brief (version A) |
| **Ask the machine** | The finished brief answers follow-ups in character, with 3 safe chips | brief + version B chat |

A full build makes ~7 model calls, all racing one shared 5s grace window behind the loader
— per-promise races, so one slow call never drops the others. Deep links skip the loader
and keep scripted copy by design.

### 18.2 The interaction features

- **Projection slider** — "what closing the gap is worth"; exact deterministic formulas,
  flagged *Projection · modelled* in amber so it can never be mistaken for a measurement.
- **Board view** — the ten-section brief collapses to one screen (three numbers, three
  moves, one quote, the Mark Penn line); Escape exits, scroll survives the round trip.
- **Head-to-head arena** — duel mode gets a two-column layout with mirrored bars, winner
  markers and an honest verdict. Consistency rule: the rival's visibility is `A.lead`
  (subject + gap), the same derivation every other chart uses.

### 18.3 Presentation & plumbing

- Reading theatre (streamed crawl, counters, row-by-row inference) and per-session loader
  lines that name names.
- Real brand favicons everywhere a brand is named, monogram fallback, never a broken image.
- Share kit (OG/Twitter card, icon set), `V0 | A B` switcher linking the original build,
  `/upgrades.html` consumer changelog with a live demo widget and the Mark Penn run sheet.
- Section numbers now stamp in source order from a single `%N%` pass, so conditional
  sections (the duel) cannot duplicate or gap the numbering.

### 18.4 Gateway facts (hard-won, keep these)

- `https://api.kimi.com/coding/v1`, model `kimi-for-coding-highspeed`, ~2.5–3s per call.
- The gateway **rejects any temperature but 1**.
- It is a **reasoning model**: 200–400 hidden tokens before a short answer, **738–1,852
  measured** on the summary task. An exhausted budget returns an **empty string, not an
  error** — chat mode runs `max_tokens: 3200` for that reason.
- Chat-mode prompts are clipped at 600 chars server-side (300 for plain questions).

### 18.5 Second-wave defects found and fixed (9–12)

9. Signed `>>` on the unsigned crawl hash — rows displayed negative latencies.
10. The 300-char prompt clip guillotined the summary instruction mid-sentence.
11. The reasoning-token tail intermittently exhausted `max_tokens` → empty summaries
    that passed every stub test and failed only in production.
12. The global count-up sweep raced the projection slider and snapped dragged values back.

### 18.6 Still true

Every score, KPI, competitor row, opportunity lift and the crawl remain **illustrative** —
hashed from the domain. The email is captured, never sent. The endpoint has **no rate
limit** yet. The five receipted surfaces above are the only measured things on the page.
