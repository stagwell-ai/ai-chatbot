// Stagwell ID Graph (tab film): the spine stands on the right; households reach it from across the frame.
import CoreGraphics
import Foundation
let W = 1920, H = 1080, FPS = 30, L = 10.0
var rng = RNG(s: 67)
let spineX = 1620.0, spineTop = 170.0, spineBot = 910.0, spineMid = 540.0
struct House { var x, y: Double; var people: [(Double, Double)]; var seg: Int; var born: Double }
var houses: [House] = []
for i in 0..<130 {
  let right = i % 5 == 0
  let x = right ? rng.r(1720, 1870) : rng.r(80, 1540)
  let y = rng.r(90, 1000)
  var ppl: [(Double, Double)] = []
  let n = Int(rng.r(1, 5.99))
  for k in 0..<n { let a = TAU * Double(k) / Double(n) + rng.r(0, 1); ppl.append((cos(a) * 16, sin(a) * 16)) }
  let seg = rng.next() < 0.2 ? 1 : (rng.next() < 0.22 ? 2 : 0)
  houses.append(House(x: x, y: y, people: ppl, seg: seg, born: 0.1 + 1.0 * (abs(x - spineX) / 1540) + rng.r(0, 0.3)))
}
func segColor(_ s: Int) -> CGColor { s == 1 ? ORANGE : (s == 2 ? LCYAN : white(1)) }
render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: Int(L) * FPS) { ctx, f in
  let s = Double(f) / Double(FPS)
  ground(ctx, W, H)
  let seg = s < 2.6 ? 0 : (Int((s - 2.6) / 1.6) % 2 == 0 ? 1 : 2)
  let sp = ease((s - 0.6) / 0.6)
  for h in houses {
    let age = s - h.born
    if age < 0 { continue }
    let a = ease(age / 0.25)
    let far = h.x < 1340 ? 0.55 : 1.0      // under the cards: quieter
    for p in h.people {
      ctx.setStrokeColor(white(0.75 * a * far)); ctx.setLineWidth(1.3)
      ctx.strokeEllipse(in: CGRect(x: h.x + p.0 - 4 * a, y: h.y + p.1 - 4 * a, width: 8 * a, height: 8 * a))
    }
    let hl = ease((age - 0.2) / 0.3)
    if hl > 0 {
      ctx.setStrokeColor(white(0.3 * hl * far)); ctx.setLineWidth(1)
      for p in h.people { ctx.beginPath(); ctx.move(to: CGPoint(x: h.x, y: h.y)); ctx.addLine(to: CGPoint(x: h.x + p.0 * hl, y: h.y + p.1 * hl)); ctx.strokePath() }
      let lit = seg != 0 && h.seg == seg
      ctx.setFillColor((lit ? segColor(h.seg) : white(0.85 * far)).copy(alpha: hl)!)
      ctx.fill(CGRect(x: h.x - 4, y: h.y - 4, width: 8, height: 8))
    }
    let ln = ease((s - max(h.born + 0.5, 1.2)) / 0.5)
    if ln > 0 && sp > 0.5 {
      let lit = seg != 0 && h.seg == seg
      let ex = spineX + (h.x < spineX ? -2 : 2)
      let ty = min(spineBot, max(spineTop, h.y + (spineMid - h.y) * 0.3))
      let mx = h.x + (ex - h.x) * ln, my = h.y + (ty - h.y) * ln
      ctx.setStrokeColor((lit ? segColor(h.seg) : white(1)).copy(alpha: (lit ? 0.75 : 0.06) * ln)!); ctx.setLineWidth(lit ? 1.5 : 1)
      ctx.beginPath(); ctx.move(to: CGPoint(x: h.x, y: h.y))
      ctx.addCurve(to: CGPoint(x: mx, y: my), control1: CGPoint(x: h.x + (mx - h.x) * 0.55, y: h.y), control2: CGPoint(x: h.x + (mx - h.x) * 0.45, y: my))
      ctx.strokePath()
      if lit && ln >= 1 {
        let q = (s * 0.6 + h.x * 0.0013).truncatingRemainder(dividingBy: 1)
        let e3 = q * q * (3 - 2 * q)
        ctx.setFillColor(segColor(h.seg)); ctx.fillEllipse(in: CGRect(x: h.x + (ex - h.x) * q - 3, y: h.y + (ty - h.y) * e3 - 3, width: 6, height: 6))
      }
    }
  }
  if sp > 0 {
    let half = (spineBot - spineTop) / 2 * sp
    ctx.setFillColor(white(0.95)); ctx.fill(CGRect(x: spineX - 2, y: spineMid - half, width: 4, height: half * 2))
    var y = spineTop
    while y <= spineBot { if abs(y - spineMid) <= half { ctx.fill(CGRect(x: spineX - 8, y: y - 1, width: 16, height: 2)) }; y += 37 }
    text(ctx, "IDENTITY SPINE", spineX - 150, spineTop - 26, mono(16), white(0.8 * sp), tracking: 2)
  }
  let lg = ease((s - 2.6) / 0.4)
  if lg > 0 {
    text(ctx, "PEOPLE  ·  HOUSEHOLDS  ·", 120, 880, mono(15), white(0.6 * lg), tracking: 1.5)
    text(ctx, "AUDIENCE", 400, 880, mono(15), (seg == 2 ? LCYAN : ORANGE).copy(alpha: lg)!, tracking: 1.5)
    text(ctx, "PRIVACY-SAFE", 1400, 880, mono(15), white(0.6 * lg), tracking: 1.5)
  }
}
