# Stagwell.AI Demo — Build Spec

Visual targets: `reference/W1..W5-*.png` (screens), `reference/F1..F3-*.png` (flows). Logic: `data/*.json`.

## Screens

### S1 · Master landing (`/`) — ref W1, campaigns.json `master`
- Nav: STAGWELL.AI wordmark + tagline "Agentic solutions built by marketing experts for modern marketers"; links: Find your solution · The Marketing Cloud; button: Talk to an AI expert
- Hero: "What do you need help solving today?" + sub inviting problem or website paste
- ONE prompt box ("Describe your problem — or paste your website, like nike.com — and we'll take it from there…", CTA "Ask the agent") + 4 suggestion chips (from questions.json q1.chips) that pre-fill the box
- How-it-works strip (Tell the agent → See your snapshot → Get your path); footer with credibility line placeholder
- NO workspace/session CTAs here — those appear post-snapshot only

### S2 · Product landing (`/p/[campaign]`) — ref W2, campaigns.json
- Same nav/pattern, split hero: product identity column (logo lockup placeholder, ad key-visual placeholder, 2 product-UI screenshot placeholders, product accent color used on this page only) + embedded agent panel pre-seeded per campaigns.json (opener + product chips + cross-discovery chip "What else fits my problem?")
- Entry via `?utm_campaign=` sets attribution + product interest
- Product-site link is secondary; for paid traffic it surfaces after capture
- Bottom band: "This is the preview. The workspace is the product." + Ask the agent / Talk to an AI expert

### S3 · Conversation (`/chat`) — ref W3, questions.json
- Chat spine left, "Your snapshot" build-progress rail right (modules flip to "Ready" as research completes; copy "Two more answers and it's yours to see.")
- Progress indicator ("A couple more questions" + bar)
- Follow skip logic exactly (F2 flow chart): product-ad entry skips Q1; website in first message skips Q2; confident research turns Q4 into one-tap confirm ("Looks like [Company] is around N people, in [industry] — did I get that right?" / That's right / smaller / bigger); Q6 adaptive per domain, skipped when match is obvious
- Free text always allowed; a free-text answer may fill several slots; visitor corrections always win

### S4 · Snapshot reveal (`/snapshot`) — ref W4
- Header: "[Company] vs. your market, right now" · "Built from your five answers · [date]"; Download PDF button visibly locked ("Unlocks when we send your report")
- Three modules (mock data seeded from company name): Competitive position (labeled bar scores + one-line finding), AI-search visibility (ChatGPT/Gemini/Perplexity "n of 10 answers" + finding), Brand signal (score dial + momentum + finding). Module copy = capabilities, no product names.
- Capture band: work email + "It's OK to contact me about these results" checkbox → "Send my report" → unlocks PDF (generate a simple branded PDF or print view) + fires capture event
- Bottom band: "This is the preview. The workspace is the product." + 3 action tiles ranked by routing (primary = marigold)

### S5 · Routing (`/path`) — ref W5, routing.json
- "Here's the path we'd recommend for [Company]" + matched capability cards with "Why matched: …" transparency lines
- Route options per decision tree (F3): consultative / demo (with scheduler placeholder) / self-serve
- SELF-SERVE state: dominant hero "You can start right now — no meeting needed." + big "Start your free trial →" (tagged, attributed link), other paths as text links
- Handoff links carry attribution; events logged

### S6 · Event console (demo aid, `/events` or side drawer)
- Live list of everything "sent to HubSpot": attribution, answers/slots, consent state, routing decision, handoff clicks, per-journey conversion event → rolled up under "Qualified opportunities created by Stagwell.AI"

## Logic
- Slot model + skip rules: `data/questions.json`
- Category decision: apply `routing.json.overrides` in order (first match wins), else `domains[].cells[tier]`
- Solution surfacing: `solutions.json.surfaces` (directory / featured-in-context / snapshot / cross-discovery)
- Tiers: SMB <~250 employees or <$1M budget · mid 250–2,500 · enterprise 2,500+ or $1B+ revenue or global multi-brand

## Acceptance
- All five demo-script paths in CLAUDE.md work end to end
- Copy/logic changes require only edits to `data/*.json`
- Every visitor-facing diagnostic string is free of product names (test it)
- Snapshot data is clearly fictional (seeded mock), never real-company claims
- Responsive enough for a laptop demo; phone nice-to-have
