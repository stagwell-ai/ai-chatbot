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
  /* goals, taxonomy, scoring and kimi (2026-09-10) feed the homepage's
     product-discovery conversation — next/kimi-flow.js and the pure core it
     runs on (recommend.js, select-question.js) */
  const FILES = ['questions', 'routing', 'solutions', 'campaigns', 'brand', 'messaging',
    'goals', 'taxonomy', 'scoring', 'kimi', 'explainers'];
  const grab = name => fetch(`/data/${name}.json`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);
  return Promise.all(FILES.map(grab)).then(loaded =>
    Object.fromEntries(FILES.map((name, i) => [name, loaded[i]])));
})();
