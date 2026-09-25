# Stagwell AI — brief for whoever works on this next

Read this before changing anything. It is short on purpose; the long version
is `KIMI.md`, which explains why the site is built the way it is.

## What this is

A **static site with serverless functions**. No framework, no build step, and
**no dependencies at all** — `package.json` has an empty `dependencies` and an
empty `devDependencies`. Node 22+.

    next/        the live site (HTML, CSS, vanilla JS — no modules, no bundler)
    api/         Vercel functions: leads, HubSpot, the LLM broker, voice
    data/        JSON the site and the agent read at runtime — a data contract
    tests/       194 unit tests + browser suites
    vercel.json  every route, rewrite and redirect

`/` rewrites to `next/home-c.html`. **Not `index.html`** — that is an older
variant kept for comparison. Getting this wrong means editing a page nobody
sees.

## Running it

    npm test                      # 194 unit tests, no setup needed
    python3 -m http.server 8199   # raw file server, for most browser suites
    npm run test:consent          # and the rest: see package.json scripts

Browser suites need Playwright and a server that understands `vercel.json`'s
rewrites — `/book`, `/s/{id}` and `/the-machine` are rewrites, not files.

## Five rules, each from something that actually broke

**1. Never add `"type": "module"` to `package.json`.** Node prints a warning
suggesting it. Doing it breaks both Vercel functions (they are compiled to
CommonJS and would `require()` an ES module, 500ing every request) and the
browser scripts. Tried 2026-09-10; both endpoints went down; reverted in five
minutes.

**2. Product names in `data/solutions.json` are wired to a live CRM.** Each
`displayName` is matched character-for-character against a dropdown in
HubSpot. Rename one and every lead choosing that product sends an option
HubSpot has never heard of — which fails the *entire* form submission, not
just that field. If a rename is required, make it and say so, because the CRM
side has to move with it.

**3. A product's name lives in three files.** `data/solutions.json` feeds the
cards and the CRM, `data/explainers.json` feeds what the agent says, and the
generated page is a third copy. Change one and the agent tells a visitor a
different name than the page shows. Grep the old name across `data/` and
`next/` before you finish.

**4. A failing test is information, not an obstacle.** Do not "fix" one by
changing what it asserts. If a copy change fails a test, the copy is wired to
something. Make the test assert the *requirement* rather than the words — for
example that two files agree on a product's name, not that the name is any
particular string.

**5. Nothing loads before consent.** Contentsquare, HubSpot and Mixpanel all
sit behind `next/consent.js`. Do not add a tracker as a `<script>` tag; call
`SAICONSENT.whenGranted(...)`. `npm run test:consent` watches the network and
will catch it.

## Touch carefully

These carry the integrations, and changing them without understanding the
whole path tends to fail silently rather than loudly:

    api/**                              leads, HubSpot, LLM, voice
    next/analytics.js, mixpanel.js, consent.js
    next/lead.js, engine.js, kimi-flow.js, recommend.js
    data/solutions.json, taxonomy.json, scoring.json, cta.json, explainers.json
    vercel.json

Page copy, layout, CSS, imagery and page templates are ordinary work — change
them freely, run the tests, and read rule 3 first if a product name is involved.

## Configuration

Every environment variable is documented in `.env.example`. Nothing secret is
in the repo. The site runs without any of them: no HubSpot token means lead
capture runs in mock mode and logs what it would have sent.
