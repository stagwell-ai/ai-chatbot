import CoreGraphics
import Foundation
import ImageIO

// Fifteen text-free tech loops in the motion-lab style: dark or blue grounds, fine white
// marks, the odd orange or cyan accent. Every scene fills the whole frame (or sits on the
// centre), so the same file crops to 16:9, square or vertical, and every scene is a
// seamless loop: time only enters as whole turns of the loop phase p.
//
//   swiftc -O ../common.swift main.swift -o /tmp/loops
//   /tmp/loops <scene> <out.mp4> [width] [height]

let args = CommandLine.arguments
let SCENE = args[1]
let OUT = args[2]
let W = args.count > 3 ? Int(args[3])! : 1920
let H = args.count > 4 ? Int(args[4])! : 1080
let FPS = 30, L = 10.0
let FR = Int(L) * FPS
let TAU = Double.pi * 2
let Wd = Double(W), Hd = Double(H)
let K = min(Wd, Hd) / 1080          // size unit: scales every mark with the frame
let CX = Wd / 2, CY = Hd / 2
let DIAG = hypot(Wd, Hd) / 2

let NAVY = CGColor(red: 0.043, green: 0.071, blue: 0.125, alpha: 1)
let INK = CGColor(red: 0.024, green: 0.031, blue: 0.047, alpha: 1)
let GRAPH = CGColor(red: 0.125, green: 0.129, blue: 0.137, alpha: 1)
let ORANGE = CGColor(red: 1, green: 0.427, blue: 0.141, alpha: 1)
let CYAN = CGColor(red: 0.467, green: 0.89, blue: 0.965, alpha: 1)
let BLUE = CGColor(red: 0, green: 0.612, blue: 0.741, alpha: 1)

func white(_ a: Double) -> CGColor { CGColor(gray: 1, alpha: max(0, min(1, a))) }
func tint(_ c: CGColor, _ a: Double) -> CGColor { c.copy(alpha: max(0, min(1, a)))! }
func clamp(_ x: Double) -> Double { max(0, min(1, x)) }
func smooth(_ x: Double) -> Double { let c = clamp(x); return c * c * (3 - 2 * c) }
func fract(_ x: Double) -> Double { x - floor(x) }
func hash(_ a: Int, _ b: Int = 0) -> Double {
  var x = UInt64(truncatingIfNeeded: a &* 73856093 ^ b &* 19349663) &+ 0x9E3779B97F4A7C15
  x = (x ^ (x >> 30)) &* 0xBF58476D1CE4E5B9
  x = (x ^ (x >> 27)) &* 0x94D049BB133111EB
  x ^= x >> 31
  return Double(x % 100000) / 100000
}
func ground(_ ctx: CGContext, _ c: CGColor) { ctx.setFillColor(c); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H)) }
func dot(_ ctx: CGContext, _ x: Double, _ y: Double, _ r: Double, _ c: CGColor) {
  ctx.setFillColor(c); ctx.fillEllipse(in: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r))
}
func sq(_ ctx: CGContext, _ x: Double, _ y: Double, _ s: Double, _ c: CGColor) {
  ctx.setFillColor(c); ctx.fill(CGRect(x: x - s / 2, y: y - s / 2, width: s, height: s))
}
func line(_ ctx: CGContext, _ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ c: CGColor, _ w: Double) {
  ctx.setStrokeColor(c); ctx.setLineWidth(w)
  ctx.move(to: CGPoint(x: x1, y: y1)); ctx.addLine(to: CGPoint(x: x2, y: y2)); ctx.strokePath()
}
// the pale blue ground of the "your stack" film: soft blue pools on near-white
func blueGround(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.86, green: 0.93, blue: 0.98, alpha: 1))
  let cs = CGColorSpaceCreateDeviceRGB()
  let pools: [(Double, Double, Double, Double)] = [(0.28, 0.35, 0.55, 0), (0.78, 0.7, 0.5, 2.1), (0.55, 0.05, 0.4, 4.2)]
  for (i, pl) in pools.enumerated() {
    let x = Wd * (pl.0 + 0.04 * sin(TAU * p + pl.3))
    let y = Hd * (pl.1 + 0.04 * cos(TAU * p + pl.3))
    let r = DIAG * pl.2
    let a = i == 0 ? 0.85 : 0.7
    let g = CGGradient(colorsSpace: cs, colors: [CGColor(red: 0.13, green: 0.52, blue: 0.86, alpha: a), CGColor(red: 0.13, green: 0.52, blue: 0.86, alpha: 0)] as CFArray, locations: [0, 1])!
    ctx.drawRadialGradient(g, startCenter: CGPoint(x: x, y: y), startRadius: 0, endCenter: CGPoint(x: x, y: y), endRadius: r, options: [])
  }
}

// 1 · streams: particles riding wavy lanes across the frame, trailing light
func streams(_ ctx: CGContext, _ p: Double) {
  ground(ctx, NAVY)
  let n = Int(700 * Wd * Hd / (1920 * 1080))
  for i in 0..<n {
    let y0 = hash(i, 1) * Hd
    let cyc = Double(1 + Int(hash(i, 2) * 2))
    let x0 = hash(i, 3) * Wd
    let lane = y0 / Hd
    let bright = 0.45 + 0.55 * hash(i, 4)
    let accent = hash(i, 5) > 0.97
    var prev: (Double, Double)? = nil
    for k in 0..<16 {
      let lag = Double(k) * 0.004 / cyc
      let x = fract((x0 / Wd) + (p - lag) * cyc) * Wd
      let u = x / Wd
      let y = y0 + 70 * K * sin(TAU * (u * 2 + lane * 3)) + 26 * K * sin(TAU * (u * 5 - lane * 7))
      let a = bright * (1 - Double(k) / 16)
      let c = accent ? tint(hash(i, 6) > 0.5 ? ORANGE : CYAN, a) : white(a * 0.9)
      if let pr = prev, abs(pr.0 - x) < Wd / 2 { line(ctx, pr.0, pr.1, x, y, c, (k < 3 ? 2.2 : 1.4) * K) }
      if k == 0 { dot(ctx, x, y, 2.4 * K, accent ? tint(hash(i, 6) > 0.5 ? ORANGE : CYAN, 1) : white(bright)) }
      prev = (x, y)
    }
  }
}

// 2 · pulses: a dot grid that swells as rings pass through it
func pulses(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  let sp = 34 * K
  let src: [(Double, Double, Double)] = (0..<8).map { i in (hash(i, 11), hash(i, 12), Double(i) / 8) }
  let rmax = DIAG * 1.1
  var y = sp / 2, j = 0
  while y < Hd {
    var x = sp / 2, i = 0
    while x < Wd {
      var e = 0.0
      for s in src {
        let age = fract(p * 2 - s.2)
        let r = age * rmax
        let d = hypot(x - s.0 * Wd, y - s.1 * Hd)
        let q = (d - r) / (70 * K)
        e += exp(-q * q) * (1 - age)
      }
      e = min(1, e)
      let rad = (1.1 + 3.2 * e) * K
      let acc = e > 0.7 && hash(i, j) > 0.92
      dot(ctx, x, y, rad, acc ? tint(CYAN, 0.9) : white(0.14 + 0.8 * e))
      x += sp; i += 1
    }
    y += sp; j += 1
  }
}

