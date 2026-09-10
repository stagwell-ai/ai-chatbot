# Handover — redesigning Stagwell.AI

Everything a designer needs to change how this site looks, push it, and see it live.

**Repo** `github.com/julianLDRS/stagwell-ai` · **Live** https://stagwell.vercel.app
**Branch that ships** `main`

---

## 1. Access to ask for

| What | Who grants it | Needed for |
|---|---|---|
| GitHub write access to `julianLDRS/stagwell-ai` | Julian | pushing changes |
| Vercel team member on **New Voices** (optional) | Julian | seeing deploy logs, rolling back |

Vercel access is optional — once section 2 is done, pushing to GitHub is enough.

---

## 2. Getting pushes to go live automatically ⚠️

**Right now, pushing to `main` does NOT deploy.** Every deploy so far has been a manual
`vercel deploy --prod` from Julian's machine; the Vercel project has no Git connection.

One command, run once, by Julian, from this folder, fixes that forever:

```bash
vercel git connect https://github.com/julianLDRS/stagwell-ai
```

After that:

- push to **`main`** → production rebuilds at stagwell.vercel.app, ~20 seconds
- push to **any other branch** → Vercel posts a private **preview URL** on the commit

Preview URLs are the safer way to work: branch, push, share the preview, merge to `main`
when everyone agrees. A push straight to `main` is live immediately, with nothing in
between — worth knowing before the first one.

---

## 3. Running it locally

There is **no build step and no dependencies**. What is in the repo is what ships.

```bash
git clone https://github.com/julianLDRS/stagwell-ai
cd stagwell-ai
npx serve . -l 8177          # or: python3 -m http.server 8177
```

Open http://localhost:8177/machine/b.html

One catch: production rewrites pretty URLs (`/` → `machine/b.html`, `/products` →
`machine/products.html`, and so on — see `vercel.json`). A plain static server does not,
so locally you open the real file paths under `/machine/`. Everything else behaves the same.

To exercise the whole flow without typing, add `?autostart=1&q=nike.com` to the landing.

---

## 4. Where everything is

```
machine/          ← the site. Every page, style and script.
  b.html            the landing (hero, chooser, About, carousel, CTA, footer)
  why.html          /why — the full messaging page
  products.html     /products — the solution directory
  solution.html     /s/{id} — one product page, rendered from data
  campaign.html     /p/{campaign} — the four ad landings
  ads.html          /ads — demo control, picks which ad "brought you here"

  styles.css        ★ THE TOKENS — colour, type scale, spacing, textures
  b.css             ★ landing: nav, hero, About section, footer, CTA band
  hero.css          ★ the chooser card (the light one)
  convo.css           the conversation + the email gate
  snapshot.css        the results screen
  path.css            the recommendation screen
  cloud.css         ★ the product carousels
  solution.css / campaign.css / products.css / directory.css / lead.css / console.css

  DESIGN.md         ← read this first. The system as built.

data/             ← ALL COPY AND LOGIC. No code changes needed to edit words.
  questions.json    every question the agent asks, the chooser rows, the gate
  messaging.json    the What is / Why Stagwell.AI content
  solutions.json    the 14 products — names, descriptions, URLs
  routing.json      which problem + company size → which product
  campaigns.json    the ad landings
  products.json     product page content
  brand.json        the palette and brand rules, as a document
  cta.json          the lead-capture modal copy

assets/           images, video, fonts, product lockups
tests/            the acceptance suite (see §7)
reference/        the original brief and design kit
```

The three archived prototypes (`c.html`, `d.html`, `e.html`, `versions.html` and the
root-level `app.js`, `styles.css`, `b.css`) are **history, reachable from "Previous
versions"**. Leave them alone — they are not part of the current site.

---

## 5. Changing the look

**Start in `machine/styles.css` `:root`.** Nearly every colour, size and space on the site
comes from a token there. Changing `--paper` repaints every page. `machine/DESIGN.md`
documents what each token means and the rules the current design follows.

The layout of each section lives in the CSS file named for it. The HTML is plain and
semantic; several sections (About, the carousels, the product pages) are rendered by a
small JS file from the matching JSON, so to change *what they say*, edit the JSON; to
change *how they look*, edit the CSS.

**Full freedom:** all colours, all spacing, all typography, all layout, the imagery,
the section order, adding sections, adding pages.

