// Stagwell ID Graph: the identity spine. Anonymous people group into households,
// households connect to one spine, and audiences light up without exposing anyone.
import CoreGraphics
import Foundation
let W = 1920, H = 1080, FPS = 30, L = 10.0
var rng = RNG(s: 67)
struct House { var x, y: Double; var people: [(Double, Double)]; var seg: Int; var born: Double; var side: Int }
var houses: [House] = []
let spineX = 960.0
for i in 0..<120 {
  let side = i % 2
  let x = side == 0 ? rng.r(120, spineX - 160) : rng.r(spineX + 160, 1800)
  let y = rng.r(110, 970)
  var ppl: [(Double, Double)] = []
  let n = Int(rng.r(1, 5.99))
  for k in 0..<n { let a = TAU * Double(k) / Double(n) + rng.r(0, 1); ppl.append((cos(a) * 16, sin(a) * 16)) }
  let seg = rng.next() < 0.18 ? 1 : (rng.next() < 0.2 ? 2 : 0)
  let dist = abs(x - spineX) / 840
  houses.append(House(x: x, y: y, people: ppl, seg: seg, born: 0.1 + 1.1 * dist + rng.r(0, 0.4), side: side))
}
func segColor(_ s: Int) -> CGColor { s == 1 ? ORANGE : (s == 2 ? LCYAN : white(1)) }
render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: Int(L) * FPS) { ctx, f in
  let s = Double(f) / Double(FPS)
  ground(ctx, W, H)
  // the spine
  let sp = ease((s - 1.0) / 0.7)
  if sp > 0 {
    ctx.setFillColor(white(0.9)); ctx.fill(CGRect(x: spineX - 1.5, y: 540 - 470 * sp, width: 3, height: 940 * sp))
    for k in 0..<24 {
      let y = 70 + Double(k) * 40
      if abs(y - 540) > 470 * sp { continue }
      ctx.setFillColor(white(0.9)); ctx.fill(CGRect(x: spineX - 6, y: y - 1, width: 12, height: 2))
    }
    text(ctx, "IDENTITY SPINE", spineX + 18, 90, mono(14), white(0.7 * sp), tracking: 2)
  }
  // segments take turns lighting up once built
  let seg = s < 3.2 ? 0 : (Int((s - 3.2) / 1.6) % 2 == 0 ? 1 : 2)
  for h in houses {
    let age = s - h.born
    if age < 0 { continue }
    let a = ease(age / 0.25)
    // people: hollow rings, never a face
    for p in h.people {
      ctx.setStrokeColor(white(0.75 * a)); ctx.setLineWidth(1.3)
      let r = 4.0 * a
      ctx.strokeEllipse(in: CGRect(x: h.x + p.0 - r, y: h.y + p.1 - r, width: r * 2, height: r * 2))
    }
    // household: people linked, then a small square core
    let hl = ease((age - 0.25) / 0.3)
    if hl > 0 {
      ctx.setStrokeColor(white(0.3 * hl)); ctx.setLineWidth(1)
      for p in h.people { ctx.beginPath(); ctx.move(to: CGPoint(x: h.x, y: h.y)); ctx.addLine(to: CGPoint(x: h.x + p.0 * hl, y: h.y + p.1 * hl)); ctx.strokePath() }
      let lit = seg != 0 && h.seg == seg
      ctx.setFillColor((lit ? segColor(h.seg) : white(0.85)).copy(alpha: hl)!)
      ctx.fill(CGRect(x: h.x - 4, y: h.y - 4, width: 8, height: 8))
    }
    // household to spine
    let ln = ease((s - max(h.born + 0.6, 1.5)) / 0.5)
    if ln > 0 && sp > 0.5 {
      let lit = seg != 0 && h.seg == seg
      let ty = h.y + (540 - h.y) * 0.28
      let ex = spineX + (h.side == 0 ? -2 : 2)
      let mx = h.x + (ex - h.x) * ln
      ctx.setStrokeColor((lit ? segColor(h.seg) : white(1)).copy(alpha: (lit ? 0.75 : 0.07) * ln)!); ctx.setLineWidth(lit ? 1.4 : 1)
      ctx.beginPath(); ctx.move(to: CGPoint(x: h.x, y: h.y))
      let ey = h.y + (ty - h.y) * ln
      ctx.addCurve(to: CGPoint(x: mx, y: ey), control1: CGPoint(x: h.x + (mx - h.x) * 0.55, y: h.y), control2: CGPoint(x: h.x + (mx - h.x) * 0.45, y: ey))
      ctx.strokePath()
      // signal running to the spine
      if lit && ln >= 1 {
        let q = ((s * 0.7 + h.x * 0.001).truncatingRemainder(dividingBy: 1))
        let e3 = q * q * (3 - 2 * q)
        let px = h.x + (ex - h.x) * q, py = h.y + (ty - h.y) * e3
        ctx.setFillColor(segColor(h.seg)); ctx.fillEllipse(in: CGRect(x: px - 2.5, y: py - 2.5, width: 5, height: 5))
      }
    }
  }
  // legend
  let lg = ease((s - 3.0) / 0.4)
  if lg > 0 {
    text(ctx, "PEOPLE", 120, 1030, mono(13), white(0.6 * lg), tracking: 1.5)
    text(ctx, "HOUSEHOLDS", 240, 1030, mono(13), white(0.6 * lg), tracking: 1.5)
    text(ctx, "AUDIENCE", 410, 1030, mono(13), (seg == 2 ? LCYAN : ORANGE).copy(alpha: lg)!, tracking: 1.5)
    text(ctx, "PRIVACY-SAFE · NO INDIVIDUAL EXPOSED", 1340, 1030, mono(13), white(0.6 * lg), tracking: 1.5)
  }
}