// 3 · orbits: rings of dots, a few of them large and soft, turning slowly on a warm ground
func orbits(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.957, green: 0.945, blue: 0.925, alpha: 1))
  let INKC = CGColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1)
  let SOFTB = CGColor(red: 0.0, green: 0.612, blue: 0.741, alpha: 0.28)
  let R0 = Hd * 0.06, step = Hd * 0.055
  var r = R0, ring = 0
  while r < DIAG * 0.98 {
    ctx.setStrokeColor(INKC.copy(alpha: 0.16)!); ctx.setLineWidth(1 * K)
    ctx.addEllipse(in: CGRect(x: CX - r, y: CY - r, width: 2 * r, height: 2 * r)); ctx.strokePath()
    let n = 4 + ring * 3
    let dir = ring % 2 == 0 ? 1.0 : -1.0
    for k in 0..<n {
      let a = TAU * Double(k) / Double(n) + hash(ring, 41 + k) * 0.5 + dir * p * TAU / Double(2 + ring % 3)
      let x = CX + cos(a) * r, y = CY + sin(a) * r
      let h = hash(ring * 40 + k, 42)
      if h > 0.9 { dot(ctx, x, y, (14 + 22 * hash(ring * 40 + k, 43)) * K, SOFTB); dot(ctx, x, y, 3.5 * K, INKC) }
      else if h > 0.72 { dot(ctx, x, y, 7 * K, SOFTB); dot(ctx, x, y, 2.6 * K, INKC) }
      else { dot(ctx, x, y, 2.4 * K, INKC.copy(alpha: 0.8)!) }
    }
    r += step; ring += 1
  }
  dot(ctx, CX, CY, 4 * K, INKC)
}
// 4 · block rain: columns of small squares falling at their own pace
func blockRain(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  let step = 16 * K, size = 10 * K
  let cols = Int(Wd / step) + 1
  let rowsN = Int(Hd / step) + 30
  for c in 0..<cols {
    let x = Double(c) * step + step / 2
    let drops = 1 + Int(hash(c, 41) * 2.5)
    for d in 0..<drops {
      let speed = Double(1 + Int(hash(c, 42 + d) * 3))
      let off = hash(c, 50 + d)
      let head = Int(fract(off + p * speed) * Double(rowsN))
      let len = 6 + Int(hash(c, 60 + d) * 18)
      for k in 0..<len {
        let row = head - k
        if row < 0 { continue }
        let y = Double(row) * step + step / 2
        if y > Hd + step { continue }
        let a = k == 0 ? 0.95 : 0.55 * pow(1 - Double(k) / Double(len), 1.4)
        let acc = k == 0 && hash(c, 70 + d) > 0.9
        sq(ctx, x, y, size, acc ? ORANGE : white(a))
      }
    }
  }
}

// 5 · plexus: drifting points that wire themselves together when close
func plexus(_ ctx: CGContext, _ p: Double) {
  ground(ctx, GRAPH)
  let n = Int(60 * Wd * Hd / (1920 * 1080))
  var pts: [(Double, Double)] = []
  for i in 0..<n {
    let bx = hash(i, 81) * Wd, by = hash(i, 82) * Hd
    let mx = Double(1 + Int(hash(i, 83) * 2)), my = Double(1 + Int(hash(i, 84) * 2))
    let x = bx + 140 * K * sin(TAU * p * mx + hash(i, 85) * TAU)
    let y = by + 110 * K * cos(TAU * p * my + hash(i, 86) * TAU)
    pts.append((x, y))
  }
  let D = 380 * K
  for i in 0..<n {
    for j in (i + 1)..<n {
      let d = hypot(pts[i].0 - pts[j].0, pts[i].1 - pts[j].1)
      if d < D { line(ctx, pts[i].0, pts[i].1, pts[j].0, pts[j].1, white(0.55 * pow(1 - d / D, 1.4)), 1.6 * K) }
    }
  }
  for (i, q) in pts.enumerated() {
    let big = hash(i, 87) > 0.9
    let acc = hash(i, 88) > 0.95
    if big { sq(ctx, q.0, q.1, 22 * K, acc ? ORANGE : white(0.95)) } else { sq(ctx, q.0, q.1, 9 * K, acc ? CYAN : white(0.9)) }
  }
}

// 6 · lanes: rows of dashes sliding at different speeds, like data in transit
func lanes(_ ctx: CGContext, _ p: Double) {
  ground(ctx, NAVY)
  let gap = 20 * K
  var y = gap / 2, row = 0
  while y < Hd {
    let speed = Double(1 + Int(hash(row, 91) * 3)) * (hash(row, 92) > 0.5 ? 1 : -1)
    let shift = fract(p * speed) * Wd
    var x = 0.0, k = 0
    let thick = (hash(row, 93) > 0.8 ? 3.0 : 1.6) * K
    while x < Wd {
      let len = (20 + hash(row * 131 + k, 94) * 160) * K
      let space = (10 + hash(row * 131 + k, 95) * 120) * K
      let h = hash(row * 131 + k, 96)
      let c: CGColor = h > 0.97 ? ORANGE : h > 0.94 ? CYAN : white(0.25 + 0.6 * hash(row * 131 + k, 97))
      for wrap in [-1.0, 0.0] {
        let sx = x + shift + wrap * Wd
        if sx + len < 0 || sx > Wd { continue }
        ctx.setFillColor(c); ctx.fill(CGRect(x: sx, y: y - thick / 2, width: len, height: thick))
      }
      x += len + space; k += 1
    }
    y += gap; row += 1
  }
}

// 7 · radar: a sweep over a dot field; what it passes lights up and fades
func radar(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  let sweep = fract(p * 2) * TAU
  var r = 110 * K
  while r < DIAG {
    ctx.setStrokeColor(white(0.08)); ctx.setLineWidth(1 * K)
    ctx.addEllipse(in: CGRect(x: CX - r, y: CY - r, width: 2 * r, height: 2 * r)); ctx.strokePath()
    r += 110 * K
  }
  line(ctx, CX, CY, CX + cos(sweep) * DIAG, CY + sin(sweep) * DIAG, white(0.55), 1.4 * K)
  let sp = 26 * K
  var y = sp / 2, j = 0
  while y < Hd {
    var x = sp / 2, i = 0
    while x < Wd {
      let a = atan2(y - CY, x - CX)
      var lag = sweep - a
      lag = lag - floor(lag / TAU) * TAU
      let e = exp(-lag * 0.75)
      let h = hash(i, j * 7 + 3)
      if h > 0.985 {
        dot(ctx, x, y, (2.5 + 5 * e) * K, tint(h > 0.993 ? ORANGE : CYAN, 0.25 + 0.75 * e))
        if e > 0.2 {
          ctx.setStrokeColor(tint(CYAN, e * 0.6)); ctx.setLineWidth(1 * K)
          let rr = (8 + 30 * (1 - e)) * K
          ctx.addEllipse(in: CGRect(x: x - rr, y: y - rr, width: 2 * rr, height: 2 * rr)); ctx.strokePath()
        }
      } else {
        dot(ctx, x, y, (0.9 + 1.2 * e) * K, white(0.07 + 0.6 * e))
      }
      x += sp; i += 1
    }
    y += sp; j += 1
  }
}

