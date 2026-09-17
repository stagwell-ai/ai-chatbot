// The Media Machine (tab film): channels run along the bottom into one source; the performance view stands on the right.
import CoreGraphics
import Foundation
let W = 1920, H = 1080, FPS = 30, L = 10.0
var rng = RNG(s: 31)
let lanes = ["SEARCH", "SOCIAL", "CTV", "DISPLAY", "AUDIO", "RETAIL MEDIA", "OOH", "ONLINE VIDEO"]
let lx = 110.0, top = 600.0, gapY = 40.0
let hubX = 1290.0, hubY = 740.0
func laneY(_ i: Int) -> Double { top + Double(i) * gapY }
func path(_ i: Int, _ t: Double) -> (Double, Double) {
  let x0 = lx + 190, y0 = laneY(i), x1 = hubX, y1 = hubY
  let u = 1 - t
  let c1x = x0 + (x1 - x0) * 0.6, c2x = x0 + (x1 - x0) * 0.5
  return (u*u*u*x0 + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*x1, u*u*u*y0 + 3*u*u*t*y0 + 3*u*t*t*y1 + t*t*t*y1)
}
struct Packet { var lane: Int; var born: Double; var speed: Double; var w: Double }
var packets: [Packet] = []
for _ in 0..<600 { packets.append(Packet(lane: Int(rng.next() * 8), born: rng.r(0.8, 10), speed: rng.r(0.9, 1.6), w: rng.r(6, 16))) }
func perf(_ x: Double, _ s: Double) -> Double { 0.45 + 0.16 * sin(x * 6.0 + s * 0.9) + 0.09 * sin(x * 13.0 - s * 1.7) + 0.25 * x }
render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: Int(L) * FPS) { ctx, f in
  let s = Double(f) / Double(FPS)
  ground(ctx, W, H)
  ambientDots(ctx, W, H, s, 0.8, seed: 9)
  for (i, name) in lanes.enumerated() {
    let a = ease((s - Double(i) * 0.05) / 0.3)
    if a <= 0 { continue }
    text(ctx, String(name.prefix(Int(Double(name.count) * a + 0.5))), lx, laneY(i) + 5, mono(14), white(0.75 * a), tracking: 1.5)
    let g = ease((s - 0.2 - Double(i) * 0.04) / 0.5)
    if g > 0 {
      ctx.setStrokeColor(white(0.2)); ctx.setLineWidth(1)
      ctx.beginPath(); var p = path(i, 0); ctx.move(to: CGPoint(x: p.0, y: p.1))
      let n = Int(60 * g); if n > 0 { for k in 1...n { p = path(i, Double(k) / 60); ctx.addLine(to: CGPoint(x: p.0, y: p.1)) } }
      ctx.strokePath()
      ctx.setFillColor(white(0.9)); ctx.fill(CGRect(x: lx + 184, y: laneY(i) - 3, width: 6, height: 6))
    }
  }
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
  let hb = ease((s - 0.7) / 0.4)
  let cx0 = 1400.0, cx1 = 1850.0, cy0 = 240.0, cy1 = 800.0
  if hb > 0 {
    let r = 22 * hb * (1 + 0.08 * sin(s * 5))
    ctx.setStrokeColor(white(0.9 * hb)); ctx.setLineWidth(1.5)
    ctx.stroke(CGRect(x: hubX - r, y: hubY - r, width: r * 2, height: r * 2))
    ctx.setFillColor(white(hb)); ctx.fill(CGRect(x: hubX - 8, y: hubY - 8, width: 16, height: 16))
    text(ctx, "ONE SOURCE", hubX - 52, hubY + 50, mono(14), white(0.75 * hb), tracking: 1.5)
    ctx.setStrokeColor(white(0.6 * hb)); ctx.setLineWidth(1.5)
    ctx.beginPath(); ctx.move(to: CGPoint(x: hubX + 22, y: hubY)); ctx.addLine(to: CGPoint(x: hubX + 22 + (cx0 - hubX - 22) * hb, y: hubY)); ctx.strokePath()
  }
  let fr = ease((s - 0.9) / 0.5)
  if fr > 0 {
    text(ctx, "MEDIA PERFORMANCE", cx0, cy0 - 40, mono(16), white(0.75 * fr), tracking: 2)
    ctx.setStrokeColor(white(0.16 * fr)); ctx.setLineWidth(1)
    for k in 0...4 { let y = cy0 + Double(k) * (cy1 - cy0) / 4
      ctx.beginPath(); ctx.move(to: CGPoint(x: cx0, y: y)); ctx.addLine(to: CGPoint(x: cx0 + (cx1 - cx0) * fr, y: y)); ctx.strokePath() }
    for (k, lab) in ["SPEND", "REACH", "OUTCOMES"].enumerated() {
      text(ctx, lab, cx0 + Double(k) * 140, cy1 + 44, mono(15), (k == 2 ? ORANGE : (k == 1 ? LCYAN : white(0.6))).copy(alpha: fr)!, tracking: 1.5)
    }
  }
  let dr = ease((s - 1.1) / 1.2)
  if dr > 0 {
    let nb = 16
    for b in 0..<nb {
      let u = Double(b) / Double(nb - 1)
      if u > dr { break }
      let h = (0.25 + 0.5 * (0.5 + 0.5 * sin(u * 9 + s * 1.3))) * (cy1 - cy0) * 0.6
      ctx.setFillColor(white(0.16)); ctx.fill(CGRect(x: cx0 + u * (cx1 - cx0) - 8, y: cy1 - h, width: 16, height: h))
    }
    for (col, lw, fn) in [(LCYAN.copy(alpha: 0.85)!, 2.0, 0), (ORANGE, 3.5, 1)] {
      ctx.setStrokeColor(col); ctx.setLineWidth(lw); ctx.beginPath()
      for k in 0...Int(100 * dr) {
        let u = Double(k) / 100
        let v = fn == 1 ? perf(u, s) : 0.33 + 0.12 * sin(u * 8 - s * 1.1) + 0.18 * u
        let x = cx0 + u * (cx1 - cx0), y = cy1 - v * (cy1 - cy0) * 0.95
        if k == 0 { ctx.move(to: CGPoint(x: x, y: y)) } else { ctx.addLine(to: CGPoint(x: x, y: y)) }
      }
      ctx.strokePath()
    }
    let x = cx0 + dr * (cx1 - cx0), y = cy1 - perf(dr, s) * (cy1 - cy0) * 0.95
    ctx.setFillColor(ORANGE); ctx.fillEllipse(in: CGRect(x: x - 7, y: y - 7, width: 14, height: 14))
  }
}
