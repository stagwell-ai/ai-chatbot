# Motion lab

Full-HD loops shown on the hidden page `/motion-lab` (next/motion-lab.html), for Julian's After Effects edit.
Each is drawn frame by frame with CoreGraphics and encoded with AVFoundation (no ffmpeg on this Mac).

    cd scripts/motion-lab
    swiftc -O common.swift network/main.swift -o /tmp/network && /tmp/network "$PWD/../../assets/video/lab/productivity-network-vN.mp4"
    swiftc -O common.swift code/main.swift    -o /tmp/code    && /tmp/code    "$PWD/../../assets/video/lab/your-stack-code-vN.mp4"
    swiftc -O common.swift voice/main.swift   -o /tmp/voice   && /tmp/voice   "$PWD/../../assets/video/lab/voice-squares-vN.mp4"

Many voices (v2+): `swiftc -O common.swift voices/main.swift -o /tmp/voices && /tmp/voices "$PWD/../../assets/video/lab/voice-squares-vN.mp4"`

Bump the version in the file name for each revision (served files cache by path) and update the page.

Tech loops, no text (15 scenes in one file, any size):

    swiftc -O common.swift loops/main.swift -o /tmp/loops
    /tmp/loops <scene> "$PWD/../../assets/video/lab/loops/<scene>.mp4" [width] [height]

Scenes: streams pulses orbits block-rain plexus lanes radar circuit terrain mosaic converge charts clusters globe tunnel.
Width/height default to 1920×1080; e.g. `1080 1920` for vertical, `1080 1080` for square. AVAssetWriter leaves `*.sb-*` temp files next to the output: delete them.