// 8 · circuit: right-angle traces with packets running along them
struct Route { var pts: [(Double, Double)]; var len: Double; var speed: Double; var off: Double; var acc: Int }
var ROUTES: [Route] = []
func buildRoutes() {
  let g = 40 * K
  let cols = Int(Wd / g), rows = Int(Hd / g)
  for r in 0..<Int(46 * Wd * Hd / (1920 * 1080)) {
    var cx = Int(hash(r, 101) * Double(cols)), cy = Int(hash(r, 102) * Double(rows))
    var pts: [(Double, Double)] = [(Double(cx) * g + g / 2, Double(cy) * g + g / 2)]
    var dir = Int(hash(r, 103) * 4)
    for s in 0..<(4 + Int(hash(r, 104) * 5)) {
      let run = 2 + Int(hash(r * 17 + s, 105) * 9)
      switch dir { case 0: cx += run; case 1: cy += run; case 2: cx -= run; default: cy -= run }
      cx = max(0, min(cols - 1, cx)); cy = max(0, min(rows - 1, cy))
      pts.append((Double(cx) * g + g / 2, Double(cy) * g + g / 2))
      dir = (dir + (hash(r * 17 + s, 106) > 0.5 ? 1 : 3)) % 4
    }
    var len = 0.0
    for k in 1..<pts.count { len += abs(pts[k].0 - pts[k - 1].0) + abs(pts[k].1 - pts[k - 1].1) }
    if len < g * 3 { continue }
    ROUTES.append(Route(pts: pts, len: len, speed: Double(1 + Int(hash(r, 107) * 2)), off: hash(r, 108), acc: Int(hash(r, 109) * 20)))
  }
}
func along(_ rt: Route, _ d: Double) -> (Double, Double) {
  var rest = max(0, min(rt.len, d))
  for k in 1..<rt.pts.count {
    let a = rt.pts[k - 1], b = rt.pts[k]
    let seg = abs(b.0 - a.0) + abs(b.1 - a.1)
    if rest <= seg && seg > 0 { let t = rest / seg; return (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t) }
    rest -= seg
  }
  return rt.pts.last!
}
func circuit(_ ctx: CGContext, _ p: Double) {
  ground(ctx, NAVY)
  for rt in ROUTES {
    ctx.setStrokeColor(white(0.16)); ctx.setLineWidth(1.4 * K)
    ctx.move(to: CGPoint(x: rt.pts[0].0, y: rt.pts[0].1))
    for q in rt.pts.dropFirst() { ctx.addLine(to: CGPoint(x: q.0, y: q.1)) }
    ctx.strokePath()
    for q in [rt.pts.first!, rt.pts.last!] { sq(ctx, q.0, q.1, 9 * K, white(0.6)) }
  }
  for rt in ROUTES {
    // the packet runs the route and back, so it always stays on its trace
    let u = fract(rt.off + p * rt.speed)
    let tri = u < 0.5 ? u * 2 : 2 - u * 2
    let d = smooth(tri) * rt.len
    let back = u < 0.5 ? -1.0 : 1.0
    for k in 0..<14 {
      let q = along(rt, d + back * Double(k) * 7 * K)
      let a = k == 0 ? 1 : 0.6 * (1 - Double(k) / 14)
      let c: CGColor = rt.acc == 0 ? tint(ORANGE, a) : rt.acc == 1 ? tint(CYAN, a) : white(a)
      sq(ctx, q.0, q.1, (k == 0 ? 7 : 4) * K, c)
    }
  }
}

// 9 · terrain: a perspective field of dots rolling like a slow sea
func terrain(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  let F = 900 * K
  let horizon = Hd * 0.34
  let cam = 260.0
  var zi = 0
  var z = 260.0
  while z < 4200 {
    let span = z * Wd / F * 0.62
    let stepX = 60.0
    var x = -span
    var xi = 0
    while x < span {
      let yv = 70 * sin(x * 0.004 + TAU * p) * cos(z * 0.003 - TAU * p) + 40 * sin((x + z) * 0.0021 - TAU * p * 2)
      let sx = CX + x * F / z
      let sy = horizon + (cam - yv) * F / z
      if sx > -10 && sx < Wd + 10 && sy < Hd + 10 {
        let near = clamp(1 - (z - 260) / 3900)
        let hi = clamp((yv + 60) / 170)
        let r = (0.7 + 2.6 * near) * K
        let acc = hash(xi, zi) > 0.996
        dot(ctx, sx, sy, r, acc ? tint(ORANGE, 0.9 * near + 0.1) : white((0.12 + 0.75 * near) * (0.45 + 0.55 * hi)))
      }
      x += stepX; xi += 1
    }
    z += 60; zi += 1
  }
}

// 10 · mosaic: tiles stepping through shades as waves cross them
func mosaic(_ ctx: CGContext, _ p: Double) {
  ground(ctx, NAVY)
  let s = 26 * K, gap = 4 * K
  var y = 0.0, j = 0
  while y < Hd {
    var x = 0.0, i = 0
    while x < Wd {
      let u = x / Wd, v = y / Hd
      var e = 0.5 + 0.25 * sin(TAU * (p + u * 1.5 + v * 0.7)) + 0.25 * sin(TAU * (p * 2 - u * 0.8 + v * 1.9) + hash(i, j) * 1.2)
      e = clamp(e)
      let level = floor(e * 5) / 4
      let h = hash(i, j * 3 + 1)
      let c: CGColor = level >= 1 && h > 0.9 ? (h > 0.95 ? ORANGE : CYAN) : white(0.04 + 0.55 * level * level)
      ctx.setFillColor(c); ctx.fill(CGRect(x: x + gap / 2, y: y + gap / 2, width: s - gap, height: s - gap))
      x += s; i += 1
    }
    y += s; j += 1
  }
}

// 11 · converge: everything streams into one core
func converge(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  var r = 90 * K
  while r < DIAG {
    ctx.setStrokeColor(white(0.05)); ctx.setLineWidth(1 * K)
    ctx.addEllipse(in: CGRect(x: CX - r, y: CY - r, width: 2 * r, height: 2 * r)); ctx.strokePath()
    r += 90 * K
  }
  let n = 260
  for i in 0..<n {
    let a = hash(i, 121) * TAU
    let speed = Double(1 + Int(hash(i, 122) * 2))
    let u = fract(hash(i, 123) - p * speed)          // 1 at the edge, 0 at the core
    let rr = 40 * K + u * DIAG
    let x = CX + cos(a) * rr, y = CY + sin(a) * rr
    let fade = smooth(u / 0.25) * smooth((1 - u) / 0.1)
    let tail = (30 + 90 * u) * K
    let tx = CX + cos(a) * (rr + tail), ty = CY + sin(a) * (rr + tail)
    let acc = hash(i, 124) > 0.97
    line(ctx, x, y, tx, ty, acc ? tint(ORANGE, fade) : white(0.4 * fade), 1.6 * K)
  }
  ctx.setStrokeColor(white(0.35)); ctx.setLineWidth(1.5 * K)
  ctx.addEllipse(in: CGRect(x: CX - 34 * K, y: CY - 34 * K, width: 68 * K, height: 68 * K)); ctx.strokePath()
  dot(ctx, CX, CY, 10 * K, white(1))
}

