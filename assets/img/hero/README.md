# Hero artwork

Drop the landing page's default illustration here — the one that fills the
picker's right-hand pane before the visitor selects a row.

    assets/img/hero/agent.png        (or .jpg / .webp — any of the three)

Then point the data contract at it, in `data/questions.json`:

    "hero": {
      "emptyImage": "/assets/img/hero/agent.png",
      ...
    }

`machine/hero.js` prefers that file over its built-in drawn illustration, so
no code changes. Set `emptyImage` back to `null` to return to the drawing.

Notes:
  · the pane is ~480px wide, so anything above ~1200px wide is wasted weight;
  · a white background is fine — the CSS blends it into the pane (multiply);
  · set `hero.emptyImageAlt` if the default alt text doesn't describe it.
