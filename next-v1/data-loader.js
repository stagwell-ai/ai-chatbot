/* ═══════════════════════════════════════════════════════════════════════════
   DATA SPINE — the demo kit's JSON files are the contract (SPEC.md):
   questions, routing, solutions, campaigns and brand all render from
   /data/*.json so copy and logic change without touching code.

   window.STAGDATA resolves to { questions, routing, solutions, campaigns,
   brand, messaging }. Consumers must await it (or .then) before reading. A fetch
   failure resolves the slot to null rather than rejecting, so one bad
   file degrades the surface that needed it instead of the whole page.
   ═══════════════════════════════════════════════════════════════════════════ */
window.STAGDATA = (() => {
  const FILES = ['questions', 'routing', 'solutions', 'campaigns', 'brand', 'messaging'];
  const grab = name => fetch(`/data/${name}.json`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);
  return Promise.all(FILES.map(grab)).then(loaded =>
    Object.fromEntries(FILES.map((name, i) => [name, loaded[i]])));
})();