---

## 6. The few things that will break the demo

The site is a working product, not a mockup. A handful of names are load-bearing — the
JavaScript and the test suite find elements by them. **Rename the class, keep the id.**

These `id`s must survive (styling them however you like is fine):

```
#heroPick #pickGo #pickSite #pickFree        the chooser
#promptInput #promptSend #thread             the conversation composer
#convoGate #gateEmail #gatePhone
  #convoReveal #convoSkip                    the email gate
#snapView #snapCapture #snapCaptureForm
  #snapEmail #snapPdfBtn #snapPdfHint
  #snapDecline #snapPathGo
  #snapPathGoDeclined                        the snapshot
#pathView                                    the recommendation screen
#agentPanel #askSite                         the ad landings
#about #videoBox #heroPlay                   About section, film
```

Two classes are addressed by name in JS: **`.btn--gold`** (the primary button — the name is
legacy, it is orange now) and **`.pick__row`**. And `.snapmod`, `.pathcol`, `.fcard`,
`.scard` are counted by the tests.

Also worth knowing: **nothing here has a design system beyond `DESIGN.md`** — no Tailwind,
no component library, no preprocessor. Plain CSS with custom properties, which means it can
be rewritten freely without fighting a framework.

---

## 7. Checking nothing broke

```bash
./tests/run-all.sh
```

Twelve end-to-end journeys through real browsers: someone arriving from an ad, answering
the questions, getting a snapshot, reaching a recommendation. Green means the demo is safe
to put in front of a room.

It needs Node and Playwright (`npm i -g playwright && npx playwright install chromium`) and
a local server on port 8177. It is worth running once before the first push, and again
before merging a redesign — it catches a renamed id in seconds instead of in a meeting.

If it is not set up, the quicker manual check: open the landing, pick "Awareness", answer
through to the end, give an email at the gate, and confirm you reach the snapshot and then
the recommendation screen.

---

## 8. Pushing

```bash
git checkout -b redesign            # work on a branch
# ...changes...
git add -A
git commit -m "Redesign: ..."
git push -u origin redesign         # → Vercel posts a preview URL
```

When it is approved, merge to `main` (via a pull request on GitHub, or
`git checkout main && git merge redesign && git push`) and it goes live.

---

## 9. Open items the designer should know about

- **Imagery is placeholder.** The carousel clips and the hero illustration are
  AI-generated stand-ins, kept deliberately until real product photography exists.
- **Demo chrome.** The "HubSpot console" pill and "Previous versions" link are
  fixed-position presenter tools. They overlap the chooser on small phones; hiding them
  under 640px is a one-line decision nobody has made yet.
- **The dark room is a brand decision**, from Concept Final V3.1 — "going dark mode, it
  stands out from the TMC blue and the Stagwell site". The one light object is the chooser.
- **Everything on screen is honest by rule.** Illustrative figures carry an "Illustrative"
  tag, unconfirmed facts appear in `[BRACKETS]`, and no real company is described with
  invented data. Please keep that intact — it is why the demo can be shown to clients.
- **The homepage agent is real and ends on a contact form.** `/next` runs the same
  engine/flow as `/next/agent`; after its questions it asks for name, email and phone
  and POSTs them to `/api/lead`. That function forwards the lead to whatever
  **`LEAD_WEBHOOK_URL`** points at (HubSpot form endpoint, Zapier, Slack hook — any JSON
  POST; optional `LEAD_WEBHOOK_AUTH` is sent as the Authorization header). Until that
  variable is set in Vercel, leads are **not stored anywhere** — the visitor still sees
  a confirmation and the function log records the miss. The model behind the questions
  needs `LLM_API_KEY` (plus optional `LLM_BASE_URL`, `LLM_MODEL`); without it the
  classifier falls back to keywords and the site read is skipped.


---

## Kimi — the homepage product-discovery conversation (2026-09-10)

The hero chat now runs on a deterministic recommendation engine with a model broker in front of
it and a (mocked) HubSpot lead service behind it. Everything about it — architecture, files,
environment variables, the HubSpot property checklist, tests, known limitations and the admin
actions still outstanding — is in **`KIMI.md`**. Run `npm test` for the 53 unit tests and
`npm run test:funnel` (needs a local server on :8199 and Playwright) for the pills-only browser
funnel.