// 12 · charts: stacked line graphs rolling on the blue ground
func charts(_ ctx: CGContext, _ p: Double) {
  blueGround(ctx, p)
  let rows = 7
  for r in 0..<rows {
    let base = Hd * (Double(r) + 0.75) / Double(rows)
    let amp = Hd / Double(rows) * 0.42
    let f1 = Double(2 + Int(hash(r, 131) * 3)), f2 = Double(5 + Int(hash(r, 132) * 4))
    let ph = hash(r, 133) * TAU
    func yAt(_ u: Double) -> Double {
      base - amp * (0.55 * (0.5 + 0.5 * sin(TAU * (u * f1 + p) + ph)) + 0.45 * (0.5 + 0.5 * sin(TAU * (u * f2 - p * 2) + ph * 2)))
    }
    let path = CGMutablePath()
    let steps = 220
    for s in 0...steps {
      let u = Double(s) / Double(steps)
      let pt = CGPoint(x: u * Wd, y: yAt(u))
      if s == 0 { path.move(to: pt) } else { path.addLine(to: pt) }
    }
    let area = path.mutableCopy()!
    area.addLine(to: CGPoint(x: Wd, y: base)); area.addLine(to: CGPoint(x: 0, y: base)); area.closeSubpath()
    ctx.addPath(area); ctx.setFillColor(white(0.07)); ctx.fillPath()
    ctx.addPath(path); ctx.setStrokeColor(white(0.95)); ctx.setLineWidth(2 * K); ctx.strokePath()
    line(ctx, 0, base, Wd, base, white(0.35), 1 * K)
    let marks = 12
    for m in 0..<marks {
      let u = (Double(m) + 0.5) / Double(marks)
      dot(ctx, u * Wd, yAt(u), 3.4 * K, (m + r) % 11 == 0 ? ORANGE : white(1))
    }
  }
}

// 13 · clusters: points regrouping, segment after segment
func clusters(_ ctx: CGContext, _ p: Double) {
  ground(ctx, GRAPH)
  let centres: [(Double, Double)] = [(0.2, 0.3), (0.5, 0.22), (0.8, 0.32), (0.26, 0.74), (0.55, 0.62), (0.82, 0.76)]
  let phases = 4
  let seg = p * Double(phases)
  let si = Int(seg) % phases
  let t = smooth((seg - floor(seg) - 0.25) / 0.6)
  let n = Int(900 * Wd * Hd / (1920 * 1080))
  for i in 0..<n {
    func home(_ s: Int) -> Int { Int(hash(i, 140 + (s % phases)) * Double(centres.count)) }
    let a = centres[home(si)], b = centres[home(si + 1)]
    let ang = hash(i, 150) * TAU, rad = pow(hash(i, 151), 0.6) * 150 * K
    let wob = 8 * K * sin(TAU * p * 3 + hash(i, 152) * TAU)
    let cx = (a.0 + (b.0 - a.0) * t) * Wd, cy = (a.1 + (b.1 - a.1) * t) * Hd
    let x = cx + cos(ang) * (rad + wob), y = cy + sin(ang) * (rad + wob)
    let group = home(t < 0.5 ? si : si + 1)
    let c: CGColor = group == 1 ? tint(ORANGE, 0.9) : group == 4 ? tint(CYAN, 0.85) : white(0.35 + 0.5 * hash(i, 153))
    dot(ctx, x, y, (1.6 + hash(i, 154) * 1.8) * K, c)
  }
}

// 14 · globe: a turning sphere of points, arcs lighting between them
func globe(_ ctx: CGContext, _ p: Double) {
  ground(ctx, NAVY)
  let R = min(Wd, Hd) * 0.36
  let rot = p * TAU / 3                          // a third of a turn per loop; the point set repeats every third
  let tilt = 0.35
  func proj(_ x: Double, _ y: Double, _ z: Double) -> (Double, Double, Double) {
    let x1 = x * cos(rot) + z * sin(rot), z1 = -x * sin(rot) + z * cos(rot)
    let y2 = y * cos(tilt) - z1 * sin(tilt), z2 = y * sin(tilt) + z1 * cos(tilt)
    return (CX + x1 * R, CY + y2 * R, z2)
  }
  // latitude rings of dots; each ring's count is a multiple of 3, so a third of a turn looks the same
  let rings = 34
  for li in 1..<rings {
    let lat = -Double.pi / 2 + Double.pi * Double(li) / Double(rings)
    let cnt = max(3, 3 * Int((cos(lat) * 96 / 3).rounded()))
    for k in 0..<cnt {
      let th = TAU * Double(k) / Double(cnt) + Double(li) * 0.37
      let q = proj(cos(lat) * cos(th), sin(lat), cos(lat) * sin(th))
      let front = (q.2 + 1) / 2
      if front < 0.5 { dot(ctx, q.0, q.1, 0.9 * K, white(0.1 * front + 0.03)); continue }
      dot(ctx, q.0, q.1, (0.9 + 1.7 * front) * K, white(0.1 + 0.8 * front * front))
    }
  }
  ctx.setStrokeColor(white(0.14)); ctx.setLineWidth(1 * K)
  ctx.addEllipse(in: CGRect(x: CX - R, y: CY - R, width: 2 * R, height: 2 * R)); ctx.strokePath()
}

// 15 · tunnel: squares rushing out of the centre
func tunnel(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  let n = 30
  let maxS = DIAG * 2.2
  for i in 0..<n {
    let u = fract(Double(i) / Double(n) + p)
    let s = 14 * K * pow(maxS / (14 * K), u)
    let a = smooth(u / 0.15) * (0.15 + 0.7 * u)
    let rect = CGRect(x: CX - s / 2, y: CY - s / 2, width: s, height: s)
    ctx.setStrokeColor(white(a)); ctx.setLineWidth((0.8 + 2.4 * u) * K); ctx.stroke(rect)
    // a runner on every third square
    if i % 3 == 0 {
      let t = fract(hash(i, 171) + p * 2)
      let per = t * 4
      let side = Int(per), f = per - floor(per)
      var x = 0.0, y = 0.0
      switch side {
      case 0: x = rect.minX + f * s; y = rect.minY
      case 1: x = rect.maxX; y = rect.minY + f * s
      case 2: x = rect.maxX - f * s; y = rect.maxY
      default: x = rect.minX; y = rect.maxY - f * s
      }
      sq(ctx, x, y, (3 + 8 * u) * K, i % 9 == 0 ? tint(ORANGE, a + 0.2) : white(a + 0.2))
    }
  }
}

