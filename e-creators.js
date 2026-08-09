/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION E  ·  the creator roster

   The single swap point for real creator data: replace the six entries
   below, drop avatars and clips in assets/img/nike/creators/, set
   placeholder to false, done. While placeholder is true the roster carries
   an "illustrative" note.
   ═══════════════════════════════════════════════════════════════════════════ */
window.ECREATORS = (() => {
'use strict';

/* Flip to false the moment real creator data lands — this is the only
   switch the rest of the app needs to read to drop the "illustrative"
   caveat from the results card and workspace peek. */
const placeholder = true;

/* Six clearly-fictional running/fitness personas, invented for the demo —
   the placeholder note above covers them. Swap each entry's fields in
   place for the real six; keep the shape identical (id/N pairing included)
   so nothing downstream needs to change. */
const list = [
  {
    id: 'c1',
    name: 'Mara Quinn',
    handle: '@runwithmara',
    platform: 'TikTok',
    followers: 2400000,
    engagement: 6.8,
    avgViews: 890000,
    niche: 'Marathon training',
    overlap: 74,
    avatar: './assets/img/nike/creators/avatar-1.jpg',
    video: './assets/img/nike/creators/video-1.mp4',
    url: '',
  },
  {
    id: 'c2',
    name: 'Devon Tate',
    handle: '@tatepace',
    platform: 'TikTok',
    followers: 1100000,
    engagement: 5.2,
    avgViews: 410000,
    niche: 'Street running & sneaker culture',
    overlap: 68,
    avatar: './assets/img/nike/creators/avatar-2.jpg',
    video: './assets/img/nike/creators/video-2.mp4',
    url: '',
  },
  {
    id: 'c3',
    name: 'Aisha Solano',
    handle: '@aishagoesfar',
    platform: 'TikTok',
    followers: 3700000,
    engagement: 4.1,
    avgViews: 1200000,
    niche: 'Couch-to-5K coaching',
    overlap: 61,
    avatar: './assets/img/nike/creators/avatar-3.jpg',
    video: './assets/img/nike/creators/video-3.mp4',
    url: '',
  },
  {
    id: 'c4',
    name: 'Kenji Mori',
    handle: '@kenjiruns',
    platform: 'TikTok',
    followers: 860000,
    engagement: 8.9,
    avgViews: 520000,
    niche: 'Trail & ultra',
    overlap: 57,
    avatar: './assets/img/nike/creators/avatar-4.jpg',
    video: './assets/img/nike/creators/video-4.mp4',
    url: '',
  },
  {
    id: 'c5',
    name: 'Priya Nair',
    handle: '@priyaonpace',
    platform: 'TikTok',
    followers: 1900000,
    engagement: 5.9,
    avgViews: 700000,
    niche: 'Run-club culture',
    overlap: 66,
    avatar: './assets/img/nike/creators/avatar-5.jpg',
    video: './assets/img/nike/creators/video-5.mp4',
    url: '',
  },
  {
    id: 'c6',
    name: 'Leo Brandt',
    handle: '@brandtkicks',
    platform: 'TikTok',
    followers: 640000,
    engagement: 7.4,
    avgViews: 380000,
    niche: 'Sneaker reviews',
    overlap: 71,
    avatar: './assets/img/nike/creators/avatar-6.jpg',
    video: './assets/img/nike/creators/video-6.mp4',
    url: '',
  },
];

/* ══════════════════════ COMPACT FORMATTER ══════════════════════
   Pure, no DOM. 2400000 -> '2.4M', 890000 -> '890K', 640 -> '640'. One
   decimal, trailing '.0' dropped (JS's own number-to-string already drops
   it, so no extra stripping is needed). Non-finite and zero read as '0'. */
function fmt(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '0';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1e6) return sign + (Math.round(abs / 1e5) / 10) + 'M';
  if (abs >= 1e3) return sign + (Math.round(abs / 1e2) / 10) + 'K';
  return sign + String(Math.round(abs));
}

return { placeholder, list, fmt };
})();
