# Stagwell AI

**Read `AGENTS.md` first** — it is the brief for working in this repo and it
applies here in full. `KIMI.md` is the long architecture document.

The five rules, in brief, so they are never more than one file away:

1. **Never add `"type": "module"` to `package.json`.** It breaks the Vercel
   functions and the browser scripts. Node will suggest it; ignore Node.
2. **`data/solutions.json` display names are matched against a HubSpot
   dropdown character for character.** A rename breaks lead routing until the
   CRM is changed too.
3. **A product's name lives in `solutions.json`, `explainers.json` and the
   generated page.** Change one, grep for the others.
4. **A failing test is information.** Make it assert the requirement, never
   the copy.
5. **No tracker loads before consent** — go through `SAICONSENT.whenGranted`.

`/` rewrites to `next/home-c.html`, not `index.html`.
Run `npm test` (194 tests, no setup) before pushing.
