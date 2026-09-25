/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION E  ·  the creator roster

   REAL DATA. The six below are real public accounts, sourced from the
   client's profile snapshot (2026-08-09). Every figure shown is a public
   platform metric from that snapshot — nothing here is modelled, seeded or
   invented, which is why these entries carry `stats` rows instead of the
   old engagement/overlap fields: real people get real numbers or none.
   The roster note is the snapshot's own caveat, kept verbatim in spirit:
   posting Nike-related content implies no sponsorship or endorsement.

   Videos land in assets/img/nike/creators/video-N.mp4 (N matches the
   entry), each with a poster-N.jpg still — the frame that shows where a
   browser defers video loading (iOS data-saver, low power). Slots without
   a file degrade to the gradient stub.
   ═══════════════════════════════════════════════════════════════════════════ */
window.ECREATORS = (() => {
'use strict';

/* Real data is in — the "illustrative roster" caveat is retired. The note
   below replaces it wherever the roster renders. */
const placeholder = false;
const note = 'Public profiles, snapshot 9 Aug 2026 · no affiliation or endorsement implied';

/* Ordered by the snapshot's practical ranking for a Nike-footwear
   campaign. `stats` rows are printed as-is (label/value), so the
   snapshot's own precision — exact counts, approximations, historical
   qualifiers — survives into the UI. */
const list = [
  {
    id: 'c1',
    name: 'Jacques Slade',
    handle: '@kustoo',
    platform: 'YouTube',
    stats: [
      { k: 'YouTube subs', v: '1.32M' },
      { k: 'TikTok', v: '159K · 4.2M likes' },
      { k: 'Instagram', v: '~181K' },
    ],
    niche: 'Footwear, golf, tech & entertainment',
    avatar: './assets/img/nike/creators/avatar-1.jpg',
    video: './assets/img/nike/creators/video-1.mp4',
    poster: './assets/img/nike/creators/poster-1.jpg',
    url: 'https://www.youtube.com/channel/UCZ9l_6_f0PWRYXN5Y7Lcl2A',
  },
  {
    id: 'c2',
    name: 'Keltie O’Connor',
    handle: '@keltieoconnor',
    platform: 'TikTok',
    stats: [
      { k: 'YouTube subs', v: '772K' },
      { k: 'Instagram', v: '169K' },
      { k: 'TikTok', v: '122K · 4.2M likes' },
    ],
    niche: 'Fitness, running & gear testing',
    avatar: './assets/img/nike/creators/avatar-2.jpg',
    video: './assets/img/nike/creators/video-2.mp4',
    poster: './assets/img/nike/creators/poster-2.jpg',
    url: 'https://www.tiktok.com/@keltieoconnor',
  },
  {
    id: 'c3',
    name: 'Complex Sneakers',
    handle: '@ComplexSneakers',
    platform: 'X',
    stats: [
      { k: 'X followers', v: '1,041,748' },
      { k: 'Instagram', v: '~1.7M' },
    ],
    niche: 'Sneaker media brand · presenter Kevin Luyster',
    avatar: './assets/img/nike/creators/avatar-3.jpg',
    video: './assets/img/nike/creators/video-3.mp4',
    poster: './assets/img/nike/creators/poster-3.jpg',
    url: 'https://x.com/ComplexSneakers',
  },
  {
    id: 'c4',
    name: 'Andrew Dutton',
    handle: '@ad__sneaks',
    platform: 'X',
    stats: [
      { k: 'X followers', v: '21,937' },
      { k: 'Instagram', v: '300K+ (2024, historical)' },
    ],
    niche: 'Sneaker photography · educator & collector',
    avatar: './assets/img/nike/creators/avatar-4.jpg',
    video: './assets/img/nike/creators/video-4.mp4',
    poster: './assets/img/nike/creators/poster-4.jpg',
    url: 'https://x.com/ad__sneaks',
  },
  {
    id: 'c5',
    name: 'Charles Matthews',
    handle: '@natureboichuck',
    platform: 'TikTok',
    stats: [
      { k: 'TikTok', v: '28.8K · 947.9K likes' },
      { k: 'X followers', v: '12,011' },
      { k: 'YouTube subs', v: '7,950' },
    ],
    niche: 'Detailed sneaker reviews & on-foot breakdowns',
    avatar: './assets/img/nike/creators/avatar-5.jpg',
    video: './assets/img/nike/creators/video-5.mp4',
    poster: './assets/img/nike/creators/poster-5.jpg',
    url: 'https://www.tiktok.com/@natureboichucktv',
  },
  {
    id: 'c6',
    name: 'Killadelphia',
    handle: '@_Killa',
    platform: 'X',
    stats: [
      { k: 'X followers', v: '24,229' },
    ],
    niche: 'Gaming, music & tech · recurring sneaker reviews',
    avatar: './assets/img/nike/creators/avatar-6.jpg',
    video: './assets/img/nike/creators/video-6.mp4',
    poster: './assets/img/nike/creators/poster-6.jpg',
    url: 'https://x.com/_Killa',
  },
];

/* ══════════════════════ COMPACT FORMATTER ══════════════════════
   Pure, no DOM. 2400000 -> '2.4M', 890000 -> '890K', 640 -> '640'. One
   decimal, trailing '.0' dropped (JS's own number-to-string already drops
   it, so no extra stripping is needed). Non-finite and zero read as '0'.
   Kept for callers even though the real entries above pre-format their
   values to preserve the snapshot's own qualifiers. */
function fmt(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '0';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1e6) return sign + (Math.round(abs / 1e5) / 10) + 'M';
  if (abs >= 1e3) return sign + (Math.round(abs / 1e2) / 10) + 'K';
  return sign + String(Math.round(abs));
}

return { placeholder, note, list, fmt };
})();