// 16 · media flow: channels on the left run along soft curves into one point, no words
func mediaFlow(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.949, green: 0.949, blue: 0.937, alpha: 1))
  let n = 8, x0 = Wd * 0.12, x1 = Wd * 0.86, hy = Hd / 2
  let top = Hd * 0.14, step = (Hd * 0.72) / Double(n - 1)
  let INKC = CGColor(red: 0.043, green: 0.071, blue: 0.125, alpha: 1)
  func at(_ i: Int, _ t: Double) -> (Double, Double) {
    let y0 = top + Double(i) * step, u = 1 - t
    let c1x = x0 + (x1 - x0) * 0.55, c2x = x0 + (x1 - x0) * 0.45
    return (u*u*u*x0 + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*x1, u*u*u*y0 + 3*u*u*t*y0 + 3*u*t*t*hy + t*t*t*hy)
  }
  for i in 0..<n {
    ctx.setStrokeColor(INKC.copy(alpha: 0.2)!); ctx.setLineWidth(2 * K)
    var q = at(i, 0); ctx.move(to: CGPoint(x: q.0, y: q.1))
    for k in 1...80 { q = at(i, Double(k) / 80); ctx.addLine(to: CGPoint(x: q.0, y: q.1)) }
    ctx.strokePath()
    dot(ctx, x0, top + Double(i) * step, 9 * K, INKC)
  }
  for i in 0..<n { for m in 0..<7 {
    let u = fract(hash(i, 200 + m) + p * Double(1 + m % 2))
    let q = at(i, smooth(u)); let a = smooth(u / 0.12) * smooth((1 - u) / 0.15)
    let acc = (i + m) % 5 == 0
    ctx.setFillColor(acc ? tint(ORANGE, a) : INKC.copy(alpha: 0.9 * a)!)
    ctx.fill(CGRect(x: q.0 - 16 * K, y: q.1 - 4 * K, width: 32 * K, height: 8 * K))
  } }
  let beat = 0.5 + 0.5 * sin(TAU * p * 3)
  ctx.setStrokeColor(INKC.copy(alpha: 0.5)!); ctx.setLineWidth(2 * K)
  let rr = (44 + 10 * beat) * K
  ctx.addEllipse(in: CGRect(x: x1 - rr, y: hy - rr, width: 2 * rr, height: 2 * rr)); ctx.strokePath()
  dot(ctx, x1, hy, 20 * K, INKC)
}
// 17 · identity spine: many strands gather into one bar, then fan out into audience dots
func idSpine(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  let bx = Wd * 0.46, top = Hd * 0.22, bot = Hd * 0.78
  let n = 90
  // strands from the left edge into the bar
  for i in 0..<n {
    let y0 = Hd * (0.05 + 0.9 * hash(i, 501)) + 14 * K * sin(TAU * (p + hash(i, 502)))
    let y1 = top + (bot - top) * (Double(i) + 0.5) / Double(n)
    let acc = i % 9 == 0
    ctx.setStrokeColor(acc ? tint(ORANGE, 0.8) : (i % 3 == 0 ? tint(CYAN, 0.55) : white(0.3)))
    ctx.setLineWidth(1.6 * K)
    ctx.move(to: CGPoint(x: -10, y: y0))
    ctx.addCurve(to: CGPoint(x: bx, y: y1), control1: CGPoint(x: bx * 0.5, y: y0), control2: CGPoint(x: bx * 0.55, y: y1))
    ctx.strokePath()
  }
  ctx.setFillColor(white(0.95)); ctx.fill(CGRect(x: bx - 3 * K, y: top, width: 6 * K, height: bot - top))
  // four branches out of the bar, each splitting into a spray of dots
  let groups = 4
  for g in 0..<groups {
    let gy = top + (bot - top) * (Double(g) + 0.5) / Double(groups)
    let col: CGColor = g == 0 ? ORANGE : (g == 1 ? CYAN : (g == 2 ? CGColor(gray: 1, alpha: 1) : CGColor(red: 1, green: 0.722, blue: 0.11, alpha: 1)))
    let x2 = Wd * 0.66
    ctx.setStrokeColor(col.copy(alpha: 0.85)!); ctx.setLineWidth(2 * K)
    ctx.move(to: CGPoint(x: bx, y: gy)); ctx.addLine(to: CGPoint(x: x2, y: gy)); ctx.strokePath()
    dot(ctx, bx, gy, 6 * K, col)
    let m = 14
    for k in 0..<m {
      let ex = Wd * (0.72 + 0.22 * hash(g * 50 + k, 511)), ey = gy + (hash(g * 50 + k, 512) - 0.5) * Hd * 0.26
      ctx.setStrokeColor(col.copy(alpha: 0.35)!); ctx.setLineWidth(1.1 * K)
      ctx.move(to: CGPoint(x: x2, y: gy))
      ctx.addCurve(to: CGPoint(x: ex, y: ey), control1: CGPoint(x: x2 + (ex - x2) * 0.5, y: gy), control2: CGPoint(x: x2 + (ex - x2) * 0.5, y: ey))
      ctx.strokePath()
      let beat = 0.5 + 0.5 * sin(TAU * (p * 2 + hash(g * 50 + k, 513)))
      dot(ctx, ex, ey, (3 + 4 * beat) * K, col.copy(alpha: 0.5 + 0.5 * beat)!)
    }
    // packets along the branch
    for m2 in 0..<3 {
      let u = fract(hash(g, 520 + m2) + p)
      let x = bx + (x2 - bx) * u
      dot(ctx, x, gy, 4 * K, col)
    }
  }
  // the loose audience dots beyond the branches
  for k in 0..<120 {
    let x = Wd * (0.74 + 0.24 * hash(k, 531)), y = Hd * (0.06 + 0.88 * hash(k, 532))
    let beat = 0.5 + 0.5 * sin(TAU * (p + hash(k, 533)))
    dot(ctx, x, y, (2 + 5 * hash(k, 534) * beat) * K, white(0.25 + 0.5 * beat))
  }
}
// 18 · wave dots: a field of dots lifted by two slow waves crossing it
func waveDots(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.949, green: 0.949, blue: 0.937, alpha: 1))
  let INKC = CGColor(red: 0.043, green: 0.071, blue: 0.125, alpha: 1)
  let sp = 30 * K
  var y = sp / 2, j = 0
  while y < Hd {
    var x = sp / 2, i = 0
    while x < Wd {
      let u = x / Wd, v = y / Hd
      let w = 0.5 + 0.5 * sin(TAU * (p + u * 1.2 - v * 0.6)) * 0.6 + 0.4 * sin(TAU * (2 * p - u * 0.8 + v * 1.4))
      let lift = (w - 0.5)
      let r = (1.2 + 3.2 * max(0, lift + 0.5)) * K
      let acc = hash(i, j) > 0.992 && lift > 0.3
      dot(ctx, x, y - lift * 14 * K, r, acc ? ORANGE : INKC.copy(alpha: 0.18 + 0.7 * max(0, lift + 0.4))!)
      x += sp; i += 1
    }
    y += sp; j += 1
  }
}
// 19 · ripples: rings spreading from a few points over a faint dot grid
func ripples(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  let sp = 40 * K
  var y = sp / 2; while y < Hd { var x = sp / 2; while x < Wd { dot(ctx, x, y, 1.1 * K, white(0.12)); x += sp }; y += sp }
  let src: [(Double, Double, Double)] = [(0.3, 0.42, 0), (0.68, 0.36, 0.33), (0.52, 0.7, 0.66)]
  for s in src {
    for k in 0..<4 {
      let age = fract(p * 2 - s.2 - Double(k) * 0.25)
      let r = age * DIAG * 0.7
      let a = (1 - age) * 0.55
      ctx.setStrokeColor(white(a)); ctx.setLineWidth((2.4 - 1.6 * age) * K)
      ctx.addEllipse(in: CGRect(x: s.0 * Wd - r, y: s.1 * Hd - r, width: 2 * r, height: 2 * r)); ctx.strokePath()
    }
    dot(ctx, s.0 * Wd, s.1 * Hd, 5 * K, white(1))
  }
}
// 20 · pathways: curved traces across the light ground, packets riding them
func pathways(_ ctx: CGContext, _ p: Double) {
  blueGround(ctx, p)
  let INKC = CGColor(red: 0.043, green: 0.071, blue: 0.125, alpha: 1)
  let n = 14
  func pt(_ i: Int, _ t: Double) -> (Double, Double) {
    let y0 = Hd * (0.1 + 0.8 * hash(i, 401)), y1 = Hd * (0.1 + 0.8 * hash(i, 402))
    let x0 = -40.0, x1 = Wd + 40
    let u = 1 - t
    let c1 = (x0 + (x1 - x0) * 0.35, Hd * (0.1 + 0.8 * hash(i, 403))), c2 = (x0 + (x1 - x0) * 0.65, Hd * (0.1 + 0.8 * hash(i, 404)))
    return (u*u*u*x0 + 3*u*u*t*c1.0 + 3*u*t*t*c2.0 + t*t*t*x1, u*u*u*y0 + 3*u*u*t*c1.1 + 3*u*t*t*c2.1 + t*t*t*y1)
  }
  for i in 0..<n {
    ctx.setStrokeColor(INKC.copy(alpha: 0.16)!); ctx.setLineWidth(1.2 * K)
    var q = pt(i, 0); ctx.move(to: CGPoint(x: q.0, y: q.1))
    for k in 1...100 { q = pt(i, Double(k) / 100); ctx.addLine(to: CGPoint(x: q.0, y: q.1)) }
    ctx.strokePath()
    for m in 0..<3 {
      let u = fract(hash(i, 410 + m) + p * Double(1 + (i + m) % 2))
      let head = pt(i, u)
      for k in 0..<10 { let q = pt(i, max(0, u - Double(k) * 0.008)); dot(ctx, q.0, q.1, (3.5 - Double(k) * 0.25) * K, (i % 5 == 0 ? ORANGE : INKC).copy(alpha: 0.9 * (1 - Double(k) / 10))!) }
      dot(ctx, head.0, head.1, 4 * K, i % 5 == 0 ? ORANGE : INKC)
    }
  }
}
// 21 · halo: a dotted ring turning round a soft core, on the light ground
func halo(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.949, green: 0.949, blue: 0.937, alpha: 1))
  let INKC = CGColor(red: 0.043, green: 0.071, blue: 0.125, alpha: 1)
  let cs = CGColorSpaceCreateDeviceRGB()
  let g = CGGradient(colorsSpace: cs, colors: [INKC.copy(alpha: 0.14)!, INKC.copy(alpha: 0)!] as CFArray, locations: [0, 1])!
  ctx.drawRadialGradient(g, startCenter: CGPoint(x: CX, y: CY), startRadius: 0, endCenter: CGPoint(x: CX, y: CY), endRadius: Hd * 0.34, options: [])
  for ring in 0..<5 {
    let r = Hd * (0.16 + 0.07 * Double(ring))
    let cnt = 36 + ring * 18
    let dir = ring % 2 == 0 ? 1.0 : -1.0
    for k in 0..<cnt {
      let a = TAU * Double(k) / Double(cnt) + dir * p * TAU / Double(3 + ring)
      let x = CX + cos(a) * r, y = CY + sin(a) * r * 0.62
      let bright = (k * 7 + ring * 3) % 23 == 0
      dot(ctx, x, y, (bright ? 5 : 2) * K, bright ? (ring == 2 ? ORANGE : INKC) : INKC.copy(alpha: 0.35)!)
    }
  }
  dot(ctx, CX, CY, 12 * K, INKC)
}

