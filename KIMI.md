# Kimi — the product-discovery conversation on stagwell.ai

Built 2026-09-10 against `stagwell_ai_kimmy_architecture_roadmap.md` (the brief), on the
decisions taken that day: keep the vanilla-JS stack; the project and primary model are
**Kimi** (the on-page persona stays "Stagwell AI"); OpenAI is the fallback model; HubSpot is
**mocked** until a token exists; the recommendation shows **after** contact capture; every
active product is reachable from the six pills.

This file is the brief's §64 deliverable list, in its order.

---

## 1. Architecture

Static pages under `next/`, two Vercel functions under `api/`, all copy and logic in
`data/*.json`. No framework, no build step, **no runtime dependencies** (the root
`package.json` exists for the Node engine line and the test commands).

```
visitor words ─► /api/ask mode:'interpret' ─► LLM broker (Kimi → OpenAI → Anthropic → none)
                 │                              └► schema-validated { goals, intents, inferred }
                 └► keyword reader (recommend.js) when no model answers
                                 │
                      INTENT SIGNALS (taxonomy.json ids + bands)
                                 │
                 recommend.js — deterministic scorer (scoring.json weights) ─► ranked products, confidence
                                 │
                 select-question.js — next discriminating question, or none
                                 │
                 kimi-flow.js — state machine: DISCOVERY → QUALIFICATION → READY_FOR_CONTACT
                               → CONTACT_CAPTURE → RECOMMENDATION → COMPLETE
                                 │
                 hero-agent.js renders: question + pills · contact form · recommendation cards (cards.js)
                                 │
                 /api/lead ─► revalidate + RECOMPUTE recommendation ─► leadService ─► HubSpot (mock|live) + webhook
```

Rule set honoured (brief §62): UI owns no rules · the model owns no rules and never names a
product · catalog is canonical · routing deterministic · every model call through one broker
with one schema · models configurable by env · provider failure invisible · funnel works with
no model · contact before outbound links · cards consume view models · HubSpot server-only ·
analytics without PII · every routing decision unit-tested.

## 2. Files added / changed

| Area | File | What |
|---|---|---|
| Data | `data/goals.json` **new** | six goals → routing domain, aligned intents, candidate products, first question |
| | `data/taxonomy.json` **new** | 28 intent ids with visitor-language `need` + keyword lists; company-size / creator-volume / geography bands |
| | `data/scoring.json` **new** | weights, confidence thresholds, conversation limits |
| | `data/kimi.json` **new** | feature flags + every visitor-facing string |
| | `data/solutions.json` | + `active`, `cardDescription`, `capabilityTags`, `intentTags{primary,secondary}`, `audiences`, `excludesIntents`, `conversion`, `urls`, `visual` on all 18 entries (Unlock `active:false`) |
| | `data/questions.json` | + `discovery` bank: 15 discriminating questions |
| Client | `next/recommend.js` **new** | pure scorer + keyword reader + band parser (browser and node) |
| | `next/select-question.js` **new** | pure question selector |
| | `next/kimi-flow.js` **new** | the conversation state machine |
| | `next/cards.js` **new** | ProductCardViewModel builder + renderer |
| | `next/analytics.js` **new** | `SAIANALYTICS.track()` |
| | `next/hero-agent.js` | rewritten to render Kimi state (questions, form, cards) |
| | `next/index.html` | pills carry `data-goal`; five new scripts |
| | `next/home.css` | form + card styles |
| | `next/engine.js` | kimi_* names added to the event vocabulary |
| | `next/data-loader.js` | loads the four new JSON files |
| Server | `api/_lib/llm/providers.js` **new** | adapters: OpenAI-compatible (kimi, openai, xai) + Anthropic |
| | `api/_lib/llm/broker.js` **new** | chain, timeouts, one bounded retry, total deadline, telemetry |
| | `api/_lib/llm/schemas.js` **new** | interpretation / response / explanation validators |
| | `api/_lib/llm/json.js` **new** | loose JSON reader (moved from ask.js) |
| | `api/_lib/leads/schema.js` **new** | lead revalidation, normalisation, recompute, sales summary |
| | `api/_lib/leads/properties.js` **new** | HubSpot property definitions + mapping |
| | `api/_lib/leads/hubspot.js` **new** | CRM v3 upsert, mock mode |
| | `api/_lib/leads/leadService.js` **new** | destinations, undelivered-lead logging |
| | `api/_lib/ratelimit.js` **new** | per-instance token bucket |
| | `api/ask.js` | + `mode:'interpret'`, `mode:'explain'`, `GET ?health=1`; older modes untouched |
| | `api/lead.js` | rewritten on the lead service; old flat payload still accepted |
| Ops | `scripts/hubspot-setup.mjs` **new** | creates the property group + properties once |
| | `package.json`, `.env.example` **new** | engine, test commands; every variable documented |
| Tests | `tests/kimi/*.test.mjs`, `tests/kimi/no-llm.funnel.mjs` **new** | see §14 |

Untouched on purpose: `next/flow.js` and the `/next/agent` page still run the older six-question
flow; `machine/` (the root site) is unchanged.

## 3. Product catalog

