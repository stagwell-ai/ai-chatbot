// Search+ (tab film): the ask and the answer live on the right; ghost answers stream under the cards.
import CoreGraphics
import CoreText
import Foundation
let W = 1920, H = 1080, FPS = 30, L = 10.0
var rng = RNG(s: 53)
let q = "Which brand should I trust?"
let px = 1370.0, pw = 500.0
let rowTop = 380.0, rowH = 78.0
let starts = [4, 5, 3, 4]
let T0 = 0.9, EACH = 2.25
struct Ghost { var x, y, w, speed: Double }
var ghosts: [Ghost] = []
for _ in 0..<70 { ghosts.append(Ghost(x: rng.r(60, 1300), y: rng.r(0, 1080), w: rng.r(60, 260), speed: rng.r(14, 34))) }
render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: Int(L) * FPS) { ctx, f in
  let s = Double(f) / Double(FPS)
  ground(ctx, W, H)
  // answers streaming up, faint, across the rest of the frame
  let ga = ease(s / 0.6)
  for g in ghosts {
    var y = g.y - s * g.speed
    y = (y.truncatingRemainder(dividingBy: 1080) + 1080).truncatingRemainder(dividingBy: 1080)
    ctx.setFillColor(white(0.07 * ga)); ctx.fill(CGRect(x: g.x, y: y, width: g.w, height: 6))
  }
  // the ask
  let bg = ease(s / 0.3)
  let box = CGRect(x: px + pw / 2 * (1 - bg), y: 170, width: pw * bg, height: 72)
  ctx.setStrokeColor(white(0.55 * bg)); ctx.setLineWidth(1.5)
  ctx.addPath(CGPath(roundedRect: box, cornerWidth: 36, cornerHeight: 36, transform: nil)); ctx.strokePath()
  let typed = Int(Double(q.count) * min(1, max(0, (s - 0.2) / 0.7)))
  let tw = text(ctx, String(q.prefix(typed)), px + 34, 216, CTFontCreateWithName("HelveticaNeue" as CFString, 26, nil), white(0.95))
  if s < 1.2 && Int(s * 4) % 2 == 0 { ctx.setFillColor(white(0.9)); ctx.fill(CGRect(x: px + 38 + tw, y: 192, width: 2, height: 30)) }
  // one panel; the assistants take turns answering
  let open = ease((s - 0.6) / 0.35)
  if open > 0 {
    let panel = CGRect(x: px, y: 280, width: pw, height: 620 * open)
    ctx.setStrokeColor(white(0.24 * open)); ctx.setLineWidth(1)
    ctx.addPath(CGPath(roundedRect: panel, cornerWidth: 16, cornerHeight: 16, transform: nil)); ctx.strokePath()
  }
  let idx = max(0, min(3, Int((s - T0) / EACH)))
  let local = s - T0 - Double(idx) * EACH
  if open > 0.9 {
    text(ctx, "ASSISTANT \(["A", "B", "C", "D"][idx])", px + 28, 326, mono(16), white(0.7), tracking: 1.5)
    for k in 0..<4 {   // the four answered so far
      let done = k < idx || (k == idx && local > 1.5)
      let r = CGRect(x: px + pw - 28 - Double(3 - k) * 22, y: 314, width: 12, height: 12)
      if done { ctx.setFillColor(ORANGE); ctx.fill(r) } else { ctx.setStrokeColor(white(0.4)); ctx.stroke(r) }
    }
    let start = starts[idx]
    let climb = ease((local - 0.7) / 0.8)
    for r in 0..<6 {
      let show = ease((local - Double(r) * 0.06) / 0.25)
      if show <= 0 { continue }
      var slot = Double(r)
      let ours = r == start
      if ours { slot = Double(start) * (1 - climb) } else if r < start { slot = Double(r) + climb }
      let y = rowTop + slot * rowH
      text(ctx, "\(Int(slot.rounded()) + 1)", px + 28, y + 34, mono(17), white(0.45 * show))
      if ours {
        let chip = CGRect(x: px + 66, y: y + 12, width: 176 * show, height: 32)
        ctx.setFillColor((climb > 0.5 ? ORANGE : white(0.3)).copy(alpha: show)!)
        ctx.addPath(CGPath(roundedRect: chip, cornerWidth: 7, cornerHeight: 7, transform: nil)); ctx.fillPath()
        if show > 0.8 { text(ctx, "YOUR BRAND", px + 82, y + 34, mono(15, bold: true), white(1), tracking: 1.2) }
        ctx.setFillColor(white(0.22 * show)); ctx.fill(CGRect(x: px + 258, y: y + 24, width: (pw - 290) * show, height: 9))
        if climb > 0.98 {
          ctx.setStrokeColor(ORANGE.copy(alpha: ease((local - 1.5) / 0.25))!); ctx.setLineWidth(1.5)
          ctx.stroke(CGRect(x: px + 14, y: y + 2, width: pw - 28, height: rowH - 14))
        }
      } else {
        let w1 = (pw - 120) * (0.55 + 0.4 * Double((r * 37 + idx * 11) % 10) / 10) * show
        ctx.setFillColor(white(0.3 * show)); ctx.fill(CGRect(x: px + 66, y: y + 18, width: w1, height: 10))
        ctx.setFillColor(white(0.15 * show)); ctx.fill(CGRect(x: px + 66, y: y + 36, width: w1 * 0.7, height: 8))
      }
    }
  }
  text(ctx, "AI SEARCH", px, 140, mono(16), white(0.75 * ease((s - 0.1) / 0.3)), tracking: 2)
}
