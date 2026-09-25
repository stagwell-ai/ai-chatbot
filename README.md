# Stagwell AI — The Machine

An interactive, high-fidelity prototype of an AI-first landing experience for
Stagwell.ai. Not a website: a workspace you enter.

The visitor types one company website. The machine reads it, infers the
business, asks a single goal-oriented question, prepares a brief, and reveals
a personalised Executive AI Brief.

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
| `/?brief=nike.com` | Straight to a finished brief |
| `/?brief=nike.com&vs=Adidas,On%20Running&who=Julian&focus=AI%20opportunities` | A brief for a named prospect |
| `/?view=partners` | Any sidebar section (`whatwedo`, `mission`, `research`, `partners`) |

- **Start new analysis** (top right, or the sidebar) resets everything in place.
- Clicking anywhere, or pressing Enter, fast-forwards the AI's typing —
  useful when presenting live.

## What is real and what is not

This is a **scripted demonstration**. No model is called and nothing is
submitted or stored. Whatever the visitor types, the journey is the same.

Real: the Future of News content, the twenty-eight partner organisations, the
nine HarrisX studies, the Mark Penn quote, and the company facts for the
brands in `KNOWN` (app.js).

Illustrative: every score, percentage and projection. Figures are derived
deterministically from the domain so a given company always scores the same.

## Structure

```
index.html   markup, the SVG symbols, and all static section copy
styles.css   design tokens and every component
app.js       reference data, the conversation script, and the brief generator
assets/      Stagwell marks, partner logos, self-hosted fonts
```

Source materials live in Google Drive at
`shared_projects/stagwell/2026/stagwell ai/mats/`.