// the faces: the 4×5 grid of portraits the site already uses (assets/img/brand-growth.jpg)
let FACES: CGImage? = {
  let path = ProcessInfo.processInfo.environment["FACES"] ?? "/Users/user/Projects/stagwell-ai/assets/img/brand-growth.jpg"
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return nil }
  return CGImageSourceCreateImageAtIndex(src, 0, nil)
}()
func face(_ ctx: CGContext, _ n: Int, _ x: Double, _ y: Double, _ r: Double) {
  guard let img = FACES else { dot(ctx, x, y, r, CGColor(gray: 0.55, alpha: 1)); return }
  let cw = img.width / 4, ch = img.height / 5, i = ((n % 20) + 20) % 20
  guard let crop = img.cropping(to: CGRect(x: (i % 4) * cw, y: (i / 4) * ch, width: cw, height: ch)) else { return }
  ctx.saveGState()
  ctx.addEllipse(in: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r)); ctx.clip()
  ctx.translateBy(x: x - r, y: y + r); ctx.scaleBy(x: 1, y: -1)
  ctx.draw(crop, in: CGRect(x: 0, y: 0, width: 2 * r, height: 2 * r * Double(ch) / Double(cw)))
  ctx.restoreGState()
}

// 22 · activity: two banks of small squares, cells lighting through the day
func activity(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  let cols = 44, rows = 7, cell = 22 * K, gap = 8 * K
  let bw = Double(cols) * (cell + gap) - gap
  let x0 = (Wd - bw) / 2
  for bank in 0..<2 {
    let y0 = Hd * (bank == 0 ? 0.14 : 0.57)
    let busy = bank == 0 ? 0.62 : 0.3
    for r in 0..<rows { for c in 0..<cols {
      let x = x0 + Double(c) * (cell + gap), y = y0 + Double(r) * (cell + gap)
      let h = hash(c + bank * 100, r)
      let wave = 0.5 + 0.5 * sin(TAU * (p * 2 - Double(c) / 18 + Double(r) / 9 + h))
      let on = h < busy * (0.5 + wave)
      if on {
        let strong = hash(c * 7 + bank, r * 3) > 0.4
        ctx.setFillColor(strong ? CYAN : CGColor(red: 0.467, green: 0.89, blue: 0.965, alpha: 0.55))
        ctx.fill(CGRect(x: x, y: y, width: cell, height: cell))
      } else { dot(ctx, x + cell / 2, y + cell / 2, 1.4 * K, white(0.22)) }
    } }
    // hour ticks under each bank
    for t in 0...8 { let x = x0 + Double(t) * bw / 8; ctx.setFillColor(white(0.25)); ctx.fill(CGRect(x: x - 1, y: y0 + Double(rows) * (cell + gap) + 8 * K, width: 2, height: 10 * K)) }
  }
}

