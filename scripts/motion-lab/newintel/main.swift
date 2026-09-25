// NewIntel (tab film): the radar lives on the right third, clear of the cards.
import CoreGraphics
import Foundation
let W = 1920, H = 1080, FPS = 30, L = 10.0
var rng = RNG(s: 41)
let cx = 1610.0, cy = 510.0, R = 270.0
let kinds = ["PRICING", "HIRING", "COVERAGE", "CREATOR"]
struct Blip { var a, d: Double; var kind: Int; var labelled: Bool }
var blips: [Blip] = []
for i in 0..<60 {
  blips.append(Blip(a: rng.r(0, TAU), d: R * (0.18 + 0.78 * sqrt(rng.next())), kind: Int(rng.next() * 4), labelled: i % 5 == 0))
}
let SWEEP = 2.2
render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: Int(L) * FPS) { ctx, f in
  let s = Double(f) / Double(FPS)
  ground(ctx, W, H)
  ambientDots(ctx, W, H, s, 1, seed: 4)
  for k in 1...4 {
    let g = ease((s - Double(k) * 0.07) / 0.45)
    if g <= 0 { continue }
    ctx.setStrokeColor(white(k == 4 ? 0.3 : 0.16)); ctx.setLineWidth(1.2)
    ctx.addArc(center: CGPoint(x: cx, y: cy), radius: R * Double(k) / 4, startAngle: -Double.pi / 2, endAngle: -Double.pi / 2 + TAU * g, clockwise: false)
    ctx.strokePath()
  }
  let cross = ease((s - 0.2) / 0.4)
  ctx.setStrokeColor(white(0.14)); ctx.setLineWidth(1)
  ctx.beginPath(); ctx.move(to: CGPoint(x: cx - R * cross, y: cy)); ctx.addLine(to: CGPoint(x: cx + R * cross, y: cy))
  ctx.move(to: CGPoint(x: cx, y: cy - R * cross)); ctx.addLine(to: CGPoint(x: cx, y: cy + R * cross)); ctx.strokePath()
  for k in 0..<60 where cross > 0 {
    let a = TAU * Double(k) / 60, l = k % 5 == 0 ? 12.0 : 5.0
    ctx.setStrokeColor(white(0.35 * cross))
    ctx.beginPath(); ctx.move(to: CGPoint(x: cx + cos(a) * (R + 8), y: cy + sin(a) * (R + 8)))
    ctx.addLine(to: CGPoint(x: cx + cos(a) * (R + 8 + l), y: cy + sin(a) * (R + 8 + l))); ctx.strokePath()
  }
  let sw0 = 0.5
  if s > sw0 {
    let ang = -Double.pi / 2 + (s - sw0) / SWEEP * TAU
    for k in 0..<36 {
      let a0 = ang - Double(k) * 0.022
      ctx.setStrokeColor(LCYAN.copy(alpha: 0.32 * (1 - Double(k) / 36))!); ctx.setLineWidth(2)
      ctx.beginPath(); ctx.move(to: CGPoint(x: cx, y: cy)); ctx.addLine(to: CGPoint(x: cx + cos(a0) * R, y: cy + sin(a0) * R)); ctx.strokePath()
    }
    ctx.setStrokeColor(white(0.95)); ctx.setLineWidth(2)
    ctx.beginPath(); ctx.move(to: CGPoint(x: cx, y: cy)); ctx.addLine(to: CGPoint(x: cx + cos(ang) * R, y: cy + sin(ang) * R)); ctx.strokePath()
    for b in blips {
      var rel = (b.a + Double.pi / 2).truncatingRemainder(dividingBy: TAU); if rel < 0 { rel += TAU }
      let found = sw0 + rel / TAU * SWEEP * 0.5
      if s < found { continue }
      let since = s - found
      let lastPass = ((s - sw0) / SWEEP * TAU - rel).truncatingRemainder(dividingBy: TAU)
      let glow = max(0, 1 - lastPass / 1.2)
      let x = cx + cos(b.a) * b.d, y = cy + sin(b.a) * b.d
      let col = b.kind == 0 ? ORANGE : (b.kind == 1 ? LCYAN : (b.kind == 2 ? white(1) : YELLOW))
      let sz = (b.labelled ? 10.0 : 6.0) * (1 + 0.6 * glow) * ease(since / 0.2)
      ctx.setFillColor(col.copy(alpha: 0.55 + 0.45 * glow)!)
      ctx.fill(CGRect(x: x - sz / 2, y: y - sz / 2, width: sz, height: sz))
      if b.labelled {
        let la = ease((since - 0.1) / 0.3)
        if la > 0 {
          let name = kinds[b.kind]
          let tw = Double(name.count) * 10.2
          let right = x + 70 + 18 + tw < 1890
          let lx = right ? x + 50 : x - 50, ly = y - 34
          ctx.setStrokeColor(col.copy(alpha: 0.8 * la)!); ctx.setLineWidth(1)
          ctx.beginPath(); ctx.move(to: CGPoint(x: x, y: y)); ctx.addLine(to: CGPoint(x: lx, y: ly)); ctx.addLine(to: CGPoint(x: lx + (right ? 16 : -16), y: ly)); ctx.strokePath()
          ctx.stroke(CGRect(x: x - 11, y: y - 11, width: 22, height: 22))
          let shown = String(name.prefix(Int(Double(name.count) * la + 0.5)))
          text(ctx, shown, right ? lx + 22 : lx - 22 - tw, ly + 5, mono(16), col.copy(alpha: la)!, tracking: 1.2)
        }
      }
    }
  }
  let days = ["M", "T", "W", "T", "F", "S", "S"]
  let wx = 1400.0, ww = 420.0, wy = 890.0
  let wk = ease((s - 0.3) / 0.4)
  if wk > 0 {
    ctx.setFillColor(white(0.16)); ctx.fill(CGRect(x: wx, y: wy, width: ww * wk, height: 2))
    let prog = min(1, max(0, (s - 0.8) / 8.5))
    ctx.setFillColor(ORANGE); ctx.fill(CGRect(x: wx, y: wy, width: ww * prog, height: 2))
    for (k, d) in days.enumerated() {
      text(ctx, d, wx + ww * Double(k) / 6 - 5, wy - 14, mono(15), white((Double(k) / 6 <= prog ? 0.9 : 0.35) * wk))
    }
  }
  text(ctx, "COMPETITIVE SIGNAL · THIS WEEK", 1400, 180, mono(16), white(0.75 * ease((s - 0.1) / 0.3)), tracking: 2)
}
