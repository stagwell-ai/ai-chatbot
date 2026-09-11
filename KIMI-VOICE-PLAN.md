# Voice for the chat — plan

*Stagwell.AI homepage chat, 2026-09-11. Client brief, verbatim:*

> Make a plan where the chat box has a button for chat with me. And the default logic is GPT
> not Kimi. And the text chat and the voice chat stay in sync. Meaning: when I talk it types out
> what I say and when the AI agent talks it also types what it says. The user can type responses
> and the voice agent will respond via voice as long as the voice session is open. Think of all
> the use cases. The edge cases. There should also be a visual sound bubble thing with wavy lines
> that represent the agent talking and the users talking. It should also work on mobile.

The OpenAI key on the project can mint Realtime sessions today (`gpt-realtime`,
`gpt-realtime-2.1`, `gpt-realtime-mini` — verified 2026-09-11 via `/api/ask?health=1&models=1`).

**Status, 2026-09-11 — Phases 1 and 2 shipped** (client: "just start working on it, make sprints
and do QA and do it all in a loop"). Sprint 1: mint endpoint, brief, reducer, tools — 16 unit
tests, live mint verified. Sprint 2: the browser client, the strip, one thread for voice and text,
19 pages — a fake-peer Playwright suite. Sprint 3: the edge cases in §5 — caps, silence, tab
hidden, tap-to-hear, reconnect and give-up, the fast track by voice, plus the docs (KIMI.md §4f).
Defaults taken where §10 asked for a decision: `gpt-realtime`, `marin`, all pages, 10/15 min and
6 mints/IP/hour, the consent line as written; text-only primary → `openai/gpt-4o-mini`. Still
theirs: rotate the OpenAI key; the first real spoken session on a phone against production
(this box cannot reach OpenAI). Phase 3 (hand-off into the New Voices phone agent) not started.

---

## 0. The one idea

**The thread is the single source of truth. Voice is a second way in and out of the same
conversation — not a second conversation.**

Everything the visitor says, by voice or by keyboard, becomes a "me" bubble. Everything the agent
says, spoken or not, becomes an AI bubble. The nine-step order, the recommendation, the lead, the
HubSpot write and every analytics event are the ones that exist today; voice changes *how* the
turns arrive, not what the conversation is.

That decision resolves most of the edge cases below before they start.

---

## 1. What the visitor sees

```
┌──────────────────────────────────────────────────────────────┐
│  …thread…                                                     │
│  ● What's your website? I'll take a quick look…               │
│                                              acmehotels.com   │  ← spoken; typed out
│  ● Here's what I can see about Acme Hotels: [fact list]       │  ← spoken; typed out as it speaks
│                                                               │
│ ─────────────────────────────────────────────────────────────  │
│  ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿  Listening…                                 │  ← the sound bubble
│  yourcompany.com                                              │  ← composer, still typable
│  ↻ Start over        🎙 Chat with me ▾   [mute] [end]     ↑    │
└──────────────────────────────────────────────────────────────┘
```

**Button.** "🎙 Chat with me" sits in the composer bar next to Start over. Before a session it is
the call to action; during one it becomes the session control: a live dot, **Mute** (mic off, agent
still audible), **End** (back to text; the thread stays). One tap starts; no modal, no page.

**The sound bubble.** A single wave strip above the composer, inside the card, that is *always
there while a session is open* — it is the visitor's proof the mic is live and the agent is real:

| State | Wave |
|---|---|
| idle / listening for you | flat line with a slow breath |
| **you talking** | ink-coloured wave, amplitude from your mic (Web Audio `AnalyserNode` on the local track) |
| agent thinking | the existing dot-lattice "thinking" motion from the hero, compressed into the strip |
| **agent talking** | brand-teal wave, amplitude from the remote audio track |
| both at once (barge-in) | teal collapses to flat within ~150 ms; ink takes over |
| muted | flat, dimmed, with a struck-through mic glyph |
| reconnecting | dashed line pulsing |

Drawn on a `<canvas>` with `requestAnimationFrame`, capped at 30 fps on phones, paused when the
tab is hidden. One component, `next/voice-wave.js`, that takes two `AnalyserNode`s and a state.
Reduced-motion users get the states as colour and a caption, no waves.

**Transcripts.** Your speech appears as a grey, italic "me" bubble that fills in while you speak
and settles to normal type when the transcription is final. The agent's words stream into its
bubble as it speaks them — the text is never ahead of the voice by more than a phrase. If you cut
the agent off, its bubble keeps what was actually said and ends with "—".

**Typing during a session.** The composer never closes. Type and send: the agent answers **by
voice and text**, exactly as if you had spoken. Your typed line is not read aloud. If the agent is
mid-sentence when you send, it stops.

**Cards, fact lists, forms, the Book a call button** render exactly as today, as the agent reaches
those steps. The agent *says* what it is showing ("I've put what I know about Acme Hotels below")
rather than reading a table aloud.

**Mobile.** The strip is 44 px tall, the controls are 44 px targets, and the on-screen keyboard
does not hide the strip (it sits with the composer, which is what the keyboard pushes up). Start
requires a tap — no autoplay, no mic without a gesture. Route changes (headphones in/out) and
screen lock are handled (§5).

---

## 2. "Default logic is GPT, not Kimi"

Two things, both one setting away:

1. **In a voice session GPT is the brain — necessarily.** Speech-to-speech is one model
   listening and talking; you cannot put a second model between its ear and its mouth. So while
   voice is open, `gpt-realtime` drives the conversation for *both* modalities — typed turns
   included — and the Kimi flow becomes the **guardrails and the hands**: it holds the nine
   steps, computes the recommendation, writes the lead, fires the events (§3).
2. **In text-only mode the chain's primary slot moves to OpenAI.** `KIMI_PRIMARY_MODEL=
   openai/gpt-4.1-mini` (or `gpt-4o-mini`) with the Kimi gateway as the fallback slot. The broker
   already supports this (`api/_lib/llm/broker.js`); it is an environment variable, no code.

Kimi stays the internal name of the engine. Nothing on the page says either name.

---

## 3. Architecture

```
browser ──WebRTC (audio both ways + data channel)──▶ OpenAI Realtime  (gpt-realtime)
   │                                                    ▲
   │  POST /api/voice/session  ──▶ Vercel fn ── mints ──┘  ephemeral client secret (~60 s to connect)
   │        (rate-limited, no key ever leaves the server)
   │
   ├── next/voice.js         session lifecycle, WebRTC, data-channel events → thread + flow
   ├── next/voice-wave.js    the sound bubble
   ├── next/kimi-flow.js     UNCHANGED state machine: steps, recommendation, lead, events
   └── next/hero-agent.js    renders the thread (today's code; two new bubble states: interim, cut-off)
```

**Why WebRTC, not WebSocket:** the browser does echo cancellation, noise suppression, jitter
buffering and playback for free; audio never touches our server (no streaming bill, no PII in our
logs); it is what OpenAI recommends for browsers and what works on iOS Safari.

**Session config (server-side, in the mint call):**
- `model: gpt-realtime` (quality) — `gpt-realtime-mini` is the cost lever, one string
- `voice`: one brand voice, chosen once (candidates: `marin`, `cedar`); never changes mid-session
- `instructions`: assembled **server-side from the same JSON the text flow uses** — the nine
  steps, the catalog (names, one-liners, capability tags — nothing else), the house rules (never
  invent a fact about a company or product; product URLs only from the catalog; English unless the
  visitor speaks otherwise; short spoken sentences; say what you are showing, don't read tables)
- `tools`: the flow's hands (below)
- `audio.input.transcription: gpt-4o-mini-transcribe` — so the visitor's words come back as text
- `audio.input.turn_detection: semantic_vad` — turns end when the *thought* ends, not on a pause
- `max_output_tokens` per response, `expires_after` on the secret, a session cap (§6)

**The tools — how GPT drives and Kimi keeps it honest.** The model cannot change the state
directly; it calls a tool, the browser runs it against `SAIKIMI`, the result comes back, the
model speaks it:

| Tool | Runs | Returns to the model |
|---|---|---|
| `set_problem(text, goal?)` | `SAIKIMI.start({ initialText })` | detected goal/intents, next step |
| `set_website(domain)` | the website answer → `/api/ask mode:research` | the fact list (or "not known"), so it can say it — and it is rendered as the card |
| `set_company_size(band)` / `set_role(band, text)` | the answers | next step |
| `show_recommendation()` | `recompute()` + cards rendered | product names + one-liners to say |
| `capture_email(email)` | validate → `POST /api/lead` (create) | ok / "that address did not look right" |
| `capture_phone(phone)` | validate → `POST /api/lead` (update) | ok / retry once / skipped |
| `offer_booking()` | the Book a call bubble | done |
| `request_contact(kind)` | the fast track (`call`, `demo`, `trial`, `expert`, `pricing`) | the form is shown |
| `start_over()` | `SAIKIMI.reset()` + thread cleared | fresh |

Every tool call is also the step the text flow would have taken, so **the nine-step order, the
analytics events, the lead payload and HubSpot writes are byte-for-byte the same** as a typed
conversation. A voice conversation that ends after step 7 has still created the contact.

**Text turns while voice is open** are sent on the data channel as a
`conversation.item.create` (user text) + `response.create` → the model answers in audio + text.
If a response is in flight: `response.cancel` + `output_audio_buffer.clear` first.

**Voice fallback.** If the mint fails, WebRTC fails, or the session dies and cannot reconnect,
the conversation **continues in text** with today's flow — the thread is intact, the state is
intact; the strip says "Voice is unavailable — carry on typing" and the button offers to retry.

---

## 4. Use cases

1. **Cold start by voice.** Tap Chat with me → permission → "Hi — what are you trying to solve?"
   (spoken and typed). The six pills stay visible; tapping one is a turn like any other.
2. **Text first, voice later.** Two typed turns in, tap the button: the session starts with the
   thread so far in its context (a compact summary + the state's known fields), and the agent
   picks up mid-conversation without re-asking.
3. **Voice first, finish by typing.** Email and phone are error-prone by ear: at step 7 the agent
   says "easiest to type it — I've set the keyboard up" and the composer switches to
   `inputmode=email`; spoken addresses are still accepted but read back and confirmed
   ("ada at acmehotels dot com — right?").
4. **Mixed, turn by turn.** Speak the website, tap a size pill, type the role, hear the cards
   described, type the email, say the phone number. Every turn lands in the same thread.
5. **Barge-in.** The visitor talks over the agent: the agent stops within a phrase, its bubble
   ends with "—", the visitor's words become the next turn.
6. **The fast track by voice.** "Just have someone call me" → `request_contact('call')` → the
   form appears; the agent says so and stops talking while they fill it in (the mic stays open).
7. **Small talk / off-topic.** Answered in kind by the model, but the *state* does not move
   (no tool call) — same rule as the text hold today.
8. **Reading the product page.** Pointer/Learn-more links open in a new tab (already the rule);
   the session stays alive in the original tab. On return the agent has not spoken into the void
   — it waits for a turn.
9. **Start over.** Ends the audio response, resets the flow, clears the thread, keeps the session
   open with fresh instructions ("we're starting again") — or ends the session, on request.
10. **Product pages.** The same composer exists on all 19 pages; the button appears wherever the
    composer does, with the product pre-known to the agent.
11. **Deaf / hard of hearing / no speakers.** Mute the *agent* (speaker off) and keep the
    transcript: voice in, text out. Everything the agent says is always on screen.
12. **Hands-busy / can't type.** Mic on, keyboard never touched, including email by voice with
    read-back confirmation.
13. **Another language.** The model answers in the language it hears. The catalog facts stay
    English (names, capability tags); the lead carries a `language` field.
14. **Return visitor.** Session storage remembers a session was used; the button is presented the
    same way (no auto-start — ever).

---

## 5. Edge cases and what happens

**Permissions & devices**
- Mic permission denied → strip says why, button becomes "Allow the microphone to talk"; text
  continues. Denied *permanently* (browser setting) → a one-line how-to for that browser.
- No microphone at all → the button is hidden; nothing else changes.
- Non-secure origin (http) → button hidden (getUserMedia requires https; localhost is fine).
- Headphones plugged/unplugged, Bluetooth route change → WebRTC follows the default device; the
  wave keeps drawing from the same tracks. iOS may pause the remote track on route change: we
  resume it and, if it will not resume without a gesture, show "tap to continue".
- Autoplay blocked (remote audio arrives before any gesture — should not happen since the tap
  starts everything, but Safari has moods) → "Tap to hear" on the strip.

**Network & session**
- Mint fails (rate limit, key problem, OpenAI down) → text continues; retry button; event
  `voice_unavailable {reason}`.
- Connection drops mid-session → 3 reconnect attempts over ~10 s with the wave dashed; on
  success the new session is primed with a summary of the thread + the flow state, and the agent
  resumes from the *current step* without re-asking what it already has. On failure → text
  continues, "Voice dropped — carry on typing, or tap to reconnect".
- Ephemeral secret expires before connecting (slow phone) → mint again, transparently, once.
- Session length cap (10 min soft, 15 hard): at 10 min the agent says the rest is quicker to type
  and the session closes cleanly; the thread and state survive.
- Silence: no speech for 45 s → "Still there?" once; 90 s → mic muted (not closed) with a tap to
  resume, so an abandoned tab does not run a bill.
- Tab hidden / screen locked → mic muted and the wave paused; on return, un-muted with a tap.
- Two tabs → each has its own session; nothing is shared (as today).
- Clock skew / very slow device → the wave degrades to the state colours; transcripts still flow.

**Conversation**
- Both talk at once → semantic VAD plus `response.cancel` on speech start; the agent yields.
- Typing while the agent speaks → the send cancels the speech (same path as barge-in).
- Speaking while typing → the spoken turn is a turn; the draft in the composer is kept.
- Long monologue from the visitor → transcribed as one bubble; the model responds when the
  thought ends (semantic VAD), not at the first pause.
- The model tries to "answer" step 6 itself → it cannot: recommendations come only from
  `show_recommendation()`, which runs the same scorer as today; the instructions say so and the
  browser refuses to render a product the catalog does not have.
- The model invents a fact about the visitor's company → the instructions forbid it, and the
  only company facts it is *given* are the lookup's; the fact list rendered is the lookup's, not
  the model's words. Same rule as the text flow, enforced in the same place.
- Email by voice mishears ("at" / "dot", names) → read back, confirm, else "easiest to type it";
  the composer is already in email mode. Never sent to HubSpot until it passes today's validation.
- Phone by voice → digits confirmed back; the same once-more-then-move-on rule as text.
- Fast track by voice → the form appears; voice capture of name/email/phone is *not* attempted
  into the form (too error-prone); the agent says the form is below and waits.
- Profanity / abuse → the model's own moderation; the state does not move; no special UI.
- The visitor asks the agent to *do* something outside the brief (book flights) → steered back,
  as the text prompt already does.
- Start over mid-speech → `response.cancel`, flow reset, thread cleared, agent told to greet
  again; the generation counter from today's Start over drops any stale event.

**Privacy & compliance**
- Consent line under the button before the first session: "Voice conversations are transcribed
  so you can read them here and so the right team can follow up. Privacy notice." One tap = ok.
- Audio never touches our servers; transcripts are what the browser shows, and the lead payload
  is the structured state (as today) — **not** the transcript. The sales summary stays the
  structured one.
- Full email addresses never reach the analytics bus (today's redaction covers the new events).
- The key never reaches the browser: only a ~60-second ephemeral secret does. The mint endpoint
  is rate-limited per IP (6/hour) and sessions are capped (§6), so nobody can run up a bill from
  a URL.

**Accessibility**
- The strip has `role="status"` with the state as text ("Listening", "Agent speaking", "Muted").
- Transcripts are in the existing `aria-live` thread.
- Everything reachable by keyboard: button, mute, end.
- `prefers-reduced-motion`: no waves, state by colour and caption.

---

## 6. Cost and caps

Order of magnitude only — verify against OpenAI's pricing page before launch: a 5-minute
`gpt-realtime` conversation is on the order of a few tens of cents; `gpt-realtime-mini` roughly a
fifth of that. Caps in the mint endpoint and the session: 10 min soft / 15 hard, 6 sessions per
IP per hour, `max_output_tokens` per turn, silence mute at 90 s. A daily spend alarm on the
OpenAI project. Analytics: `voice_session_started/ended {seconds, turns, reason}` gives the real
number after a week.

---

## 7. Files

| File | Purpose |
|---|---|
| `api/voice/session.js` (new) | mint the client secret; instructions + tools assembled from `data/*.json`; rate limit; never returns the key |
| `api/_lib/voice/instructions.js` (new) | the spoken-agent prompt, from the same catalog and copy as text; unit-tested for "no invented facts", "all nine steps present" |
| `next/voice.js` (new) | session lifecycle, WebRTC, data-channel event reducer → thread + `SAIKIMI` tool dispatch; reconnect; caps |
| `next/voice-wave.js` (new) | the sound bubble |
| `next/hero-agent.js` | interim and cut-off bubble states; the button and controls; composer inputmode already exists |
| `next/kimi-flow.js` | no change to the state machine; a thin `SAIKIMI.tools` map exposing the steps as callable functions |
| `next/home.css` | strip, controls, states, mobile |
| `data/kimi.json` | `flags.voice`, `voice.copy` (every visible string), consent line |
| `KIMI.md` | §4f Voice |

---

## 8. Testing

- **Unit (node):** the event reducer (Realtime events → thread ops and tool dispatch) is pure and
  fully tested with recorded event fixtures: interim → final transcript, streamed agent text,
  cancel mid-response, tool call round-trip, reconnect priming.
- **Instructions builder:** contains all nine steps in order; every product named exists in the
  catalog; no URL that is not in the catalog; the house rules present.
- **Browser (Playwright):** Chromium's fake media (`--use-fake-device-for-media-stream`,
  `--use-fake-ui-for-media-stream`) plus a **fake Realtime peer** (a local server speaking the same
  event protocol over a data channel stand-in) — so the whole UI, the wave states, the sync
  rules, barge-in, mute, end, Start over, permission-denied and reconnect run green here without
  OpenAI. Desktop and 390×844.
- **Real thing:** this sandbox cannot reach OpenAI directly, so the live check is a Vercel
  preview URL that the client (and I, via the function) exercise — phone in hand for iOS Safari.
  A checklist of the §4 use cases for that pass.

---

## 9. Phases

**Phase 1 — it talks (2–3 days).** Mint endpoint; WebRTC session; transcripts both ways in the
thread; typed turns spoken back; the wave with the four main states; mute/end; permission and
mint failures fall back to text; nine steps via tools; desktop Chrome/Safari + iOS Safari +
Android Chrome; the unit and fake-peer suites.

**Phase 2 — it copes (1–2 days).** Barge-in polish; reconnect with priming; silence and length
caps; consent line; email/phone read-back and the keyboard hand-off; analytics; the spend alarm;
KIMI.md.

**Phase 3 — it hands off (later).** "Call me now" from a voice session into the New Voices phone
agent, briefed with the transcript summary — the site's own product finishing the conversation.

---

## 10. Decisions needed before Phase 1

1. **Text-only default.** Confirm: primary slot → OpenAI (`gpt-4.1-mini` or `gpt-4o-mini`),
   Kimi gateway as fallback. (One env var.)
2. **Voice model.** `gpt-realtime` for quality, or `gpt-realtime-mini` for cost, for the
   prototype.
3. **The voice.** I'll send three 10-second samples of the same line; pick one.
4. **Where.** Homepage only for Phase 1, or all 19 pages with the composer.
5. **Session caps.** 10/15 minutes and 6 sessions per IP per hour as proposed?
6. **Consent line wording** — legal may want a look.
7. **Rotate the OpenAI key first.** It was pasted in chat; a key that can mint voice sessions is
   an expensive leak. Ten minutes in the OpenAI dashboard, then one `vercel env add`.
