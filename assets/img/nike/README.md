# Nike demo footage — drop zone

The Agent's ad rack (e.html) fills itself from this folder. Drop clips in,
redeploy, done — no code changes. Until files exist here, the rack shows
its gradient stubs.

## What to drop

| Filename        | What it should feel like                          |
| --------------- | ------------------------------------------------- |
| ad-1.mp4        | runner at dawn, street or track                   |
| ad-2.mp4        | sneaker close-up / product beauty shot            |
| ad-3.mp4        | creator-style talking head or gym clip            |
| ad-4.mp4        | city run, crowd energy                            |
| hero.jpg        | (optional) wide athletic still for future use     |

Specs: 5–10 seconds · portrait 9:16 preferred · H.264 mp4 · under 6MB each
(match the existing clips in assets/img/). Silent — they autoplay muted.

Sources that work: your own Nike-adjacent library, or free stock with no
attribution required (Pexels, Mixkit, Coverr — search "running shoes",
"sneakers", "athlete street"). The swoosh is not needed; the Nike context
on the page does the branding.

## Creator roster

The results card and the InfluencerMarketing.ai workspace peek fill
themselves from `e-creators.js` (repo root), which reads its avatars and
clips from this `creators/` subfolder. Six creators, numbered 1–6, matching
the six entries in `e-creators.js`:

| Filename       | What it should be                                          |
| -------------- | ----------------------------------------------------------- |
| avatar-1.jpg   | square headshot/profile photo, ≥200px, jpg/png/webp          |
| avatar-2.jpg   | square headshot/profile photo, ≥200px, jpg/png/webp          |
| avatar-3.jpg   | square headshot/profile photo, ≥200px, jpg/png/webp          |
| avatar-4.jpg   | square headshot/profile photo, ≥200px, jpg/png/webp          |
| avatar-5.jpg   | square headshot/profile photo, ≥200px, jpg/png/webp          |
| avatar-6.jpg   | square headshot/profile photo, ≥200px, jpg/png/webp          |
| video-1.mp4    | creator's actual Nike TikTok, portrait 9:16, 5–15s, H.264, <8MB |
| video-2.mp4    | creator's actual Nike TikTok, portrait 9:16, 5–15s, H.264, <8MB |
| video-3.mp4    | creator's actual Nike TikTok, portrait 9:16, 5–15s, H.264, <8MB |
| video-4.mp4    | creator's actual Nike TikTok, portrait 9:16, 5–15s, H.264, <8MB |
| video-5.mp4    | creator's actual Nike TikTok, portrait 9:16, 5–15s, H.264, <8MB |
| video-6.mp4    | creator's actual Nike TikTok, portrait 9:16, 5–15s, H.264, <8MB |

Extension is free (jpg/png/webp for avatars) as long as the entry's
`avatar` path in `e-creators.js` is updated to match. Names, handles,
follower/engagement/avgViews/niche/overlap numbers, and the `url` field are
all edited in `e-creators.js`, not here — this folder only holds the
media the entries point at.

`e-creators.js` starts with `placeholder: true`, which is what puts the
"illustrative" note on the roster while these six are stand-ins. Once the
real six creators' data and files are dropped in, flip that flag to
`false` and the note goes away — no other change needed.
