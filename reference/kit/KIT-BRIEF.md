# Stagwell.AI — Demo Build

## What this is
A working demo of **Stagwell.AI**: a chat-first website that qualifies marketing-leader visitors in ~5 questions, shows them an instant "snapshot" of their brand, and routes them to the right next step (self-serve trial / sales demo / consultative conversation / nurture). It is a **centralized conversion and routing layer** for Stagwell's AI product portfolio — capture and qualify first, route and educate second.

The design, question flow, and routing logic are **already decided and approved-direction** — do not redesign them. Build to the spec.

## Source of truth (read before coding)
- `SPEC.md` — screens, flows, key moments, acceptance criteria
- `data/questions.json` — the exact questions, chips, and skip rules
- `data/routing.json` — domain × tier routing matrix + ordered overrides
- `data/solutions.json` — what we say about each solution and when it surfaces
- `data/campaigns.json` — the 5 campaign entry points and their pre-seeded openers
- `data/brand.json` — colors, type, logo rules (from the Stagwell brand guide)
- `reference/` — wireframe + flow-chart images (visual target) and the source PDFs

The JSON files are the contract: render questions, routing and solution content **from the data files**, never hardcoded in components, so the client can tune copy and logic without code changes.

## Non-negotiable product rules
1. **One input.** The landing has a single prompt box (plus suggestion chips that pre-fill it). No second field. A website in the visitor's first message answers the company question and starts research.
2. **Capabilities, not tool names**, in visitor-facing diagnostic copy. Product names appear on solution cards and at routing — never inside the snapshot modules.
3. **The snapshot is free to view.** Email is asked only at the reveal, with an explicit "It's OK to contact me about these results" checkbox. PDF download unlocks after capture. Declining keeps the on-screen snapshot (anonymous session).
4. **Attribution is captured silently on entry** (UTM/campaign/product interest) and travels through every handoff.
5. **If routing = self-serve, the trial CTA dominates** the routing screen; other paths collapse to text links.
6. **A visitor who asks for a human gets one** — converts the route to a booked conversation.

## Suggested stack (adjust if you have better judgment)
- Next.js (App Router) + TypeScript, single deployable demo
- Conversation: an LLM-backed agent (env `ANTHROPIC_API_KEY` or similar) driven by `data/questions.json` slots — deterministic slot-filling with LLM free-text classification into domains; fall back to pure chip-driven state machine if no key is set (demo must work offline)
- Snapshot: mock data generator seeded from the entered company/domain (fictional but plausible numbers); optional live enrichment later
- Imagery: optional generation via xAI API (env `XAI_API_KEY`) — never commit keys; see `.env.example`
- No real CRM: log capture/routing events to a visible "HubSpot event console" panel or localStorage, so the tracking story is demoable

## Demo script to satisfy (see SPEC.md for detail)
1. Master-ad landing → chip "Reach better audiences" → 4 more questions (size pre-confirmed from website) → snapshot → email+consent → consultative recommendation (multi-product example)
2. Product-ad landing (`?utm_campaign=targeting-machine`) → pre-seeded opener → fewer questions → demo route
3. SMB founder, "I want to run a quick survey" → self-serve route with dominant trial CTA
4. "Just exploring" → nurture (no meeting push)
5. Decline email → keeps snapshot, anonymous session logged

## Brand
Montserrat (semi-bold headlines / regular body), Spectral semi-bold italic for accent words only. Colors in `data/brand.json` (marigold #FFB81C, light blue #009CBD, navy #003349, bright white #F5F7F6, glacier grey #C5C6C7, black #212322). Logo rules: never recolor/rotate/frame; full-color logo never on busy or dark backgrounds.

## Known placeholders (build with visible [PLACEHOLDER] markers)
Agent Cloud + NewVoices positioning blocks and chip sets; ad headlines (mirror campaign creative when it lands); proof points/client logos; GEOPulse self-serve packaging [confirm].
