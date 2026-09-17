// The Media Machine: one source of truth for media performance.
// Eight channel lanes feed packets into one line; the line draws the live performance view.
import CoreGraphics
import Foundation
let W = 1920, H = 1080, FPS = 30, L = 10.0
var rng = RNG(s: 31)
let lanes = ["SEARCH", "SOCIAL", "CTV", "DISPLAY", "AUDIO", "RETAIL MEDIA", "OOH", "ONLINE VIDEO"]
let lx = 170.0, top = 250.0, gapY = 82.0
let hubX = 1060.0, hubY = 540.0
func laneY(_ i: Int) -> Double { top + Double(i) * gapY }
func path(_ i: Int, _ t: Double) -> (Double, Double) {    // lane start → hub, S-curve
  let x0 = lx + 250, y0 = laneY(i), x1 = hubX, y1 = hubY
  let u = 1 - t
  let c1x = x0 + (x1 - x0) * 0.55, c2x = x0 + (x1 - x0) * 0.45
  let x = u*u*u*x0 + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*x1
  let y = u*u*u*y0 + 3*u*u*t*y0 + 3*u*t*t*y1 + t*t*t*y1
  return (x, y)
}
struct Packet { var lane: Int; var born: Double; var speed: Double; var w: Double }
var packets: [Packet] = []
for _ in 0..<520 {
  packets.append(Packet(lane: Int(rng.next() * 8), born: rng.r(1.3, 10), speed: rng.r(0.9, 1.6), w: rng.r(6, 16)))
}
// the performance line: sum of slow sines, deterministic
func perf(_ x: Double, _ s: Double) -> Double {
  0.5 + 0.18 * sin(x * 6.0 + s * 0.9) + 0.1 * sin(x * 13.0 - s * 1.7) + 0.22 * x
}
render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: Int(L) * FPS) { ctx, f in
  let s = Double(f) / Double(FPS)
  ground(ctx, W, H)
  // lanes: label types, rail draws
  for (i, name) in lanes.enumerated() {
    let a = ease((s - 0.1 - Double(i) * 0.06) / 0.35)
    if a <= 0 { continue }
    let shown = String(name.prefix(Int(Double(name.count) * a + 0.5)))
    text(ctx, shown, lx, laneY(i) + 6, mono(15), white(0.75 * a), tracking: 1.5)
    // rail
    let g = ease((s - 0.35 - Double(i) * 0.05) / 0.6)
    if g > 0 {
      ctx.setStrokeColor(white(0.22)); ctx.setLineWidth(1)
      ctx.beginPath(); var p = path(i, 0); ctx.move(to: CGPoint(x: p.0, y: p.1))
      let n = Int(60 * g); if n > 0 { for k in 1...n { p = path(i, Double(k) / 60); ctx.addLine(to: CGPoint(x: p.0, y: p.1)) } }
      ctx.strokePath()
      ctx.setFillColor(white(0.9)); ctx.fill(CGRect(x: lx + 244, y: laneY(i) - 3, width: 6, height: 6))
    }
  }
  // packets flow into the hub
  for p in packets {
    let age = s - p.born
    if age < 0 { continue }
    let t = age * p.speed / 1.6
    if t > 1 { continue }
    let pt = path(p.lane, ease(t))
    let accent = p.lane % 3 == 0 ? ORANGE : (p.lane % 3 == 1 ? white(0.9) : LCYAN)
    ctx.setFillColor(accent.copy(alpha: 0.9 * min(1, (1 - t) * 4))!)
    ctx.fill(CGRect(x: pt.0 - p.w / 2, y: pt.1 - 2.5, width: p.w, height: 5))
  }
  // the hub: one source
  let hb = ease((s - 1.2) / 0.5)
  if hb > 0 {
    let pulse = 1 + 0.08 * sin(s * 5)
    ctx.setStrokeColor(white(0.9 * hb)); ctx.setLineWidth(1.5)
    let r = 26 * hb * pulse
    ctx.stroke(CGRect(x: hubX - r, y: hubY - r, width: r * 2, height: r * 2))
    ctx.setFillColor(white(hb)); ctx.fill(CGRect(x: hubX - 9, y: hubY - 9, width: 18, height: 18))
    text(ctx, "ONE SOURCE OF TRUTH", hubX - 92, hubY - 52, mono(14), white(0.7 * hb), tracking: 1.5)
  }
  // the performance view on the right
  let cx0 = 1180.0, cx1 = 1780.0, cy0 = 300.0, cy1 = 780.0
  let fr = ease((s - 1.6) / 0.6)
  if fr > 0 {
    ctx.setStrokeColor(white(0.18 * fr)); ctx.setLineWidth(1)
    for k in 0...4 { let y = cy0 + Double(k) * (cy1 - cy0) / 4
      ctx.beginPath(); ctx.move(to: CGPoint(x: cx0, y: y)); ctx.addLine(to: CGPoint(x: cx0 + (cx1 - cx0) * fr, y: y)); ctx.strokePath() }
    // link from hub
    ctx.setStrokeColor(white(0.6 * fr)); ctx.setLineWidth(1.5)
    ctx.beginPath(); ctx.move(to: CGPoint(x: hubX + 26, y: hubY)); ctx.addLine(to: CGPoint(x: hubX + 26 + (cx0 - hubX - 26) * fr, y: hubY)); ctx.strokePath()
    for (k, lab) in ["SPEND", "REACH", "OUTCOMES"].enumerated() {
      text(ctx, lab, cx0 + Double(k) * 170, cy1 + 44, mono(14), (k == 2 ? ORANGE : white(0.6)).copy(alpha: fr)!, tracking: 1.5)
    }
  }
  let dr = ease((s - 2.0) / 1.4)
  if dr > 0 {
    // bars (spend) behind, line (outcomes) on top
    let nb = 24
    for b in 0..<nb {
      let u = Double(b) / Double(nb - 1)
      if u > dr { break }
      let h = (0.25 + 0.5 * (0.5 + 0.5 * sin(u * 9 + s * 1.3))) * (cy1 - cy0) * 0.6
      let x = cx0 + u * (cx1 - cx0) - 7
      ctx.setFillColor(white(0.16)); ctx.fill(CGRect(x: x, y: cy1 - h, width: 14, height: h))
    }
    ctx.setStrokeColor(ORANGE); ctx.setLineWidth(3)
    ctx.beginPath()
    let steps = 120
    for k in 0...Int(Double(steps) * dr) {
      let u = Double(k) / Double(steps)
      let y = cy1 - perf(u, s) * (cy1 - cy0) * 0.9
      let x = cx0 + u * (cx1 - cx0)
      if k == 0 { ctx.move(to: CGPoint(x: x, y: y)) } else { ctx.addLine(to: CGPoint(x: x, y: y)) }
    }
    ctx.strokePath()
    let u = dr, x = cx0 + u * (cx1 - cx0), y = cy1 - perf(u, s) * (cy1 - cy0) * 0.9
    ctx.setFillColor(ORANGE); ctx.fillEllipse(in: CGRect(x: x - 7, y: y - 7, width: 14, height: 14))
    // reach: a second, thinner line
    ctx.setStrokeColor(LCYAN.copy(alpha: 0.8)!); ctx.setLineWidth(1.5)
    ctx.beginPath()
    for k in 0...Int(Double(steps) * dr) {
      let u = Double(k) / Double(steps)
      let y = cy1 - (0.35 + 0.12 * sin(u * 8 - s * 1.1) + 0.18 * u) * (cy1 - cy0)
      let x = cx0 + u * (cx1 - cx0)
      if k == 0 { ctx.move(to: CGPoint(x: x, y: y)) } else { ctx.addLine(to: CGPoint(x: x, y: y)) }
    }
    ctx.strokePath()
  }
}
