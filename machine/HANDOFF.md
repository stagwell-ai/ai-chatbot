# Handoff — integrating this build into the parent repository

This zip is the latest build of the Stagwell AI demo, developed on a fork of the parent
repository. It descends from the parent's **product A** lineage and is **~17 commits of
work ahead** of the commit it forked from (`d424a5a`, "Fix Research in the brief…").
It is currently live at https://stagwell-ai-julian.vercel.app for reference.

Read `PRODUCT-CHANGES.md` for the full account of what changed and why. This file is the
practical integration guide.

## What is in this build

```
index.html    product A, workspace presentation — conversation → Executive AI Brief
b.html        product A, landing-page presentation — same brain, dashboard output
shared.js     the shared brain: data, inference, analysis, live-call helpers
app.js        version A logic          b.js  version B logic
styles.css    tokens + all components  b.css version B overrides
upgrades.html/.css/.js   consumer changelog page with a live demo widget
api/ask.js    Vercel serverless function — the ONLY backend; all live-model calls
assets/       fonts (self-hosted), 28 partner logos, brand marks, share kit (og.png, icons)
README.md     how to run and present   PRODUCT-CHANGES.md  the full change log
```

No build step, no dependencies, any static server — **except** `api/ask.js`, which needs
a serverless host (it is written for Vercel's zero-config `api/` convention).

## Integration guidance (read before merging)

1. **Prefer wholesale replacement over line-merging** for every file listed above. This
   build is far ahead of the fork point; a textual merge against the parent's A will
   produce hundreds of conflicts that all resolve to "take the new version". `index.html`,
   `app.js`, `b.html`, `b.js`, `shared.js`, `styles.css`, `b.css` are a matched set —
   take all or none.
2. **`shared.js` is load-bearing for both presentation surfaces.** Do not split or merge
   it with parent variants; both `app.js` and `b.js` destructure ~40 exports from it.
3. **Filename collisions with other products (C, etc.):** if another product in the repo
   uses the same filenames (`styles.css`, `app.js`…), move THIS build into its own
   directory rather than renaming its internals. All asset references are relative
   (`./assets/…`), so the whole set relocates cleanly into e.g. `/a/`. Two exceptions to
   check after moving:
   - `api/ask.js` must stay at the repo root's `api/` directory (Vercel convention), and
     the client calls it by absolute path `/api/ask` — which keeps working from any
     subdirectory on the same domain.
   - `upgrades.html` and the share-kit meta tags hardcode the old production host
     (`stagwell-ai-julian.vercel.app`) in `og:url`/canonical links — update these to the
     new host when the final URL is known.
4. **The `V0 | A B` corner switcher** in `index.html`/`b.html` links out to
   `stagwell-ai-ruby.vercel.app` (the pre-fork build). Repoint or remove once the master
   landing page exists — the landing page supersedes it.

## Environment variables (required for the live features)

Set on the hosting project (Vercel → Settings → Environment Variables). Without them the
demo still works fully — every live surface silently falls back to scripted copy.

| Var | Value |
| --- | --- |
| `LLM_API_KEY` | ask the person who sent you this zip — do not guess |
| `LLM_BASE_URL` | `https://api.kimi.com/coding/v1` (default if unset) |
| `LLM_MODEL` | `kimi-for-coding-highspeed` (default if unset) |

Gateway quirks (already handled in `api/ask.js`, do not "fix" them): temperature must be
exactly 1; it is a reasoning model whose hidden reasoning can consume 1,800+ tokens before
the answer, so chat mode runs `max_tokens: 3200`; an exhausted budget returns an empty
string, not an error.

## Verifying a deployment

```
curl -s -X POST https://<host>/api/ask -H 'Content-Type: application/json' \
  -d '{"prompt":"best running shoes for flat feet","brands":["Nike","Adidas"]}'
# expect: {"ok":true,"answer":"…","named":[…],"model":"…","ms":…}
```

Then one full click-through: type `nike.com` → "That's us" → "How AI describes us" →
type a buying question → any role → any email → Build. The brief should show: a live
answer card in the conversation, "Named in N of 3" audit, three quotes badged Live, a
summary with a receipt line, the projection slider, a Board view button, and an "Ask the
machine" section that genuinely answers.

## House rules that must survive any merge

- **The honesty boundary**: anything from a real model is badged with model + latency +
  "unscripted"; anything hashed/scripted is never badged. These must never blur.
- Every live call falls back silently. No error state ever renders.
- All model output passes through `esc()` before touching innerHTML.
- The endpoint has **no rate limit**. Add one before the URL circulates publicly.
- Do not commit API keys anywhere; `.gitignore` already covers `.env*` and `.vercel`.
