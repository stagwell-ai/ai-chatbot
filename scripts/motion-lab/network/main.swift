import CoreGraphics
import Foundation

let W = 1920, H = 1080, FPS = 30, L = 10.0
let FR = Int(L) * FPS
let TAU = Double.pi * 2
var rng = RNG(s: 7)

struct Node { var x, y, w, h: Double; var kind: Int; var ph: Double; var cyc: Bool }
var nodes: [Node] = []
// clusters, like the reference: denser right and bottom-left
let hubs: [(Double, Double, Double, Int)] = [(1300,300,440,190),(260,760,280,120),(1150,800,400,130),(700,430,320,60),(1680,640,320,95),(200,260,300,30),(900,120,320,45),(1750,200,220,40)]
for (cx, cy, r, n) in hubs {
  for _ in 0..<n {
    let a = rng.r(0, TAU), d = r * pow(rng.next(), 0.7)
    let x = cx + cos(a) * d, y = cy + sin(a) * d * 0.8
    if x < -20 || x > Double(W) + 20 || y < -20 || y > Double(H) + 20 { continue }
    let big = rng.next()
    var w = rng.r(8, 16), h = rng.r(5, 8)
    if big > 0.975 { w = rng.r(32, 44); h = w * rng.r(0.75, 1.0) } else if big > 0.86 { w = rng.r(18, 26); h = rng.r(10, 14) }
    let k = rng.next()
    var kind = k < 0.04 ? 1 : k < 0.08 ? 2 : k < 0.11 ? 3 : 0   // 1 orange, 2 cyan, 3 outlined
    if big > 0.86 { kind = 0 }
    if kind == 1 || kind == 2 { w = rng.r(11, 15); h = rng.r(6, 8) }
    if kind == 3 { w = rng.r(9, 13); h = rng.r(4, 6) }
    nodes.append(Node(x: x, y: y, w: w, h: h, kind: kind, ph: rng.next(), cyc: rng.next() < 0.3))
  }
}
struct Edge { var a, b: Int; var c1x, c1y, c2x, c2y: Double; var ph: Double; var speed: Int; var cyc: Bool; var elbow: Bool }
var edges: [Edge] = []
for i in 0..<nodes.count {
  var near: [(Double, Int)] = []
  for j in 0..<nodes.count where j != i {
    let d = hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
    if d < 260 && d > 24 { near.append((d, j)) }
  }
  near.sort { $0.0 < $1.0 }
  let k = Int(rng.r(1, 4.6))
  for (_, j) in near.prefix(k) where j > i || rng.next() < 0.3 {
    let a = nodes[i], b = nodes[j]
    let bend = rng.r(-0.5, 0.5)
    let mx = b.x - a.x, my = b.y - a.y
    edges.append(Edge(a: i, b: j,
      c1x: a.x + mx * (0.5 + bend), c1y: a.y,
      c2x: a.x + mx * (0.5 - bend), c2y: b.y,
      ph: rng.next(), speed: Int(rng.r(1, 3.99)), cyc: rng.next() < 0.35, elbow: rng.next() < 0.25))
  }
}
print("nodes", nodes.count, "edges", edges.count)

func bez(_ e: Edge, _ t: Double) -> (Double, Double) {
  let a = nodes[e.a], b = nodes[e.b], u = 1 - t
  if e.elbow { // orthogonal: across then down
    if t < 0.5 { let s = t * 2; return (a.x + (b.x - a.x) * s, a.y) }
    let s = (t - 0.5) * 2; return (b.x, a.y + (b.y - a.y) * s)
  }
  let x = u*u*u*a.x + 3*u*u*t*e.c1x + 3*u*t*t*e.c2x + t*t*t*b.x
  let y = u*u*u*a.y + 3*u*u*t*e.c1y + 3*u*t*t*e.c2y + t*t*t*b.y
  return (x, y)
}
func smooth(_ x: Double) -> Double { let c = max(0, min(1, x)); return c * c * (3 - 2 * c) }
// a looping life-cycle: 0→1 grow, hold, 1→0 retract. p in [0,1)
func life(_ p: Double) -> Double {
  let q = p - floor(p)
  if q < 0.18 { return smooth(q / 0.18) }
  if q < 0.72 { return 1 }
  if q < 0.88 { return 1 - smooth((q - 0.72) / 0.16) }
  return 0
}
let ORANGE = CGColor(red: 1, green: 0.427, blue: 0.141, alpha: 1)
let CYAN = CGColor(red: 0.12, green: 0.72, blue: 0.86, alpha: 1)