17 active products, all in `data/solutions.json`. Marketing edits `cardDescription`,
`capabilityTags`, `conversion` labels and `urls` there; nothing in code names a product.
Intent tags decide routing (§4); a product with no primary tag can never be recommended.
Unlock is `active:false` (hidden everywhere).

## 4. Deterministic routing

`next/recommend.js`. For each active product: goal alignment (+2) · explicit intent chosen from
a pill on a primary tag (+8) · intent read from text on a primary tag (+5) · secondary tag (+2)
· company-size fit (+2) / mismatch (−4) · creator-volume fit (+4) / contradiction (−8) ·
geography fit (+1) / mismatch (−4) · `excludesIntents` (−5). Confidence HIGH = top ≥ 7 and
lead ≥ 4; MEDIUM = lead ≥ 2; else LOW. All numbers in `data/scoring.json`.

Goal → product coverage ("figure out a good way to map to everything"):

| Pill | Candidates |
|---|---|
| Increase brand awareness | QuestBrand · Search+ · The Media Machine · GEOPulse · IMAI · Stagwell AI for SMBs |
| Grow your audience | The Targeting Machine · Stagwell ID Graph · The Media Machine · IMAI · SMBs · NewVoices |
| Protect brand reputation | The Knowledge Machine · UNICEPTA · GEOPulse |
| Track your competition | NewIntel · QuestBrand · The Knowledge Machine · UNICEPTA · GEOPulse · BERA.ai |
| Measure brand impact | QuestBrand · BERA.ai · Numetrix · QuestDIY · The Media Machine |
| Scale business operations | NewVoices · Agent Cloud · Stagwell's Machines · Search+ |

A product outside a goal's list can still win on what the visitor says (intent points beat
the goal bonus).

**GEOPulse measures, Search+ influences.** Both live on AI search, so the taxonomy carries two
intents rather than one: `ai_search_visibility` (seeing how AI answers describe you today) leads
to GEOPulse, `ai_search_influence` (changing it) to Search+. Each holds the other as a secondary
tag, so a sentence carrying both keeps both in the running and the `ai_visibility_focus` question
settles it in one tap. Search+ keeps `brand_orchestration` as a second lead signal so the
paid/owned/earned path still reaches it — the client's new definition does not mention it, but
the ICP one-pager it replaces did and nobody has said the capability is gone.

**Eclipse.** An intent whose every matched term sits inside another intent's longer phrase is a
fragment, not a second need: "answer engine optimisation" is influence, and the measuring
intent's "answer engine" inside it is not a second signal. `next/recommend.js`, mirroring the
rule `engine.js` already carried for the older router.

## 4b. The conversational layer

The engine decides *what* is asked; the model shapes *how it reads* (brief §13.3). The single
`interpret` call also returns `ack` (one sentence reflecting a detected need, which leads into
the next question) and `reply` (when nothing was detected: a natural answer to a greeting, an
off-topic line or a question about Stagwell AI, written only from the approved `about` text in
`kimi.json` and the product names). A turn that teaches the engine nothing is a **hold**: the
agent replies, keeps the same question and the same pills, and never advances toward the form.
With no model, the hold lines in `kimi.json` (`hold`, `holdQuestion`) rotate instead. Pill
taps stay templated, so they answer instantly.

## 4b2. The order of the conversation

The client's order (2026-09-10), verbatim:

> 1) what do they want to solve 2) what's their website 3) here is some insights we have about
> your website (if any) 4) how large is your org 5) what's your role 6) here are some
> recommendations we have 7) give us your email 8) give us your phone number 9) book a call

Steps 1–5 are `questions.json`: the website (`first`, priority 100), company size (99) and role
(98) are asked in that order while their field is unknown; `select-question.js` then asks a
discriminating question **only when there is no intent to recommend from** — a bare goal pill —
and only once (`scoring.conversation.maxQuestions: 1`, `discriminateOnlyWithoutIntent`). A typed
need goes website → size → role → cards. Steps 6–9 are §9.

