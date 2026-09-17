// NewIntel: what your competitors did this week. A radar sweep finds competitor signals.
import CoreGraphics
import Foundation
let W = 1920, H = 1080, FPS = 30, L = 10.0
var rng = RNG(s: 41)
let cx = 960.0, cy = 520.0, R = 400.0
let kinds = ["PRICING", "HIRING", "COVERAGE", "CREATOR"]
struct Blip { var a, d: Double; var kind: Int; var labelled: Bool; var dx, dy: Double }
var blips: [Blip] = []
for i in 0..<90 {
  let a = rng.r(0, TAU), d = R * (0.15 + 0.82 * sqrt(rng.next()))
  blips.append(Blip(a: a, d: d, kind: Int(rng.next() * 4), labelled: i % 6 == 0, dx: rng.r(40, 90) * (cos(a) >= 0 ? 1 : -1), dy: rng.r(-60, -24)))
}
let SWEEP = 2.2   // seconds per turn
render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: Int(L) * FPS) { ctx, f in
  let s = Double(f) / Double(FPS)
  ground(ctx, W, H)
  // rings draw in
  for k in 1...5 {
    let g = ease((s - Double(k) * 0.08) / 0.5)
    if g <= 0 { continue }
    let r = R * Double(k) / 5
    ctx.setStrokeColor(white(0.16 + (k == 5 ? 0.1 : 0))); ctx.setLineWidth(1)
    ctx.addArc(center: CGPoint(x: cx, y: cy), radius: r, startAngle: -Double.pi / 2, endAngle: -Double.pi / 2 + TAU * g, clockwise: false)
    ctx.strokePath()
  }
  let cross = ease((s - 0.2) / 0.5)
  ctx.setStrokeColor(white(0.14)); ctx.setLineWidth(1)
  ctx.beginPath(); ctx.move(to: CGPoint(x: cx - R * cross, y: cy)); ctx.addLine(to: CGPoint(x: cx + R * cross, y: cy))
  ctx.move(to: CGPoint(x: cx, y: cy - R * cross)); ctx.addLine(to: CGPoint(x: cx, y: cy + R * cross)); ctx.strokePath()
  // tick marks
  for k in 0..<72 where cross > 0 {
    let a = TAU * Double(k) / 72, l = k % 6 == 0 ? 14.0 : 6.0
    ctx.setStrokeColor(white(0.35 * cross))
    ctx.beginPath(); ctx.move(to: CGPoint(x: cx + cos(a) * (R + 8), y: cy + sin(a) * (R + 8)))
    ctx.addLine(to: CGPoint(x: cx + cos(a) * (R + 8 + l), y: cy + sin(a) * (R + 8 + l))); ctx.strokePath()
  }
  // sweep
  let sw0 = 0.7
  if s > sw0 {
    let ang = -Double.pi / 2 + (s - sw0) / SWEEP * TAU
    for k in 0..<40 {   // fading trail
      let a0 = ang - Double(k) * 0.02
      ctx.setStrokeColor(LCYAN.copy(alpha: 0.35 * (1 - Double(k) / 40))!)
      ctx.setLineWidth(2)
      ctx.beginPath(); ctx.move(to: CGPoint(x: cx, y: cy)); ctx.addLine(to: CGPoint(x: cx + cos(a0) * R, y: cy + sin(a0) * R)); ctx.strokePath()
    }
    ctx.setStrokeColor(white(0.95)); ctx.setLineWidth(2)
    ctx.beginPath(); ctx.move(to: CGPoint(x: cx, y: cy)); ctx.addLine(to: CGPoint(x: cx + cos(ang) * R, y: cy + sin(ang) * R)); ctx.strokePath()
    // blips: found the first time the beam passes them, then glow and settle
    for b in blips {
      var rel = (b.a + Double.pi / 2).truncatingRemainder(dividingBy: TAU); if rel < 0 { rel += TAU }
      let found = sw0 + rel / TAU * SWEEP * 0.5      // first pass is quick
      if s < found { continue }
      let since = s - found
      var lastPass = (s - sw0) / SWEEP * TAU - rel
      lastPass = lastPass.truncatingRemainder(dividingBy: TAU)
      let glow = max(0, 1 - lastPass / 1.2)
      let x = cx + cos(b.a) * b.d, y = cy + sin(b.a) * b.d
      let col = b.kind == 0 ? ORANGE : (b.kind == 1 ? LCYAN : (b.kind == 2 ? white(1) : YELLOW))
      let sz = (b.labelled ? 10.0 : 6.0) * (1 + 0.6 * glow) * ease(since / 0.2)
      ctx.setFillColor(col.copy(alpha: 0.55 + 0.45 * glow)!)
      ctx.fill(CGRect(x: x - sz / 2, y: y - sz / 2, width: sz, height: sz))
      if b.labelled {
        let la = ease((since - 0.1) / 0.3)
        if la > 0 {
          let lx = x + b.dx, ly = y + b.dy
          ctx.setStrokeColor(col.copy(alpha: 0.8 * la)!); ctx.setLineWidth(1)
          ctx.beginPath(); ctx.move(to: CGPoint(x: x, y: y)); ctx.addLine(to: CGPoint(x: lx, y: ly)); ctx.addLine(to: CGPoint(x: lx + (b.dx > 0 ? 18 : -18), y: ly)); ctx.strokePath()
          ctx.stroke(CGRect(x: x - 12, y: y - 12, width: 24, height: 24))
          let name = kinds[b.kind]
          let shown = String(name.prefix(Int(Double(name.count) * la + 0.5)))
          let tx = b.dx > 0 ? lx + 24 : lx - 24 - Double(name.count) * 9
          text(ctx, shown, tx, ly + 5, mono(14), col.copy(alpha: la)!, tracking: 1.2)
        }
      }
    }
  }
  // the week, filling along the bottom
  let days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
  let wx = 560.0, ww = 800.0, wy = 1000.0
  let wk = ease((s - 0.4) / 0.5)
  if wk > 0 {
    ctx.setFillColor(white(0.14)); ctx.fill(CGRect(x: wx, y: wy, width: ww * wk, height: 2))
    let prog = min(1, max(0, (s - 1) / 8.5))
    ctx.setFillColor(ORANGE); ctx.fill(CGRect(x: wx, y: wy, width: ww * prog, height: 2))
    for (k, d) in days.enumerated() {
      let x = wx + ww * Double(k) / 6
      text(ctx, d, x - 14, wy - 14, mono(13), white((Double(k) / 6 <= prog ? 0.85 : 0.35) * wk), tracking: 1)
    }
  }
  text(ctx, "COMPETITIVE SIGNAL · LIVE", 120, 110, mono(15), white(0.7 * ease((s - 0.2) / 0.4)), tracking: 2)
}
