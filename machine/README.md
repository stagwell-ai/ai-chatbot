# Stagwell AI — The Machine

An interactive, high-fidelity prototype of an AI-first landing experience for
Stagwell.ai. Not a website: a workspace you enter.

The visitor types one company website. The machine reads it, infers the
business, then asks only what it cannot know — whose site that is, which lens
to lead with, and where to send the result. It reads the answers back for
correction, then builds a personalised Executive AI Brief.

## The conversation

Six or seven beats, never more. Branches change *which* questions get asked,
not how many.

| Beat | Runs when | Forks into |
| --- | --- | --- |
| `website` | always | known brand → real facts · anything else → inferred |
| `relationship` | always | **owner** · **duel** · **recon** · **category** |
| `viewerSite` | competitor path only | gives the second half of a head-to-head |
| `focus` | always | one or two of six lenses |
| `followup` | always | **six different questions**, one per lens |
| `role` | owner and duel only | board or leadership altitude |
| `email` | always | gated — no address, no brief |
| `confirm` | always | editable read-back, then build |

The mode set at `relationship` decides the pronouns throughout, who the
subject of the report is, and whether `viewerSite` and `role` run at all.
Answering "they're a competitor" and then giving your own site flips the
subject to you and makes the rival benchmark number one.

The lens chosen at `focus` picks the follow-up question, hoists its section to
the top of the brief (or opens that tab first in version B), and reorders the
ranked opportunities. Free text is matched on intent and then quoted verbatim
in the executive summary.

## Running it

No build step, no dependencies. Any static server:

```bash
npx http-server . -p 8177 -c-1
```

Then open http://localhost:8177

## Presenting it

| URL | Opens |
| --- | --- |
| `/` | The experience from the top |
| `/b.html` | Version B — the same machine as a landing page and dashboard |
| `/?brief=nike.com` | Straight to a finished brief |
| `/?brief=nike.com&focus=ai&q=best+running+shoes+for+flat+feet` | A brief leading on a tested prompt |
| `/?brief=adidas.com&rel=rival&vs=nike.com&who=Julian&focus=versus` | A head-to-head for a named prospect |
| `/?view=partners` | Any sidebar section (`whatwedo`, `mission`, `research`, `partners`) |

Deep-link parameters: `brief` / `dash` (subject), `rel` (`owner`, `rival`,
`observer`), `vs`, `focus` (`ai`, `versus`, `perception`, `recent`, `growth`,
`risk` — one or two, comma-separated), `q` (tested prompt), `window`, `who`,
`email`.

- **Start new analysis** (top right, or the sidebar) resets everything in place.
- Clicking anywhere, or pressing Enter, fast-forwards the AI's typing —
  useful when presenting live.

## What is real and what is not

This is a **scripted demonstration**. No model is called and nothing is
submitted or stored. Every answer is matched against a fixed script — but which
questions the script asks, and how the brief is written, do genuinely change.

Nothing is emailed: the delivery beat captures an address and the brief renders
on screen. Wiring a real send is a backend job that does not exist yet.

Real: the Future of News content, the twenty-eight partner organisations, the
nine HarrisX studies, the Mark Penn quote, and the company facts for the
brands in `KNOWN` (shared.js).

Illustrative: every score, percentage and projection. Figures are derived
deterministically from the domain so a given company always scores the same.

## Structure

```
index.html   markup, the SVG symbols, and all static section copy
styles.css   design tokens and every component
shared.js    reference data, the inference, the conversation data, the analysis
app.js       version A — the workspace: conversation script and brief generator
b.js         version B — the landing page: same script, dashboard output
assets/      Stagwell marks, partner logos, self-hosted fonts
```

Source materials live in Google Drive at
`shared_projects/stagwell/2026/stagwell ai/mats/`.