1. **the website** — `/api/ask mode:'research'` asks the model what it already knows about that
   domain. It is built to answer `known:false` rather than guess, so what comes back is real or
   nothing. What it returns is shown as a short fact list (industry, size band, comparison set)
   and, more usefully, **used**: the size band means the company-size question is never asked,
   the industry rides to the CRM. A domain it does not recognise gets one plain sentence and the
   conversation carries on. **There is no "I'd rather not say" chip** ("we really want to get their
   company"): an answer that is not an address is asked once more, for the address itself; a
   second non-address is accepted — kept as the company's name on the lead (`lead.company`) if it
   was a name, dropped if it was a decline — and the conversation moves on rather than trapping
   anyone. A failed lookup puts the flow in DETERMINISTIC mode like any other model failure.
2. **company size** — under 250 / 250–2,500 / 2,500+; skipped when the lookup already knows.
3. **their role** — founder / marketing manager / director-VP / C-suite, or typed in their own
   words and matched to one of those bands. It does not move the product recommendation; it
   qualifies the lead, and it is the vocabulary `routing.json`'s seniority override and
   `engine.js`'s ICP boosts already speak.

A website inside their own opening sentence answers question 1 before it is asked, and is read
straight away. Any question can be cut short by asking to be contacted (§4c).

**Nothing invented, ever.** `next/research.js`, which the older agent page uses, falls back to
seeded fiction so the demo always has a chart to draw. That is why this calls the endpoint
directly instead of reusing it, and why `tests/kimi/site.funnel.mjs` asserts that an
unrecognised domain puts no fact on the page.

## 4c. The fast track

"If the person just ever cuts the chase that they want to be contacted, or they want to book a
demo, or they want to try out something, we should just fast-track them to filling out the form"
(client, 2026-09-10). A **contact request** — `call`, `demo`, `trial`, `expert`, `pricing` — ends
the questions wherever it lands: on the first message, in place of an answer, or alongside a real
need. Read two ways, like everything else: the request-shaped phrases in `taxonomy.json`
(`contactRequests`, which work with no model) and the model's own `contactRequest` field.

The phrases are deliberately request-shaped, never bare nouns: "prove pricing power", "our
sign-up rates" and "we ran a demo last year" are ordinary marketing vocabulary and must never
open a form nobody asked for — covered by a unit test.

What the visitor asked for chooses the words on the form (`kimi.json` `fastTrack`): "Request a
call", "Book a demo", "Get started", "Talk to a specialist". Whatever the same message also
taught the engine is kept, so "we need to track competitors, can you call me" still routes to
NewIntel, shows the card after the details, and puts both on the lead. When they told us nothing
to route from, the close is a plain "a specialist will be in touch" rather than an empty card.

The lead carries `contactRequest` into HubSpot as `stagwell_ai_contact_request` (a select, so
sales can route on it) and the summary opens with `ASKED FOR A CALL.` — the first thing the
person picking it up needs to see.

## 4d. Start over

"When you are chatting with the AI chat, there should be a button that lets you start over"
(client, 2026-09-10; Amy: "we should allow them to start over / ask a new question — right now
there is no way to do that"). `#agentRestart` sits at the left of the composer bar, hidden until
the first turn, and is the one control that has to work at every point of the conversation:
mid-questions, sitting on the contact form, and after the cards when the composer has been closed
— which is exactly when someone most wants to ask a second thing.

Pressing it empties the thread, reopens the composer with the opening hint, re-enables the
starting-point pills and blanks the flow (`SAIKIMI.reset()`). Two generation counters make it
safe while an answer is still in the air: `hero-agent.js` drops the render of a turn that was
started before the press, and `kimi-flow.js` bumps an `epoch` on reset so a `start`, `answer`,
`readSiteIfNew` or `contact` that was waiting on the network returns without writing into the
fresh state (a lead that was mid-send still lands in HubSpot; its cards are simply not drawn). No
page reload, so nothing else on the page moves. Tracked as `kimi_restarted`.

## 4e. Value before the next question (way-finding) — OFF

**Switched off later the same day** (`flags.pointers: false`). The client, testing the nine-step
order: "I answered #1 and instead of asking for my email, it jumped to 6 with giving
recommendations, then went back to 2, asking for my website." Products are now named once, at
step 6, and the fast-track form has no skip link. The code, copy and `test:value` suite stay (the
suite turns the flag on in-page), so the variant is one flag away if the numbers argue for it.

Amy (2026-09-10): "we're asking a lot of questions of the user without giving them any info …
it feels very 'data miney' right now without giving them any value before asking for a ton of
info", and "there should be an option for the user to visit the relevant product page from this
chat". The reference she gave was Adobe's assistant: name the products, one line each, linked,
then a follow-up question.

So the moment what the visitor said points somewhere, the answer says where, and only then asks.
`recommend.js` `pointers(reco, goalId, data)` is pure and unit-tested:

- with real evidence — the top score at or above `scoring.pointers.minTopScore` (4; an intent
  read, not just a goal, since a bare goal scores `goalAlignment` = 2) — it is **the running**:
  the primary plus a real secondary if there is one (`secondaryMinScore`, capped by `fromReco`;
  a +2 side-match is not a second place to send someone), led in with "Here's where I'd point you
  so far:";
- with only a goal (a pill) it is **the goal's own shortlist**: the first two of `goals.json`
  `candidates` (`fromGoal`), led in with "For that, these are the Stagwell AI products to know:" —
  a list to read, deliberately not called a recommendation;
- with nothing to go on ("hello"), nothing.

Every item is the catalog's `cardDescription` (or `positioning`) and its `urls.productPage` —
nothing written by a model, nothing invented. The bubble reads ack → where to look → the question
→ its chips, and the list is drawn when the set changes (a goal's shortlist on the pill, the
running once an intent lands), never repeated under every question or on a hold turn. The
`goalAck` lines and `freeTextAck` were cut to a few words each; "a couple of quick questions so I
point you at the right thing" is exactly the preamble Amy heard as profiling.

The contact form keeps its purpose — a tailored recommendation and a specialist — but is no
longer the only door: under it sits "Or skip this and read about {product} →" for the top product
(absent on a bare fast track, where nothing was matched). Clicks are `kimi_product_clicked` with
`from: chat | form | card`; the list itself is `kimi_pointer_shown {kind, products, at_step}`.

**A tall answer opens at its first line.** "Try it out and you will see how it jumps" (client):
the thread used to scroll to its foot on every turn, so an answer taller than the window opened on
the question with the ack and the first product hidden above. `home.js` `settle(el)` now aligns a
tall AI turn's top with the window (by `offsetTop` — a client rect mid `turnIn` is 22px off), keeps
short turns at the foot, and toggles `.is-more` on the thread, which fades the foot to say there is
more below (the scrollbar is hidden). The window is `min(52svh, 560px)` on a desktop so the usual
answer fits whole; a phone keeps 38svh inside its 62svh stack. Asserted at 1360×640 and 400×860.

**The composer wraps.** "Spill-over text should create multiple lines on the text input, not
bleed off the frame of the window" (client). `#agentInput` is a one-row `<textarea>`, not an
`<input>`; `home.js` sizes it to its text on every keystroke, up to six lines (then it scrolls
inside itself), and back to one row after a send, on close and on Start over. Enter sends,
Shift+Enter breaks a line; `enterkeyhint="send"` labels the phone key. Asserted in the value suite.

**Every link in the thread opens a new tab.** "Anytime that we show a link in the chat history,
it should open a new tab. Otherwise we're going to lose the whole conversation" (client). The
pointers, the skip link, the cards' Learn more and primary CTA, and the privacy notice all carry
`target="_blank" rel="noopener"`; a capturing click listener on `#agentThread` is the net under
them for any anchor that arrives another way. Same-page `#` anchors and `mailto:`/`tel:` are left
alone. Asserted in the value and fast-track suites.

Decided the same afternoon: `flags.contactGate` is off — the cards come before the email is
asked (§9). The skip link on the form now applies to the fast track's form only.

## 4f. Voice — "Chat with me"

Client, 2026-09-11: a button on the chat box for a spoken conversation, GPT as the default brain,
text and voice in one thread, a sound bubble with waves for both sides, on mobile too. The plan is
`KIMI-VOICE-PLAN.md`; this is what shipped.

**One idea.** The thread is the single source of truth. What the visitor says is typed out (a grey
interim bubble that settles when the transcript is final); what the agent says is typed out as it
speaks; what the visitor types while the session is open goes to the agent and is answered by
voice. The Kimi flow stays the state: the Realtime model can only move a step through
`SAIKIMI.tools` — `submit_answer(text)`, `request_contact(kind)`, `start_over()` — and every tool
is the step a typed turn would have taken, so the nine-step order, the lead, HubSpot and the
events are identical to a typed conversation.

**Wire.** `POST /api/voice/session` mints a two-minute OpenAI Realtime client secret (the key never
leaves the function; 6 mints per IP per hour). The browser opens WebRTC to OpenAI — mic up, audio
down, events on a data channel; audio never touches our servers. `api/_lib/voice/instructions.js`
builds the agent's brief from the same JSON as the text flow: the nine steps, every active
product with its catalog line, never invent, email/phone read back, say what is shown rather than
reading it out. `next/voice-reducer.js` turns server events into thread ops (pure, unit-tested);
`next/voice.js` runs the session; `next/voice-wave.js` draws the strip. GA and beta event names
are both understood.

**The strip.** Ink wave = the visitor (mic level), teal wave = the agent (remote level), dots =
thinking, flat dim = muted, dashed = reconnecting; Mute and End beside it; colours only under
reduced motion; 30 fps on phones. "Chat with me" becomes the live indicator.

**Edge cases handled (all in `test:voice`).** Microphone refused / none / http → the button is
hidden or one honest line, text carries on. Mint 503/429 → unavailable/busy, text carries on.
Connection drop or an API session error → three reconnects, each primed with a summary of the
conversation and the current step, one line "I'm back"; after that, "Voice dropped", text
carries on. Soft cap (10 min): the agent is told to wrap up; hard cap (15): the session ends.
Silence (90 s): the mic mutes, a tap on the strip resumes. Tab hidden: muted; visible: back. Safari
refusing playback: "Tap to hear". Barge-in by voice or by typing: the agent's bubble ends with "—"
and its audio is cancelled. Start over: the thread and flow clear, the voice stays open and the
agent greets again (from the button or from the model's own tool). Text first, voice later: the
mint carries a summary so nothing is re-asked. The fast track by voice: the form appears with no
written intro, the agent says it. Every link still opens a new tab, so the session survives a
product page.

**Defaults chosen (client asked to proceed without answering):** `gpt-realtime`, voice `marin`,
all 19 pages, caps 10/15 min and 6 mints/IP/hour, consent line in the strip while connecting.
Text-only mode runs GPT first: `KIMI_PRIMARY_MODEL=openai/gpt-4o-mini`, Kimi gateway second.
"Why this fits" on the voice path is the deterministic template.

**Not yet verified for real:** this box cannot reach OpenAI, so the browser suite runs against a
fake Realtime peer through the transport seam (`window.__SAIVOICE_TRANSPORT`). The mint is
verified live from production; the first real spoken session is the client's phone on the
production URL.

## 5. No-LLM fallback

Launch requirement, tested in a browser with `/api/ask` aborted: pills → questions → form →
cards, all six goals, phone/dark included. Free text falls to the keyword reader in
`recommend.js` (taxonomy keywords, longest match first) and the band parser ("30 TikTok
creators" → under_100; "3,000 employees" → enterprise). Unrecognised text gets the copy in
`kimi.json` `unclassified` / `fallback` and the six goal pills. The visitor never sees a
technical error.

## 6. LLM broker and fallback chain

`api/_lib/llm/broker.js`. Chain from env (§7). Per attempt 7 s for the Kimi gateway (a
reasoning model; measured 4 s+ on the interpret prompt) and 4 s for the others; whole chain
12 s; one retry only for network/429/5xx with time in hand, never for a timeout; empty, unparseable or off-schema output
fails over immediately; exhausted → `ok:false` and the client runs deterministically. Every
response carries `{provider, model, chainIndex, fallbacks, failed[]}` for the
`kimi_model_fallback` / `kimi_deterministic_mode` events; `[llm]` log lines carry the rates for
§46. Keys never leave `providers.js`.

## 7. Model configuration

```
KIMI_PRIMARY_MODEL=kimi/kimi-for-coding-highspeed      # default when LLM_API_KEY is set
KIMI_SECONDARY_MODEL=openai/gpt-4o-mini                # default when OPENAI_API_KEY is set
# production (2026-09-11): KIMI_PRIMARY_MODEL=openai/gpt-4o-mini, KIMI_SECONDARY_MODEL=kimi/kimi-for-coding-highspeed
VOICE_MODEL=gpt-realtime                               # or gpt-realtime-mini (≈⅕ the cost)
VOICE_NAME=marin                                       # the agent's voice
VOICE_ENABLED=on                                       # off hides the button server-side; flags.voice in kimi.json hides it client-side
VOICE_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe          # what types the visitor's words out
VOICE_SESSION_SECONDS=900  VOICE_SOFT_SECONDS=600      # hard / soft caps
VOICE_SILENCE_MUTE_SECONDS=90  VOICE_MINT_PER_HOUR=6   # the silence mute; mints per IP per hour
VOICE_SECRET_SECONDS=120  VOICE_MAX_OUTPUT_TOKENS=700  # the client secret's life; per-turn cap
KIMI_TERTIARY_MODEL=anthropic/claude-haiku-4-5-20251001 # default when ANTHROPIC_API_KEY is set; 'off' to disable
KIMI_PRIMARY_TIMEOUT_MS=7000 KIMI_SECONDARY_TIMEOUT_MS=4000 KIMI_TOTAL_DEADLINE_MS=12000 KIMI_LLM_ENABLED=true
```
Vendors: `kimi/`, `openai/`, `xai/`, `anthropic/`. Changing a model is an env change and a
redeploy. `GET /api/ask?health=1` shows the chain as configured (never a key);
`&probe=1&token=$KIMI_HEALTH_TOKEN` makes one tiny call per provider.

## 8. Product cards

`next/cards.js`: `buildCards(reco, signals, data, copy)` → view models; `renderCards(vms)` →
HTML. Primary: BEST FIT badge, logo, name, canonical one-liner, "Why this fits you", up to 3
capability chips, primary CTA + Learn more. Secondary (0–2): ALSO WORTH CONSIDERING, name,
one line, Learn more only. CTA rules (§23): `conversion.primaryType` DEMO → "Book a demo" opens
the site's booking modal (`data-cta="session"`, lead.js) unless `urls.demo` is set;
SELF_SERVICE (QuestDIY, Stagwell AI for SMBs) → "Start now" to `urls.selfService`, secondary
"Talk to an expert"; EXPERT_CALL (Stagwell's Machines) → the expert modal. URLs come from the
catalog only; the model's text is escaped and never rendered as HTML.

"Why this fits" is deterministic (`kimi.json` `whyFits`: the visitor's need phrase + the
product's card copy); when the broker answers `mode:'explain'` within 5 s the sentence is
replaced by the model's — built from the same catalog facts, rejected if it names another
product, a figure or a URL.

## 9. Recommendation, then contact — steps 6 to 9

`flags.contactGate` is **off** (client's order, 2026-09-10): the cards come before any detail is
asked. `readyForContact()` → `showRecommendation()` → `askEmail()`, and the composer stays open
under the cards:

6. **the recommendation** — the cards (§8) under "Here's what fits best:" (`recommendationIntroOpen`,
   `…Low` when confidence is low). "Why this fits" is the deterministic template on this path;
   the model's `explain` is used only where a lead already exists (the fast track).
7. **email** — one line in the conversation, keyboard set to `inputmode=email`. A bad address is
   asked again. A good one **creates the lead in HubSpot at once** (`POST /api/lead` with
   `lead.email` and no name — `schema.js` no longer requires one), so nothing is lost if they
   leave. A delivery failure is said in the thread and the same line is asked again.
8. **phone** — `inputmode=tel`; a bad number is asked once more, a second bad one (or "no") moves
   on. A good one **updates the same contact** (leadService upserts by email).
9. **book a call** — one button, `data-cta="demo"`, which lead.js takes to the booking page
   (`/book`); the line under it says we follow up at the email (and phone) either way. The
   composer closes.

Events: `kimi_contact_viewed {mode:'open', ask}`, `kimi_email_captured`, `kimi_phone_captured` /
`kimi_phone_declined`, `kimi_book_offered`, `kimi_book_clicked`. The full email address never
reaches the event bus (only its domain).

**The fast track keeps its form** (§4c): someone who asked to be called has already told us what
they want; name, business email and phone in one compact form, then the cards, then done. Server
revalidation, normalisation and the 10 leads/min/IP limit are unchanged for both paths.

Turning `flags.contactGate` back on restores the old order (form before cards) without a code
change.

## 10. HubSpot integration

`api/_lib/leads/hubspot.js`, server-only, raw CRM v3 (search by email → PATCH, else POST;
409 → PATCH the existing id). **Mock mode** whenever `HUBSPOT_ACCESS_TOKEN` is absent or
`HUBSPOT_MOCK=true`: the exact property payload is logged (person reduced to email domain)
and a `mock-…` id returned. `LEAD_WEBHOOK_URL` remains a second destination. If nothing takes
a lead, the function log carries `LEAD_UNDELIVERED` with the full discovery payload for replay.

**The existing webhook**: `LEAD_WEBHOOK_URL` is **not set** on the Vercel project. Until today
leads reached nowhere (the old endpoint answered 202 `not_configured`). They now reach the
mock, which is still nowhere durable — see §17.

## 11. HubSpot property setup checklist

**Turning HubSpot on, start to finish** (2026-09-10; the sandbox this was built in cannot reach
`api.hubapi.com`, so the one-time property creation is run from a machine that can):

1. HubSpot → Settings → Integrations → Private apps → **Create a private app**, name it
   "Stagwell AI website". Scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`,
   `crm.schemas.contacts.write` (the last one only for step 2; it can be removed afterwards).
   Copy the access token.
2. From a clone of this repo, Node 22+, **once**:
   `HUBSPOT_ACCESS_TOKEN=pat-… node scripts/hubspot-setup.mjs`
   It checks the token first, creates the group and the properties, skips any that already
   exist, and is safe to run again. `--dry-run` prints the plan without a token.
3. Vercel → the project → Settings → Environment Variables → add `HUBSPOT_ACCESS_TOKEN`,
   marked **Sensitive**, for Production, Preview and Development. Redeploy.

That is the whole switch: `hubspotMode()` returns `live` as soon as the token exists, so no code
or flag changes. `HUBSPOT_MOCK=true` forces mock again if it ever needs turning off in a hurry.

**Do not add `"type": "module"` to the root `package.json`.** Node suggests it in a warning when
anything under `api/_lib/` is imported from a script; the script filters that warning for this
reason. It would break `next/recommend.js` for the tests, the browser scripts, and both Vercel
functions — they are compiled to CommonJS, so they would `require()` an ES module and 500 on
every request. Tried on 2026-09-10 via an `api/_lib/package.json`; both endpoints went down and
it was reverted within five minutes.

Verified before handover by running the real script and the real lead service against a
stand-in portal that rejects unknown properties, exactly as HubSpot does: 17 created + 1 already
present, a wrong token fails fast, a missing scope stops at the first property with the fix
named, and a lead creates once then updates on the same email without duplicating.

Creates group `stagwell_ai` and:

`stagwell_ai_primary_goal` (select) · `stagwell_ai_contact_request` (select: call / demo /
trial / expert / pricing) · `stagwell_ai_role` (select) · `stagwell_ai_site_known` ·
`stagwell_ai_industry` · `stagwell_ai_company_size`
(select) · `stagwell_ai_use_case` (textarea) · `stagwell_ai_primary_product` ·
`stagwell_ai_secondary_products` · `stagwell_ai_recommendation_confidence` (number) ·
`stagwell_ai_conversation_summary` (textarea) · `stagwell_ai_conversation_steps` (number) ·
`stagwell_ai_session_id` · `stagwell_ai_landing_page` · `stagwell_ai_utm_source` ·
`stagwell_ai_utm_medium` · `stagwell_ai_utm_campaign` · `stagwell_ai_utm_content` ·
`stagwell_ai_llm_mode` · `stagwell_ai_last_submitted`. Standard: `email firstname lastname
phone company website jobtitle`. Private-app scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`
(+ `crm.schemas.contacts.write` for the setup script only).

## 12. Environment variables

See `.env.example`. Set today on **stagwell-ai-prototypes** (production, preview, development):
`OPENAI_API_KEY` (sensitive), `KIMI_SECONDARY_MODEL=openai/gpt-4o-mini`, `KIMI_HEALTH_TOKEN`
(sensitive). Already there: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`. Not set (so mock /
off): `HUBSPOT_ACCESS_TOKEN`, `HUBSPOT_PORTAL_ID`, `LEAD_WEBHOOK_URL`, `ANTHROPIC_API_KEY`,
`XAI_API_KEY`. The **stagwell.vercel.app** project is a separate Vercel project this session
cannot reach; its variables must be set by Julian for the fallback and the health token to
work there.

## 13. Analytics events

Voice (2026-09-11): `voice_session_started {model, resumed}`, `voice_session_ended {seconds,
turns, reason: user|cap|dropped}`, `voice_unavailable {reason: denied|nomic|busy|unconfigured|
network}`, `voice_reconnected {attempt}`, `voice_tool_call {name, status}`, `voice_barge_in`,
`voice_muted`, `voice_silence_mute`, `voice_error {code}`; `kimi_started {input_type:'voice'}`
and `kimi_restarted {via}`. Transcripts never go to analytics; the full email address never does
(the tool result carries `emailGiven`, not the address).

`SAIANALYTICS.track(name, props)` → the in-page bus (`SAI.events`, PII-redacting) and, when
present on the page, `dataLayer`, `gtag`, `mixpanel`, `analytics`. Events: `kimi_started`,
`kimi_goal_selected`, `kimi_free_text_submitted`, `kimi_question_answered`,
`kimi_model_fallback`, `kimi_deterministic_mode`, `kimi_contact_viewed`,
`kimi_contact_submitted`, `kimi_recommendation_generated`, `kimi_product_clicked`,
`kimi_demo_clicked`, `kimi_self_service_clicked`, `kimi_external_site_clicked`,
`kimi_lead_delivery`. Properties: session_id, step, input_type, primary_goal, company_size,
primary_product, secondary_products, recommendation_confidence, llm_status, llm_provider,
llm_fallback_count, utm_source, utm_campaign. Email is passed as its domain only; `name`,
`email`, `phone` keys are dropped by the tracker itself. Flag: `kimi.json` `flags.analytics`.

## 14. Test coverage

`npm test` — `node --test tests/kimi/*.test.mjs`, 53 tests, no network:
- `routing.test.mjs` — catalog integrity; the brief's seven scenarios; every §12 rule through
  the pills; creator ambiguity → primary + secondary; every goal ends within budget.
- `question-selection.test.mjs` — bank shape; goal → its own opener; inferred fields never
  re-asked; highest-value question; stop on high confidence; ≤ 2 turns for an obvious intent;
  budget holds with unhelpful answers.
- `broker.test.mjs` — valid / timeout / 429 / 500 / malformed / wrong schema / empty /
  network, each failing over; one bounded retry; tertiary; exhaustion; unkeyed provider
  skipped; deadline; disabled flag; health never leaks a key; explanation schema.
- `lead.test.mjs` — normalisation, recompute vs. client claim, rejection cases, legacy payload,
  property mapping, mock mode, live create / update / 409, undelivered logging, webhook,
  HubSpot-off flag.

`npm run test:site` — Playwright: the opening two questions, the lookup and what it does with
what it finds; a recognised site (fact list shown, size question never asked, everything on the
lead), an unrecognised one (one honest line, nothing invented), the lookup being down entirely,
declining, a typed job title landing on a band, and a website inside the first message skipping
the question.

`npm run test:fasttrack` — Playwright, every model off: each way of cutting to the chase opens
the right form with no discovery question asked, the lead carries the request, a need plus a
request keeps both, cutting to the chase mid-conversation stops the questions, and ordinary
marketing talk still goes to discovery.

`npm run test:focus` — Playwright: after the agent answers, the visitor can keep typing without
touching the mouse, whichever way they came in (the bar's chat bubble, the hero field, a
starting point); the whole white card is the field's hit area, not the 25px line at the top of
it; plus the restraints — a phone keyboard is not summoned by a pill, focus moved elsewhere is
left alone, the send disc and the thread's chips are still their own targets, a line of the
answer can still be selected without the caret being yanked away, the contact form takes the
caret and the composer closes on the cards.

`npm run test:restart` — Playwright, every model off: the Start over button is hidden until the
first turn; pressed mid-questions, on the contact form, after the cards (closed composer) and on
a generated product page, the card returns to its opening state — empty thread, typable composer
with the opening hint, pills enabled, blank flow state, focus in the field — and takes a fresh
first message; pressed while an answer is still in flight, the abandoned answer never repopulates
the box or re-locks the composer.

`npm test` also runs `voice.test.mjs` (16): the brief carries the nine steps in order and every
active product with its own line, no URL, no price, no inactive product; the tools and their
kinds; the session object; the mint (secret returned, key never; 503/502/504; resume capped); the
reducer (visitor interim → final, agent stream GA and beta names, barge-in and cancel cut-offs,
tool calls once with parsed arguments, errors short, unknown events ignored, client event shapes).

`npm run test:voice` — Playwright against a fake Realtime peer injected through the transport
seam: the button, strip and greeting; agent and visitor transcripts; the full nine steps through
`submit_answer` with the lead created on the email and updated on the phone and no question text
drawn by hero-agent; typing over voice; barge-in by voice and by typing; mute/end and text after;
Start over from the button and from the model; text-first priming; microphone refused; mint
503/429; drop → reconnect primed; soft and hard caps; silence mute and the tap back; tab hidden;
Safari's tap-to-hear; the fast track by voice; an API session error → reconnect; three drops →
give up honestly; a phone viewport; a browser without a microphone hides the button.

`npm run test:order` — Playwright, every model off, the site lookup mocked known/unknown: the
client's nine steps asserted in order from a pill (website with no skip chip → "couldn't find
much" → size → role → the goal's opener → cards under their own heading → email, a bad one
re-asked, the lead created on the email alone → phone, a bad one asked once more, the same lead
updated → "Book a call" to `/book`, the click recorded before leaving); from a typed need with a
known site (insights shown, size not asked, no discriminator, phone declined twice → the call
offered anyway, one lead write); the website nudge (a decline asked once more, a name kept as the
company on the lead); a domain given on the second ask still looked up; the fast track unchanged.

`npm run test:value` — Playwright, every model off: a typed need names the product (page link,
catalog line, "Read about …") before any question is answered, in reading order ack → products →
question → chips, with no "couple of quick questions" preamble; a pill draws the goal's shortlist
once and not again under the website, role or hold turns, then the running once an intent lands;
the contact form carries the skip link to the product page and its click is recorded `from: form`;
a bare fast track has no skip link; "hello" earns no list; a mid-chat click is `from: chat`.

`npm run test:funnel` — Playwright, `/api/ask` aborted: six goals (desktop, light), reputation
(phone, dark), a typed sentence, nonsense-then-pill. All green on 2026-09-10; screenshots in
`tests/artifacts/kimi/`.

## 15. Sample conversation results (deterministic path)

| Input | Turns | Result |
|---|---|---|
| Pill "Track your competition" → "What they're doing right now" → size | 2 | NewIntel (high); also BERA.ai |
| Pill "Measure brand impact" → "Revenue, pricing power…" → size | 2 | BERA.ai (high) |
| Pill "Protect brand reputation" → "Early warning" → "One market" → size | 3 | The Knowledge Machine |
| Pill "Grow your audience" → "Connecting and enriching our customer data" → size | 2 | Stagwell ID Graph |
| Pill "Scale business operations" → "Customer calls…" → size | 2 | NewVoices |
| "Our call center misses leads overnight" → size | 1 | NewVoices |
| "Small ecommerce brand, 30 TikTok creators" | 0–1 | Stagwell AI for SMBs (Start now) |
| "Enterprise program with 500 creators" | 0–1 | IMAI |
| "hello there" → fallback pills → competition → … | 3 | NewIntel |

## 15b. Verified in production (stagwell-ai-prototypes, 2026-09-10)

- `GET /api/ask?health=1&probe=1` — chain Kimi (7 s) → OpenAI gpt-4o-mini (4 s); both probes ok
  (Kimi 1.2 s, OpenAI 0.8 s).
- `mode:'interpret'` on "Our call center misses leads overnight and we run about 40 TikTok
  creators a year" → Kimi, 2.3 s: intents `customer_voice_ai`, `creator_management`;
  creatorProgramSize `under_100`; confidence 0.85.
- `mode:'explain'` for NewIntel → Kimi, 3.2 s, one sentence built from the catalog facts.
- `POST /api/lead` → 200, `mode:"mock"`, recommendation recomputed server-side (NewIntel, also
  BERA.ai); malformed lead → 400.
- Every changed file byte-identical on stagwell-ai-prototypes.vercel.app and stagwell.vercel.app.
- Forced failover is covered by the broker unit tests; in production the OpenAI slot has only
  been exercised by the probe, since Kimi answered every live call.

## 16. Known limitations

- Rate limiting is per serverless instance (no shared store); an edge/WAF rule is the real one.
- `mode:'interpret'` is only as good as the taxonomy prompt; the 30-scenario model eval set
  (§51 Phase 6) is not yet written — the deterministic set above is the regression suite.
- Kimi's coding gateway does not support JSON mode; the loose parser copes, and OpenAI does.
- `gpt-4o-mini` verified from production on 2026-09-10 (health probe: ok, ~1.9 s).
- No Anthropic/xAI key is set, so the chain is two deep today (Kimi → OpenAI → deterministic).
- The older `/next/agent` page still runs the six-question flow, not Kimi.
- The mock HubSpot stores nothing; a real lead today lands only in the function log.
- Contact gate is per conversation; `/products` and `/s/{id}` pages remain open (as agreed).

## 17. External credentials / admin actions still required

1. HubSpot private app + token → `HUBSPOT_ACCESS_TOKEN`, `HUBSPOT_PORTAL_ID`; run the setup
   script; decide the §57 questions (contact vs deal, owner by product, lifecycle stage, MQL).
2. Optional third model: `ANTHROPIC_API_KEY` or `XAI_API_KEY` (+ `KIMI_TERTIARY_MODEL`).
3. Set the same variables on the **stagwell.vercel.app** project.
4. Rotate the OpenAI key that was pasted into chat once the fallback is confirmed working.
5. Optional: `LEAD_WEBHOOK_URL` (Zapier/Make/Slack) as a second destination before HubSpot is live.

## 18. Launch-readiness checklist

- [x] Six pills route correctly (unit + browser)
- [x] Free text interpreted by the primary model (Kimi) — schema-validated
- [x] Second model takes over on primary failure (OpenAI) — broker tests; production probe pending
- [ ] Third model — no key yet
- [x] Full funnel works with all models disabled — browser test, six goals, dark + phone
- [x] Product logic and content outside the UI; URLs only in configuration
- [x] Contact captured before outbound links; cards after capture
- [~] HubSpot receives contact + structured data — **mock**; live path unit-tested against a fake
- [x] No uncontrolled duplicates — search-by-email then update; 409 handled
- [x] Data-driven cards; SMB self-service CTA; demo/expert for the rest
- [x] Analytics events fire; no provider key client-side; mobile usable
- [x] Routing, question-selection, model-fallback and HubSpot tests pass (53)
