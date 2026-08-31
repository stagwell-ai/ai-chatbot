# `tests/` — the Stagwell.AI demo kit's acceptance suite

Everything `reference/kit/SPEC.md` lists under **Acceptance**, run as a browser
against the real pages and the real `/api/ask`, in one command:

```sh
./tests/run-all.sh
```

Green means the demo is safe to put in front of a room.

---

## What it checks

`SPEC.md` § Acceptance has five lines. Four of them are testable, and each one
has a file:

| SPEC acceptance line | File | Cases |
|---|---|---|
| All five demo-script paths work end to end | `journeys.js` | J1–J5 |
| Copy/logic changes require only edits to `data/*.json` | `json-contract.js` | C1–C3 |
| Every visitor-facing diagnostic string is free of product names | `diagnostics-name-free.js` | D1–D3 |
| Snapshot data is clearly fictional, never real-company claims | `diagnostics-name-free.js` | the `Illustrative` assertions in D1/D2 |
| Responsive enough for a laptop demo | *not covered here* — a separate visual/responsive pass owns it |

`harness.js` is the plumbing all three share. It is not a test.

### `journeys.js` — the five demo scripts

The five scripts from `reference/kit/KIT-BRIEF.md` ("Demo script to satisfy"),
each run in a **fresh browser context**, each asserting two things: what the
visitor **sees**, and what the demo claims it **sent to HubSpot**
(`window.SAI.events.list()`, SPEC S6). Any uncaught `pageerror` fails the
journey outright.