// 23 · workflow: node cards wired left to right, packets riding the wires
func workflow(_ ctx: CGContext, _ p: Double) {
  ground(ctx, GRAPH)
  let CARD = CGColor(red: 0.16, green: 0.18, blue: 0.22, alpha: 1)
  let nodes: [(Double, Double, Double, Double)] = [(0.06, 0.4, 0.15, 0.13), (0.29, 0.22, 0.16, 0.2), (0.29, 0.6, 0.16, 0.16), (0.53, 0.36, 0.17, 0.24), (0.77, 0.24, 0.16, 0.14), (0.77, 0.6, 0.16, 0.18)]
  let wires: [(Int, Int, Int)] = [(0, 1, 0), (0, 2, 1), (1, 3, 0), (2, 3, 1), (3, 4, 0), (3, 5, 1)]
  func port(_ n: Int, _ out: Bool, _ k: Int) -> (Double, Double) { let nd = nodes[n]; return (Wd * (nd.0 + (out ? nd.2 : 0)), Hd * (nd.1 + nd.3 * (0.35 + 0.3 * Double(k)))) }
  for (i, w) in wires.enumerated() {
    let a = port(w.0, true, w.2), b = port(w.1, false, 0)
    let col = i % 3 == 0 ? CYAN : (i % 3 == 1 ? ORANGE : CGColor(red: 0.6, green: 0.62, blue: 0.68, alpha: 1))
    ctx.setStrokeColor(col.copy(alpha: 0.6)!); ctx.setLineWidth(2 * K)
    ctx.move(to: CGPoint(x: a.0, y: a.1))
    ctx.addCurve(to: CGPoint(x: b.0, y: b.1), control1: CGPoint(x: a.0 + (b.0 - a.0) * 0.5, y: a.1), control2: CGPoint(x: a.0 + (b.0 - a.0) * 0.5, y: b.1))
    ctx.strokePath()
    for m in 0..<2 {
      let t = fract(p * 1.5 + Double(m) * 0.5 + Double(i) * 0.13), u = 1 - t
      let c1 = (a.0 + (b.0 - a.0) * 0.5, a.1), c2 = (a.0 + (b.0 - a.0) * 0.5, b.1)
      let x = u*u*u*a.0 + 3*u*u*t*c1.0 + 3*u*t*t*c2.0 + t*t*t*b.0, y = u*u*u*a.1 + 3*u*u*t*c1.1 + 3*u*t*t*c2.1 + t*t*t*b.1
      dot(ctx, x, y, 5 * K, col)
    }
  }
  for (n, nd) in nodes.enumerated() {
    let x = Wd * nd.0, y = Hd * nd.1, w = Wd * nd.2, h = Hd * nd.3
    let path = CGPath(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerWidth: 14 * K, cornerHeight: 14 * K, transform: nil)
    ctx.addPath(path); ctx.setFillColor(CARD); ctx.fillPath()
    ctx.addPath(path); ctx.setStrokeColor(white(0.14)); ctx.setLineWidth(1.2 * K); ctx.strokePath()
    // a title bar and a few rows
    ctx.setFillColor(white(0.8)); ctx.fill(CGRect(x: x + 18 * K, y: y + 18 * K, width: w * 0.5, height: 8 * K))
    let rows = Int(h / (34 * K)) - 1
    for r in 0..<max(1, rows) {
      let ry = y + 44 * K + Double(r) * 30 * K
      ctx.setFillColor(white(0.3)); ctx.fill(CGRect(x: x + 18 * K, y: ry, width: w * (0.3 + 0.3 * hash(n, r)), height: 6 * K))
      if r == 0 { let on = fract(p * 2 + hash(n, 9)) < 0.5
        ctx.setFillColor(on ? CYAN : white(0.2)); let pw = 34 * K, ph = 18 * K
        ctx.addPath(CGPath(roundedRect: CGRect(x: x + w - 18 * K - pw, y: ry - 6 * K, width: pw, height: ph), cornerWidth: ph / 2, cornerHeight: ph / 2, transform: nil)); ctx.fillPath()
        dot(ctx, x + w - 18 * K - pw + (on ? pw - ph / 2 : ph / 2), ry + 3 * K, 6 * K, CGColor(gray: 1, alpha: 1)) }
    }
    for k in 0..<2 { let pi = port(n, false, k), po = port(n, true, k); dot(ctx, pi.0, pi.1, 4 * K, white(0.7)); dot(ctx, po.0, po.1, 4 * K, white(0.7)) }
  }
}

// 24 · world: a dotted world map, places lighting up in orange
let LAND: [[(Double, Double)]] = [
  [(-168,66),(-140,70),(-95,72),(-75,62),(-55,50),(-66,44),(-80,30),(-97,25),(-105,20),(-120,32),(-125,48),(-150,60)],
  [(-80,10),(-60,5),(-50,-2),(-35,-8),(-40,-22),(-52,-33),(-65,-45),(-72,-52),(-75,-30),(-80,-10)],
  [(-10,36),(0,44),(10,54),(25,60),(30,70),(40,68),(45,50),(30,45),(20,38),(5,37)],
  [(-17,15),(-10,32),(10,36),(32,31),(42,12),(50,10),(40,-10),(35,-25),(20,-35),(15,-20),(10,-2),(0,5)],
  [(45,50),(60,70),(100,75),(140,72),(170,66),(160,58),(140,50),(125,38),(110,22),(105,10),(95,15),(80,10),(72,22),(60,25),(48,30),(35,40)],
  [(115,-22),(130,-12),(145,-15),(153,-28),(147,-38),(135,-35),(118,-34)]]
func onLand(_ lon: Double, _ lat: Double) -> Bool {
  for poly in LAND { var inside = false; var j = poly.count - 1
    for i in 0..<poly.count { let a = poly[i], b = poly[j]
      if (a.1 > lat) != (b.1 > lat) && lon < (b.0 - a.0) * (lat - a.1) / (b.1 - a.1) + a.0 { inside.toggle() }
      j = i }
    if inside { return true } }
  return false
}
func world(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.09, green: 0.09, blue: 0.1, alpha: 1))
  let cell = 14 * K, sp = 18 * K
  let mapW = Wd * 0.92, mapH = mapW / 2, mx = (Wd - mapW) / 2, my = (Hd - mapH) / 2 + Hd * 0.04
  var y = my, j = 0
  while y < my + mapH { var x = mx, i = 0
    while x < mx + mapW {
      let lon = (x - mx) / mapW * 360 - 180, lat = 90 - (y - my) / mapH * 180
      if onLand(lon, lat) {
        let h = hash(i, j)
        let cyc = fract(p * 2 + h * 7)
        let lit = h > 0.93 && cyc < 0.5 ? smooth(cyc / 0.08) * smooth((0.5 - cyc) / 0.15) : 0
        ctx.setFillColor(lit > 0 ? tint(ORANGE, 0.35 + 0.65 * lit) : white(0.16))
        ctx.fill(CGRect(x: x, y: y, width: cell, height: cell))
      }
      x += sp; i += 1 }
    y += sp; j += 1 }
}

