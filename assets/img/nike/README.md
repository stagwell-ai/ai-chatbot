# Nike demo footage

The Agent's ad rack (e.html) no longer reads loose `ad-N.mp4` drops from
this folder — it fills itself from the curated creator roster instead.
The rack shows only the six creators' own Nike videos, each credited to
its creator on hover.

## Creator roster

The results card, the ad rack, and the InfluencerMarketing.ai workspace
peek all fill themselves from `e-creators.js` (repo root), which reads its
avatars and clips from this `creators/` subfolder. Six creators, numbered
1–6, matching the six entries in `e-creators.js`:

| Filename       | What it is                                                   |
| -------------- | ------------------------------------------------------------ |
| avatar-1..6    | square profile photo, ≥200px, jpg/png/webp                    |
| video-1..6.mp4 | the creator's actual Nike video, portrait, H.264, <6MB        |

All six slots are filled with real footage. To swap a clip, replace the
matching `video-N.mp4` (N follows the roster order in `e-creators.js`) or
edit that manifest. The existing files were cut with:
`ffmpeg -t 30 -vf scale=540:-2 -c:v libx264 -preset veryfast -crf 29
-pix_fmt yuv420p -an -movflags +faststart` — silent, they autoplay muted.

Names, handles, public stats, niche lines, and the `url` field are all
edited in `e-creators.js`, not here — this folder only holds the media
the entries point at.