- **J1 · master ad → consultative.** Lands on `/` and opens with one message
  carrying two problems *and* a website — `"Reach better audiences — and prove
  it moved the business, we're at nike.com"`. Asserts q1 and **q2 are skipped**
  (`website_in_first_message`, SPEC non-negotiable #1), that q4 arrives as the
  one-tap **confirm** when live research is confident, the snapshot at
  `/snapshot` with the PDF visibly locked, `demo@nike.com` + consent, the
  capture events (`capture_email` carrying **only** the email domain,
  `capture_consent`, `journey_converted`), then `/path` with **two capability
  cards**, the consultative column marked RECOMMENDED, `route_decided` via
  override 1, every handoff link fully attributed, and a real `handoff_click`.
- **J2 · product ad → demo.** `/p/targeting-machine` → the product chip →
  handoff to `/?utm_campaign=…&autostart=1&q=…` → the campaign **opener is
  replayed** into the thread rather than re-asked → `nike.com` → Director/VP →
  size → This quarter → snapshot → capture → path. Asserts the campaign's
  "one less question" claim precisely: **q1 skipped** (`product_ad_prefill`)
  and **q6 skipped** (`answered_in_campaign_opener`), the exact
  `question_asked` trail, and the **demo** column recommended at tier
  `enterprise` with no override — the matrix decided.
- **J3 · SMB self-serve.** `/` → chip *I want to run a quick survey* → an
  unknown domain (`smallco-fictional-demo.example`) so research must fall back
  honestly (asserted: `confidence: low`, `live: false`, q4 in **ask** mode) →
  Founder/owner → Under 50 → This quarter → snapshot → **declines** email
  (modules stay, PDF stays locked, `capture_declined` with no
  `capture_email`) → path via the declined link → the **dominant self-serve
  hero**, one gold CTA, the trial link pointing at `harrisquest.com/suite/questdiy`
  with `sai_route=self_serve`, and every other path collapsed to a text link.
- **J4 · just exploring → follow_up.** Asserts the nurture state and, most of
  all, the **absence of a meeting push**: no gold button anywhere on the path
  screen, no scheduler embed, and *"Book a working session"* present **only**
  as a `.pathcollapse__link`, never as a primary. `route_decided` payload is
  `follow_up` via override 2.
- **J5 · anonymous.** J1's visitor through the snapshot, then declines.
  Asserts the three modules are still visible **and unchanged**, the PDF is
  still locked, `capture_declined` fires exactly once, and **no**
  `capture_email` / `capture_consent` / `journey_converted` — while the session
  is still logged, which is the difference between anonymous and silent.

### `diagnostics-name-free.js` — capabilities, not tool names

Drives a journey to the snapshot, then walks the **rendered DOM** of
`#snapView`'s three module cards — every text node, headings, bar labels,
engine rows and findings — against the fifteen-name portfolio blocklist
(QuestBrand, QuestDIY, BERA, Unlock, UNICEPTA, IMAI, GEOPulse, Targeting
Machine, SATS, Numetrix, Knowledge Machine, Pulse, DoReel, NewVoices, Agent
Cloud), matched as whole words, case-insensitively. It also asserts
`Illustrative` on every module.

**The walk is scoped to `.snapmod` cards on purpose.** The capture band
legitimately says *"Unlocks when we send your report"*, and `Unlock` is also a
product — the band sits outside the module cards, so the honest copy is never
mistaken for the product, and `unlock` **inside** a module would be a genuine
violation. D1 keeps that boundary honest with two control assertions.

Three passes: the real-research journey (nike.com — rival names arrive from the
model, so a live answer cannot smuggle a name in), the seeded/offline path, and
the conversation build rail.

### `json-contract.js` — the copy-and-logic-live-in-data proof

Each case intercepts **one exact data path** and serves a modified copy of the
real file from memory. **Not one byte of the repo is edited** — that is the
proof, and the suite re-verifies it: every case asserts `data/*.json` is still
byte-identical on disk.

- **C1** — `/data/questions.json` with q3's copy changed to *"And what seat do
  you hold there?"*. The conversation must ask the new sentence verbatim, the
  shipped one must be nowhere on screen, the chips must be unaffected, and the
  `question_asked` event must carry the new copy too.
- **C2** — `/data/routing.json` with the `research` domain's label renamed. The
  path screen quotes domain labels back at the visitor in its *"Why matched:"*
  lines and its sub-header; both must move, and the routing decision must not.
- **C3** — `/data/routing.json` with one **matrix cell** flipped
  (`research.cells.smb`: `self_serve` → `demo`). This is logic, not copy: the
  same visitor must land on a different route, the dominant self-serve hero
  must be gone and the three-column row back. It also proves the skip rules
  read the same data — with the three tier cells no longer agreeing, the
  adaptive q6 comes back on its own, because it now has a tie to break.

---

## Running it

### Prerequisite: a bridge

The suite needs one HTTP server that:

1. **serves the repo root statically** — `/machine/*.js`, `/machine/*.css`,
   `/data/*.json`, `/machine/assets/*` are all requested by absolute path; and
2. **answers `POST /api/ask`.** Proxy it to the deployed function
   (`https://stagwell-ai-prototypes.vercel.app/api/ask`) and research runs
   **live**; leave it failing and research falls back to seeded fiction. **The
   suite passes either way** — see *Live research* below.

It does **not** need Vercel's rewrites. The suite emulates them itself (below).

Any static server on the repo root will do. Check it with:

```sh
curl -sfo /dev/null http://localhost:8199/machine/b.html && echo ok
```

### Then

```sh
./tests/run-all.sh                               # everything, on :8199
BRIDGE_URL=http://localhost:8299 ./tests/run-all.sh
./tests/run-all.sh journeys                      # one file
./tests/run-all.sh diagnostics
./tests/run-all.sh contract

node tests/journeys.js                           # or straight to node
```

`run-all.sh` checks the bridge before it starts and tells you whether
`/api/ask` is answering live, so the run's conditions are on the transcript.

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `BRIDGE_URL` | `http://localhost:8199` | where the repo is being served |
| `PLAYWRIGHT_PATH` | *(auto)* | explicit path to a Playwright install |
| `NODE_BIN` | `node` | node binary `run-all.sh` uses |
| `RETRIES` | `1` | automatic retries per journey (`0` disables) |
| `HEADED` | *(unset)* | `1` runs the browser headed |

Playwright is **not** a dependency of this repo. `harness.js` resolves it from
the ordinary `require` path first, then the usual global-install locations
(`/opt/node22/lib/node_modules/playwright`, `/usr/lib/node_modules/…`,
`/usr/local/lib/node_modules/…`). If yours is elsewhere, set
`PLAYWRIGHT_PATH`. Chromium is launched with `--no-sandbox`.

### Expected output

A line per assertion, a verdict per case, and a block per file:

```
[J1] master ad · website + two problems in one message → consultative
  ok   q2 SKIPPED — website in the first message — "website_in_first_message"
  ok   q4 became a ONE-TAP CONFIRM (live research was confident) — Looks like Nike is around 83,700 people…
  ...
  PASS J1

------------------------------------------------------------------------
VERDICT — ACCEPTANCE · the five KIT-BRIEF demo scripts
  PASS  J1  master ad · website + two problems in one message → consultative
  ...
  5/5 green
```

Eleven cases in total: **J1–J5 + D1–D3 + C1–C3**. `run-all.sh` exits `0` only
if all three files pass. Screenshots of every milestone — and of the failing
step when something breaks — land in `tests/artifacts/`, which is gitignored
(`tests/.gitignore`).

---

## How the suite talks to the demo

### The two rewrites, emulated

Production routes `/` → `machine/b.html` and `/p/:campaign` →
`machine/campaign.html` through `vercel.json`. A plain static bridge has no
rewrite layer, so every browser context fulfils those two paths itself, from
the files on disk, matched by **exact pathname** — never a glob, so
`/machine/b.js` and `/data/questions.json` fall through to the bridge
untouched. That is what keeps `/api/ask` real.

### Chips are buttons — never `text=`

Every chip label is a **substring of its own question's copy**: *"This
quarter"* lives inside *"…this quarter, this year, or just exploring?"*. A bare
`text=` selector is both case-insensitive and substring-matching, so it matches
the question paragraph and clicks nothing. Every chip in this suite is selected
as `button.opt:text-is("…")`, scoped to the chip group that is still live —
`convo.js` fades a spent group out over ~460 ms before removing it, so two
groups can be in the DOM at once and only one of them is real
(`harness.LIVE_OPTS`). Landing chips are `#solveChips button:text-is("…")`,
product-page chips `#agentPanel .chip:text-is("…")`.

---

## Live research, and why nothing here is flaky about it

`/api/ask` is proxied to the deployed function, so research is genuinely live —
which makes exactly one thing non-deterministic: whether **q4** arrives as the
one-tap **confirm** (*"Looks like Nike is around 83,700 people, in Athletic
footwear and apparel — did I get that right?"*) or as the plain **ask**.

`flow.js` waits `researchWaitMs` (4 s) for research and then asks the plain
question. A live round trip against `nike.com` measured **1.4–4.2 s** in
development, so it lands on either side of that line run to run. Both are
correct: the SPEC's confirm mode is the better moment, and the ask is the
honest fallback the KIT-BRIEF requires ("the demo must work offline").

So every journey **reads the mode at runtime** (`harness.answerSize`) and
answers whichever face is on screen with a chip that lands on the same tier —
`That's right` in confirm mode, `2,500+` in ask mode, both enterprise for Nike.
The route assertions are byte-identical either way. J1 asserts the confirm-mode
detail when confirm appears and **notes** the fallback when it doesn't, rather
than failing: that path is legitimate, not a bug.

Verified in both directions — the whole suite is green against a live
`/api/ask` **and** against a bridge whose `/api/ask` returns 500.

Where a journey needs research to be *unable* to confirm (J3, J4), it uses a
domain no model can know (`smallco-fictional-demo.example`,
`northwind-demo-brand.example`) and asserts ask mode **hard** — an unknown
domain that produced a confident confirmation would be the demo inventing a
fact, which is exactly what the SPEC forbids.

### Other flakiness guards

- **Fresh context per journey** — no cookie, `localStorage` event ring or
  history state leaks between cases.
- **Chip-group scoping** — see above; the spent group is skipped, so a stale
  `:text-is()` can never win a race.
- **State-based waits, never sleeps** — `waitQuestion()` polls
  `SAIFLOW.state().question.id`; the snapshot and path waits poll for the
  section to be un-hidden. The only fixed waits are ~60–150 ms paint settles
  after a state change is already true.
- **One automatic retry per case** (`RETRIES`, default 1). CSS and layout work
  can land in the repo while the suite runs; a journey that fails once and
  passes on the retry is reported as `[retried]` on its verdict line, so the
  flake is visible rather than hidden.
- **Both `#snapView` and q6 awaited together** in `json-contract.js`, because
  C3's edit legitimately changes how many questions are left.

---

## Question counts

`journeys.js` prints a **question budget** after the verdict:

```
J1 asked 3 standard questions: q3, q4, q5
J2 asked 4 standard questions: q2, q3, q4, q5 (+ the campaign opener)
```

KIT-BRIEF script 2 says the product-ad entry reaches the snapshot in *"fewer
questions"*. What that means precisely — and what J2 **asserts** — is that the
campaign entry retires **two** questions the master ladder would ask: q1
(`product_ad_prefill`, the ad's creative already asked it) and q6
(`answered_in_campaign_opener`, the opener fuses Q1 + adaptive Q6, which
`campaigns.json` calls "one less question"). Four standard questions instead of
six.

It is **not** asserted as "fewer than J1", and here is why: J1 as written opens
with a message that carries two problems *and* a website, so it skips q1, q2
**and** q6 and asks only three. One message answering three questions at once is
the master landing's own showcase (SPEC non-negotiable #1), so on this pairing
the master journey is the shorter one. The counts are printed for the record.

---

## Known limits

Things the suite deliberately records rather than fails on. It is green today,
and each of these is a place where it is green because it is not asserting
something a stricter reading of the SPEC would ask for. All three were found
while writing the suite and handed to the coordinator; none is fixed here.

0. **The landing's four suggestion chips are hardcoded in `machine/b.html`,
   not rendered from `data/questions.json` `q1.chips`.** SPEC S1 says
   "4 suggestion chips (from questions.json q1.chips)". Serving a modified
   `questions.json` with a renamed q1 chip leaves the rendered chips unchanged,
   so a client cannot retune the landing chips from the JSON. A knock-on: the
   markup writes *"my brand’s health"* with a curly apostrophe while the JSON
   uses a straight one, and `convo.js`'s `matchingChip()` normalises only
   `trim().toLowerCase()` — so that one chip misses its own JSON entry, takes
   the free-text branch instead of the chip branch, spends an `/api/ask` round
   trip, and never emits the `answer_given {source:'chip'}` row the other three
   produce. The domain still resolves, so no journey fails; the event trail is
   simply one line short. **Journeys use the three chips that match**; when
   `b.html` renders its chips from the JSON, add the rename to C1 and this note
   can go.

1. **Capability card titles on `/path` are not data-driven.** `path.js` keys
   them off a hardcoded `CAPABILITY_TITLES` map (by domain **id**), so renaming
   a domain's `label` in `routing.json` moves the *"Why matched:"* line and the
   sub-header but **not** the card heading. C2 notes the heading it got. This
   is deliberate in `path.js` — the titles are capability language written to
   survive a label edit — but it is a real edge of the
   "copy changes live in the JSON" claim, and a client renaming a domain should
   know the card title needs a code change.
2. **Responsive/visual behaviour is out of scope here.** The suite runs one
   viewport (1440×950) and asserts structure, copy and events, not layout.