// build order: outward from a few seeds, so the network grows like it is thinking
let seeds: [(Double, Double)] = [(1300, 330), (300, 740), (1150, 820), (720, 430)]
var appear = [Double](repeating: 0, count: nodes.count)
do {
  var keyed: [(Double, Int)] = []
  for (i, n) in nodes.enumerated() {
    var d = 1e9
    for (k, sd) in seeds.enumerated() { d = min(d, hypot(n.x - sd.0, n.y - sd.1) + Double(k) * 60) }
    keyed.append((d + rng.r(0, 160), i))
  }
  keyed.sort { $0.0 < $1.0 }
  for (rank, (_, i)) in keyed.enumerated() {
    let u = Double(rank) / Double(keyed.count - 1)
    appear[i] = 0.15 + 4.1 * pow(u, 0.85)     // seconds: built by 5 s
  }
}
let BUILT = 5.0
func ease(_ x: Double) -> Double { let c = max(0, min(1, x)); return 1 - pow(1 - c, 3) }
func pop(_ x: Double) -> Double {           // 0 → overshoot → 1
  let c = max(0, min(1, x)); return c < 1 ? 1 + 2.2 * pow(c - 1, 3) + 1.2 * pow(c - 1, 2) : 1 }

render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: FR) { ctx, f in
  let sec = Double(f) / Double(FPS)
  let t = Double(f) / Double(FR)
  ctx.setFillColor(CGColor(red: 0.105, green: 0.105, blue: 0.11, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  // the frame settles back as the picture fills: a slow pull-out, not a drift
  let z = 1.18 - 0.18 * ease(sec / 5.5)
  ctx.translateBy(x: Double(W) / 2, y: Double(H) / 2)
  ctx.scaleBy(x: z, y: z)
  ctx.translateBy(x: -Double(W) / 2, y: -Double(H) / 2)
  let alive = max(0, min(1, (sec - BUILT + 0.8) / 0.8))

  ctx.setLineWidth(0.9)
  for e in edges {
    let start = max(appear[e.a], appear[e.b]) + 0.15
    let g = ease((sec - start) / 0.45)
    if g <= 0.01 { continue }
    let steps = 28, n = max(1, Int(Double(steps) * g))
    ctx.beginPath()
    var p = bez(e, 0); ctx.move(to: CGPoint(x: p.0, y: p.1))
    for s in 1...n { p = bez(e, Double(s) / Double(steps)); ctx.addLine(to: CGPoint(x: p.0, y: p.1)) }
    ctx.setStrokeColor(CGColor(gray: 1, alpha: 0.28))
    ctx.strokePath()
    // the drawing tip glows while the wire is being laid
    if g < 1 {
      ctx.setFillColor(CGColor(gray: 1, alpha: 0.95))
      ctx.fillEllipse(in: CGRect(x: p.0 - 2, y: p.1 - 2, width: 4, height: 4))
    }
    ctx.setFillColor(CGColor(gray: 1, alpha: 0.8 * g))
    let e0 = bez(e, 0); ctx.fillEllipse(in: CGRect(x: e0.0 - 1.5, y: e0.1 - 1.5, width: 3, height: 3))
    // once alive, sparks run the wires
    if alive > 0 && g >= 1 {
      let q = (t * Double(e.speed) * 1.25 + e.ph).truncatingRemainder(dividingBy: 1)
      if q < 0.55 {
        let s = q / 0.55, hp = bez(e, s)
        let isAccent = nodes[e.a].kind == 1 || nodes[e.a].kind == 2
        let col = isAccent ? (nodes[e.a].kind == 1 ? ORANGE : CYAN) : CGColor(gray: 1, alpha: 0.95)
        ctx.setFillColor(col.copy(alpha: alive)!)
        ctx.fillEllipse(in: CGRect(x: hp.0 - 1.8, y: hp.1 - 1.8, width: 3.6, height: 3.6))
        ctx.beginPath()
        let tp = bez(e, max(0, s - 0.08))
        ctx.move(to: CGPoint(x: tp.0, y: tp.1)); ctx.addLine(to: CGPoint(x: hp.0, y: hp.1))
        ctx.setStrokeColor(CGColor(gray: 1, alpha: 0.7 * alive)); ctx.strokePath()
      }
    }
  }
  for (i, n) in nodes.enumerated() {
    let v = pop((sec - appear[i]) / 0.25)
    if sec < appear[i] { continue }
    let flash = max(0, 1 - (sec - appear[i]) / 0.5)          // born bright
    let breathe = 1 - alive * (0.22 - 0.22 * sin((t * 3 + n.ph) * TAU))
    let w = n.w * v, h = n.h * v
    let r = CGRect(x: n.x - w / 2, y: n.y - h / 2, width: w, height: h)
    switch n.kind {
    case 1, 2:
      let on = alive > 0 ? (0.35 + 0.65 * pow(max(0, sin((t * 4 + n.ph) * TAU)), 3)) * alive + (1 - alive) : 1
      ctx.setFillColor((n.kind == 1 ? ORANGE : CYAN).copy(alpha: on)!)
      ctx.fill(r)
    case 3:
      ctx.setStrokeColor(CGColor(gray: 1, alpha: 0.85)); ctx.setLineWidth(1.2)
      ctx.stroke(r.insetBy(dx: -4 * v, dy: -4 * v))
      ctx.setFillColor(CGColor(gray: 1, alpha: 0.9)); ctx.fill(r.insetBy(dx: w * 0.25, dy: h * 0.25))
      ctx.setLineWidth(0.9)
    default:
      ctx.setFillColor(CGColor(gray: min(1, 0.93 + flash * 0.07), alpha: min(1, breathe + flash))); ctx.fill(r)
    }
  }
}
