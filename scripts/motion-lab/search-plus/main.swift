// Search+: how a brand is represented and recommended inside AI answers.
// A question is asked; four assistants answer; "Your brand" climbs to the top of each.
import CoreGraphics
import Foundation
import CoreText
let W = 1920, H = 1080, FPS = 30, L = 10.0
var rng = RNG(s: 53)
let q = "Which brand should I trust for this?"
let cols = 4
let colW = 380.0, gap = 40.0
let x0 = (Double(W) - (Double(cols) * colW + Double(cols - 1) * gap)) / 2
let listTop = 420.0, rowH = 64.0
// each panel: 6 ranked rows; our brand starts at a different place and climbs to #1
let starts = [5, 4, 5, 3]
let climbAt = [3.2, 3.9, 4.6, 5.3]
render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: Int(L) * FPS) { ctx, f in
  let s = Double(f) / Double(FPS)
  ground(ctx, W, H)
  // the ask
  let bx = 460.0, by = 170.0, bw = 1000.0, bh = 84.0
  let bg = ease(s / 0.35)
  ctx.setStrokeColor(white(0.5 * bg)); ctx.setLineWidth(1.5)
  let box = CGRect(x: bx + bw / 2 * (1 - bg), y: by, width: bw * bg, height: bh)
  ctx.addPath(CGPath(roundedRect: box, cornerWidth: 42, cornerHeight: 42, transform: nil)); ctx.strokePath()
  let typed = Int(Double(q.count) * min(1, max(0, (s - 0.3) / 1.0)))
  let tw = text(ctx, String(q.prefix(typed)), bx + 48, by + 52, CTFontCreateWithName("HelveticaNeue" as CFString, 30, nil), white(0.95))
  if s < 1.6 && Int(s * 4) % 2 == 0 { ctx.setFillColor(white(0.9)); ctx.fill(CGRect(x: bx + 52 + tw, y: by + 26, width: 2, height: 34)) }
  // four assistants answer
  for c in 0..<cols {
    let px = x0 + Double(c) * (colW + gap)
    let open = ease((s - 1.3 - Double(c) * 0.12) / 0.4)
    if open <= 0 { continue }
    ctx.setStrokeColor(white(0.2 * open)); ctx.setLineWidth(1)
    let panel = CGRect(x: px, y: 330, width: colW, height: 560 * open)
    ctx.addPath(CGPath(roundedRect: panel, cornerWidth: 14, cornerHeight: 14, transform: nil)); ctx.strokePath()
    text(ctx, "ASSISTANT \(["A", "B", "C", "D"][c])", px + 24, 370, mono(14), white(0.6 * open), tracking: 1.5)
    // streamed answer lines
    for r in 0..<6 {
      let rowShow = ease((s - 1.6 - Double(c) * 0.12 - Double(r) * 0.12) / 0.3)
      if rowShow <= 0 { continue }
      // rank position of our brand in this panel
      let climb = ease((s - climbAt[c]) / 0.9)
      let ours = Double(starts[c]) * (1 - climb)            // 5 → 0
      // other rows shift down as ours rises
      var slot = Double(r)
      let isOurs = r == starts[c]
      if isOurs { slot = ours } else if r < starts[c] { slot = Double(r) + climb * (Double(r) >= 0 ? 1 : 0) }
      let y = listTop + slot * rowH
      ctx.setFillColor(white(0.35 * rowShow))
      text(ctx, "\(Int(slot.rounded()) + 1)", px + 24, y + 30, mono(15), white(0.4 * rowShow))
      if isOurs {
        let hot = climb
        let chip = CGRect(x: px + 60, y: y + 12, width: 150 * rowShow, height: 28)
        ctx.setFillColor((hot > 0.5 ? ORANGE : white(0.28)).copy(alpha: rowShow)!)
        ctx.addPath(CGPath(roundedRect: chip, cornerWidth: 6, cornerHeight: 6, transform: nil)); ctx.fillPath()
        if rowShow > 0.8 { text(ctx, "YOUR BRAND", px + 74, y + 31, mono(13, bold: true), white(1), tracking: 1.2) }
        let lw = (colW - 250) * rowShow
        ctx.setFillColor(white(0.22 * rowShow)); ctx.fill(CGRect(x: px + 222, y: y + 22, width: lw, height: 8))
        if hot > 0.98 {
          let tick = ease((s - climbAt[c] - 0.9) / 0.3)
          ctx.setStrokeColor(ORANGE.copy(alpha: tick)!); ctx.setLineWidth(1.5)
          ctx.stroke(CGRect(x: px + 14, y: y + 4, width: colW - 28, height: rowH - 16))
        }
      } else {
        let w1 = (colW - 110) * (0.55 + 0.4 * Double((r * 37 + c * 11) % 10) / 10) * rowShow
        ctx.setFillColor(white(0.28 * rowShow)); ctx.fill(CGRect(x: px + 60, y: y + 16, width: w1, height: 9))
        ctx.setFillColor(white(0.14 * rowShow)); ctx.fill(CGRect(x: px + 60, y: y + 31, width: w1 * 0.7, height: 7))
      }
    }
  }
  text(ctx, "AI SEARCH · HOW YOUR BRAND IS RECOMMENDED", 120, 110, mono(15), white(0.7 * ease((s - 0.2) / 0.4)), tracking: 2)
}