// 25 · timeline: years as dotted columns, people appearing along them
func timeline(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.957, green: 0.945, blue: 0.925, alpha: 1))
  let INKC = CGColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1)
  let cols = 14, x0 = Wd * 0.06, x1 = Wd * 0.94
  for c in 0..<cols {
    let x = x0 + (x1 - x0) * Double(c) / Double(cols - 1)
    var y = Hd * 0.08; while y < Hd * 0.88 { dot(ctx, x, y, 1.2 * K, INKC.copy(alpha: 0.35)!); y += 10 * K }
    ctx.setFillColor(INKC.copy(alpha: 0.5)!); ctx.fill(CGRect(x: x - 14 * K, y: Hd * 0.9, width: 28 * K, height: 4 * K))
  }
  let cols3: [CGColor] = [ORANGE, CYAN, CGColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1)]
  for k in 0..<34 {
    let c = k % cols, x = x0 + (x1 - x0) * Double(c) / Double(cols - 1)
    let y = Hd * (0.12 + 0.7 * hash(k, 601))
    let born = hash(k, 602), life = 0.55
    let age = fract(p - born)
    if age > life { continue }
    let sc = smooth(age / 0.08) * smooth((life - age) / 0.08)
    let r = (30 + 14 * hash(k, 603)) * K * sc
    if r < 1 { continue }
    face(ctx, k, x, y, r)
    ctx.setStrokeColor(cols3[k % 3]); ctx.setLineWidth(3 * K)
    ctx.addEllipse(in: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r)); ctx.strokePath()
  }
}

// 26 · graph: clusters of dots round numbered-looking hubs, linked, on the light ground
func graph(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.949, green: 0.949, blue: 0.937, alpha: 1))
  let INKC = CGColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1)
  let hubs: [(Double, Double, Int, CGColor)] = [(0.2, 0.32, 26, ORANGE), (0.5, 0.2, 18, INKC), (0.74, 0.34, 22, CYAN), (0.36, 0.7, 14, INKC), (0.68, 0.72, 30, INKC), (0.88, 0.62, 12, ORANGE)]
  let links = [(0, 1), (1, 2), (0, 3), (3, 4), (2, 4), (4, 5), (1, 4)]
  for (i, l) in links.enumerated() {
    let a = hubs[l.0], b = hubs[l.1]
    line(ctx, a.0 * Wd, a.1 * Hd, b.0 * Wd, b.1 * Hd, INKC.copy(alpha: 0.18)!, 1.2 * K)
    let u = fract(p + Double(i) * 0.17)
    dot(ctx, (a.0 + (b.0 - a.0) * u) * Wd, (a.1 + (b.1 - a.1) * u) * Hd, 4 * K, INKC)
  }
  for (h, hub) in hubs.enumerated() {
    let cx = hub.0 * Wd, cy = hub.1 * Hd
    for k in 0..<hub.2 {
      let a = TAU * Double(k) / Double(hub.2) + p * TAU / 6 * (h % 2 == 0 ? 1 : -1), rr = (40 + 22 * hash(h * 40 + k, 611)) * K
      let x = cx + cos(a) * rr, y = cy + sin(a) * rr * 0.9
      line(ctx, cx, cy, x, y, INKC.copy(alpha: 0.12)!, 1 * K)
      dot(ctx, x, y, (3 + 2 * hash(h * 40 + k, 612)) * K, hub.3.copy(alpha: 0.85)!)
    }
    ctx.setStrokeColor(hub.3); ctx.setLineWidth(3 * K)
    ctx.addEllipse(in: CGRect(x: cx - 16 * K, y: cy - 16 * K, width: 32 * K, height: 32 * K)); ctx.strokePath()
    dot(ctx, cx, cy, 5 * K, hub.3)
  }
  for k in 0..<40 { dot(ctx, Wd * hash(k, 621), Hd * hash(k, 622), 2.6 * K, INKC.copy(alpha: 0.3)!) }
}

// 27 · quadtree: squares subdividing where the field is busy, black and white
func quad(_ ctx: CGContext, _ x: Double, _ y: Double, _ s: Double, _ d: Int, _ p: Double) {
  let f = 0.5 + 0.5 * sin(x * 0.004 + p * TAU) * cos(y * 0.005 - p * TAU * 0.7) + 0.3 * sin((x + y) * 0.003 + p * TAU * 1.3)
  if d < 6 && f > 0.55 + Double(d) * 0.05 && s > 20 * K {
    let h = s / 2
    quad(ctx, x, y, h, d + 1, p); quad(ctx, x + h, y, h, d + 1, p); quad(ctx, x, y + h, h, d + 1, p); quad(ctx, x + h, y + h, h, d + 1, p)
  } else {
    ctx.setStrokeColor(white(0.9)); ctx.setLineWidth(1 * K); ctx.stroke(CGRect(x: x, y: y, width: s, height: s))
  }
}
func quadtree(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(gray: 0, alpha: 1))
  let s = Hd / 4
  var y = 0.0; while y < Hd { var x = -s / 2; while x < Wd { quad(ctx, x, y, s, 0, p); x += s }; y += s }
}

// 28 · records: outlined boxes cascading in, like a ledger filling up
func records(_ ctx: CGContext, _ p: Double) {
  ground(ctx, INK)
  let cols = 5, rows = 9
  let bw = Wd * 0.15, bh = Hd * 0.06, gx = Wd * 0.035, gy = Hd * 0.035
  let x0 = (Wd - Double(cols) * bw - Double(cols - 1) * gx) / 2, y0 = (Hd - Double(rows) * bh - Double(rows - 1) * gy) / 2
  for r in 0..<rows { for c in 0..<cols {
    let born = hash(c, r) * 0.6, age = fract(p - born)
    if age > 0.85 { continue }
    let a = smooth(age / 0.06) * smooth((0.85 - age) / 0.1)
    let x = x0 + Double(c) * (bw + gx) + (1 - a) * 30 * K, y = y0 + Double(r) * (bh + gy)
    ctx.setStrokeColor(white(0.85 * a)); ctx.setLineWidth(1.4 * K); ctx.stroke(CGRect(x: x, y: y, width: bw, height: bh))
    let n = 4 + Int(hash(c * 3, r * 5) * 5)
    for k in 0..<n { ctx.setFillColor(k == 0 && (c + r) % 4 == 0 ? tint(ORANGE, a) : white(0.7 * a)); ctx.fill(CGRect(x: x + 12 * K + Double(k) * 14 * K, y: y + bh / 2 - 4 * K, width: 8 * K, height: 8 * K)) }
  } }
}

let SCENES: [String: (CGContext, Double) -> Void] = [
  "streams": streams, "pulses": pulses, "orbits": orbits, "block-rain": blockRain, "plexus": plexus,
  "lanes": lanes, "radar": radar, "circuit": circuit, "terrain": terrain, "mosaic": mosaic,
  "converge": converge, "charts": charts, "clusters": clusters, "globe": globe, "tunnel": tunnel,
  "media-flow": mediaFlow, "id-spine": idSpine, "wave-dots": waveDots, "ripples": ripples, "pathways": pathways, "halo": halo,
  "activity": activity, "workflow": workflow, "world": world, "timeline": timeline, "graph": graph, "quadtree": quadtree, "records": records,
]
guard let scene = SCENES[SCENE] else { print("unknown scene", SCENE); exit(1) }
if SCENE == "circuit" { buildRoutes() }
render(path: OUT, w: W, h: H, fps: FPS, frames: FR, bitrate: 10_000_000) { ctx, f in
  scene(ctx, Double(f) / Double(FR))
}
