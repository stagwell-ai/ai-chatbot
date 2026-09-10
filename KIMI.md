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

## 4b. The conversational layer

The engine decides *what* is asked; the model shapes *how it reads* (brief §13.3). The single
`interpret` call also returns `ack` (one sentence reflecting a detected need, which leads into
the next question) and `reply` (when nothing was detected: a natural answer to a greeting, an
off-topic line or a question about Stagwell AI, written only from the approved `about` text in
`kimi.json` and the product names). A turn that teaches the engine nothing is a **hold**: the
agent replies, keeps the same question and the same pills, and never advances toward the form.
With no model, the hold lines in `kimi.json` (`hold`, `holdQuestion`) rotate instead. Pill
taps stay templated, so they answer instantly.

## 4b2. Reading their site, and who they are

Every conversation now opens with two questions before any discriminator
(client, 2026-09-10: "it should have asked me about my website, and then it should do a quick
search to see what info it can pull up and show me the info and then keep talking to me with
added relevance", and "at this point it should ask for my domain name, and then what is my role
in the company"):

1. **the website** — `/api/ask mode:'research'` asks the model what it already knows about that
   domain. It is built to answer `known:false` rather than guess, so what comes back is real or
   nothing. What it returns is shown as a short fact list (industry, size band, comparison set)
   and, more usefully, **used**: the size band means the company-size question is never asked,
   the industry rides to the CRM. A domain it does not recognise gets one plain sentence and the
   conversation carries on. Declining ("I'd rather not say") looks nothing up.
2. **their role** — founder / marketing manager / director-VP / C-suite, or typed in their own
   words and matched to one of those bands. It does not move the product recommendation; it
   qualifies the lead, and it is the vocabulary `routing.json`'s seniority override and
   `engine.js`'s ICP boosts already speak.

A website inside their own opening sentence answers question 1 before it is asked, and is read
straight away. Either question can be cut short by asking to be contacted (§4c).

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

## 9. Contact capture

In the thread, after the questions, before any card: "See your recommendation" — name,
business email, phone (all required; phone shape-checked), consent notice with the privacy
link, one button "Show my recommendations". Client validation is immediate; server
revalidates, normalises and rate-limits (10 leads/min/IP). A delivery failure keeps the form
and offers a retry; a delivered-or-mocked lead shows the cards at once (§36).

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
