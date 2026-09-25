# Stagwell.AI — the design system as built

The brand board (Concept Final V3.1) is a direction: logo, six colours, Montserrat, a few
textures. Everything below is the set of decisions this site made on top of it, written down
so the next reviewer can review a system rather than a page. Tokens live in
`machine/styles.css` `:root`; the words live in `data/brand.json`.

## 1. Room

| role | token | value |
|---|---|---|
| page | `--paper` | #071A24 |
| card | `--surface` | #0C2331 |
| raised / hover | `--surface-2` | #12303F |
| band | `--band` | gradient #0E5F8E → #003349 → #062230 |
| ink | `--ink` | #F1FAFF |
| secondary ink | `--ink-2` / `--ink-3` / `--ink-4` | 86% / 68% / 40% of ink |
| lines | `--line` / `--line-2` | 10% / 18% of ink |

**Section rhythm.** The landing alternates: page (hero) → card surface (What is) → page
(carousel) → band (closing CTA). Every section carries a hairline top rule and padding of
`clamp(88px, 13vh, 160px)`; bands `clamp(104px, 15vh, 192px)`. Card grids use a 20px gap.

**The one light object.** The chooser and the conversation panel carry their own light room
(scoped tokens on `.pick, .chat` in `machine/hero.css`): white pane, #F5F7F6 card, navy ink.
It is the thing to interact with, so it is the only thing that is light. Nothing else on the
site is white.

## 2. Colour

| token | hex | job |
|---|---|---|
| `--orange` | #FF6D24 | THE accent: the AI in the logo, the accent word in a headline, the primary button, big numbers |
| `--teal` | #009CBD | live / agent markers, links on light, the mark |
| `--cyan` | #77E3F6 | text links on the dark room (11:1), focus ring, the lattice |
| `--blue` | #0E5F8E | user bubbles, selected states, secondary solid buttons |
| `--amber` | #FFB81C | the mark, self-service category, progress fills — never a button |
| `--navy` | #003349 | text on orange / marigold, the light card's ink |

Category colour code (from the board): orange = Stagwell Machines, cyan = Purpose-Built
Solutions, marigold = Self-Service Platform. Used on the tier cards' top bar and eyebrow.

Rules: navy text on orange and marigold, never white. Orange text only on the dark room.
Semantic colours (the console's ok / warn) are separate from the accent.

## 3. Type

One family: **Montserrat**. 600 for headlines, 500 for labels and nav links, 400 for body,
300 for the all-caps eyebrow. The accent word in a headline is 600 in orange, upright.
Labels (eyebrows, chips, meta lines) are Montserrat at `--t-label` with `.12em` tracking —
the `--mono` role resolves to Montserrat everywhere a visitor reads. The demo console alone
keeps a real monospace (Geist Mono), because it is a presenter tool that imitates a CRM log.

Scale: `--t-display` (hero) → `--t-h1` → `--t-h2` → `--t-lede` → `--t-body` → `--t-sm` →
`--t-xs` → `--t-label`. Running text stays under 66ch.

## 4. Texture

- **Grain** (`--grain`): 2.6% noise on every surface. Invisible as a texture; adds depth.
- **Lattice** (`--nodes`): one figure per 320px tile at 7% lines / 18% dots. Appears on the
  hero and the closing band only. Off entirely under 860px.
- **Glow** (`--glow`): teal top-left, orange bottom-right, hero only.

## 5. Components

- **Primary button** `.btn--gold`: orange, navy text, uppercase 600 with .07em tracking,
  44px tall (the class name is legacy; do not rename — tests and JS address it).
- **Solid secondary** `.btn--dark`: ink background, navy text. **Ghost** `.btn--ghost`.
- **Cards**: `--surface` on the page, `--paper` inside a `--surface` section, 1px `--line-2`,
  radius `--r-lg`, padding 26–30px. A category bar (3px) at the top when the card belongs to
  a tier.
- **Chips / rows**: pill, `--line-2` border, selected = `--blue` fill with light ink.
- **Bands**: `--band` gradient, `--on-void` ink, one accent word in orange.
- **Nav**: sticky, 76px, four links in Montserrat 500 ink + one primary button. The footer
  repeats every route.
- **Lightbox** `.vbox`: 86% scrim, 16:9 box, native controls, Escape closes.

## 6. Motion

Word-by-word blur reveal on the hero headline; 800ms ease-in on hero copy; chips fade in
60ms apart. Nothing loops except the carousel clips, and those stand still under 860px.
`prefers-reduced-motion` turns all of it off.

## 7. Mobile

- Lattice off. Hero glow stays.
- Tier cards become one swipeable row (84% width, scroll-snap).
- Carousel clips are posters; tap to play.
- The chooser's detail pane has no max-height; the list stacks above it.
- Type floor 16px in inputs (iOS zoom).
- Known gap: the demo chrome (console pill, previous-versions link) is fixed-position and
  overlaps the bottom of the chooser on small phones. It is presenter chrome; hiding it on
  phones is a one-line decision left to the client.

## 8. Honesty

Illustrative figures wear an "Illustrative" tag. Anything not yet confirmed by a product
team is shown in `[brackets]`. Proof points from the messaging framework carry its own
"pending validation" line. Generated imagery (Seedance clips, the hero illustration) is a
placeholder by the client's decision, Sep 2.
