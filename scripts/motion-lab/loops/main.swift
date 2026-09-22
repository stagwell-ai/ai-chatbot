import CoreGraphics
import CoreText
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

// 14 · globe: a turning sphere of dots with the continents in brighter dots and a faint graticule
func globe(_ ctx: CGContext, _ p: Double) {
  ground(ctx, NAVY)
  let R = min(Wd, Hd) * 0.38
  let rot = p * TAU, tilt = 0.32
  func proj(_ x: Double, _ y: Double, _ z: Double) -> (Double, Double, Double) {
    let x1 = x * cos(rot) + z * sin(rot), z1 = -x * sin(rot) + z * cos(rot)
    let y2 = y * cos(tilt) - z1 * sin(tilt), z2 = y * sin(tilt) + z1 * cos(tilt)
    return (CX + x1 * R, CY - y2 * R, z2)
  }
  // graticule
  ctx.setLineWidth(1 * K)
  for m in 0..<12 { let lon = Double(m) / 12 * TAU; var prev: (Double, Double, Double)? = nil
    for t in 0...60 { let lat = -Double.pi / 2 + Double.pi * Double(t) / 60; let q = proj(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon))
      if let pr = prev, q.2 > 0, pr.2 > 0 { line(ctx, pr.0, pr.1, q.0, q.1, white(0.08), 1 * K) }; prev = q } }
  for t in 1..<6 { let lat = -Double.pi / 2 + Double.pi * Double(t) / 6; var prev: (Double, Double, Double)? = nil
    for m in 0...90 { let lon = Double(m) / 90 * TAU; let q = proj(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon))
      if let pr = prev, q.2 > 0, pr.2 > 0 { line(ctx, pr.0, pr.1, q.0, q.1, white(0.08), 1 * K) }; prev = q } }
  let rings = 44
  for li in 1..<rings {
    let lat = -Double.pi / 2 + Double.pi * Double(li) / Double(rings)
    let cnt = max(6, Int((cos(lat) * 130).rounded()))
    for k in 0..<cnt {
      let th = TAU * Double(k) / Double(cnt)
      let q = proj(cos(lat) * cos(th), sin(lat), cos(lat) * sin(th))
      if q.2 < 0 { continue }
      let front = q.2
      let land = onLand(180 - th / TAU * 360, lat / Double.pi * 180)
      dot(ctx, q.0, q.1, (land ? 2.6 : 1.1) * K * (0.6 + 0.5 * front), white(land ? 0.25 + 0.7 * front : 0.06 + 0.16 * front))
    }
  }
  ctx.setStrokeColor(white(0.14)); ctx.setLineWidth(1 * K)
  ctx.addEllipse(in: CGRect(x: CX - R, y: CY - R, width: 2 * R, height: 2 * R)); ctx.strokePath()
  // one place marked, when it faces us
  let q = proj(cos(0.75) * cos(rot * 0 + 4.4), sin(0.75), cos(0.75) * sin(4.4))
  if q.2 > 0.2 {
    let beat = 0.5 + 0.5 * sin(TAU * p * 3)
    dot(ctx, q.0, q.1, 6 * K, ORANGE); ctx.setStrokeColor(tint(ORANGE, 0.6 * (1 - beat))); ctx.setLineWidth(1.5 * K)
    ctx.addEllipse(in: CGRect(x: q.0 - (10 + 18 * beat) * K, y: q.1 - (10 + 18 * beat) * K, width: (20 + 36 * beat) * K, height: (20 + 36 * beat) * K)); ctx.strokePath()
    ctx.setFillColor(white(0.95)); ctx.fill(CGRect(x: q.0 + 16 * K, y: q.1 - 12 * K, width: 110 * K, height: 24 * K))
    ctx.setFillColor(NAVY); ctx.fill(CGRect(x: q.0 + 26 * K, y: q.1 - 3 * K, width: 70 * K, height: 6 * K))
  }
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
// 17 · identity spine: a dense weave of strands into a column of ticks, four branches out, a cloud of dots
func idSpine(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.05, green: 0.06, blue: 0.08, alpha: 1))
  let bx = Wd * 0.44, top = Hd * 0.2, bot = Hd * 0.8
  let n = 150
  let palette: [CGColor] = [CYAN, LCYANC, CGColor(red: 0.55, green: 0.7, blue: 0.95, alpha: 1), YELLOWC, ORANGE, CGColor(red: 0.6, green: 0.85, blue: 0.7, alpha: 1)]
  for i in 0..<n {
    let y0 = Hd * (0.02 + 0.96 * hash(i, 501)) + 10 * K * sin(TAU * (p + hash(i, 502)))
    let y1 = top + (bot - top) * (Double(i) + 0.5) / Double(n)
    let col = palette[Int(hash(i, 503) * Double(palette.count))]
    ctx.setStrokeColor(col.copy(alpha: 0.22)!); ctx.setLineWidth(1.3 * K)
    ctx.move(to: CGPoint(x: -10, y: y0))
    ctx.addCurve(to: CGPoint(x: bx - 30 * K, y: y1), control1: CGPoint(x: bx * 0.45, y: y0), control2: CGPoint(x: bx * 0.6, y: y1))
    ctx.strokePath()
    ctx.setStrokeColor(col.copy(alpha: 0.9)!); flow(ctx, p, 40 * K, 260 * K, 2 + hash(i, 505))
    ctx.move(to: CGPoint(x: -10, y: y0))
    ctx.addCurve(to: CGPoint(x: bx - 30 * K, y: y1), control1: CGPoint(x: bx * 0.45, y: y0), control2: CGPoint(x: bx * 0.6, y: y1))
    ctx.strokePath(); noFlow(ctx)
    ctx.setFillColor(col); ctx.fill(CGRect(x: bx - 30 * K, y: y1 - 1.5 * K, width: 26 * K, height: 3 * K))
  }
  // the column of ticks
  var ty = top; var ti = 0
  while ty <= bot { ctx.setFillColor(white(0.5 + 0.5 * hash(ti, 504))); ctx.fill(CGRect(x: bx + 4 * K, y: ty, width: 3 * K, height: 3 * K)); ty += 6 * K; ti += 1 }
  // four branches, each into a spray of curved strands ending in dots
  let bcols: [CGColor] = [ORANGE, CYAN, CGColor(red: 0.85, green: 0.3, blue: 0.35, alpha: 1), YELLOWC]
  for g in 0..<4 {
    let gy = top + (bot - top) * (Double(g) + 0.5) / 4
    let x1 = bx + 24 * K, x2 = Wd * 0.64, col = bcols[g]
    ctx.setStrokeColor(col); ctx.setLineWidth(2.2 * K)
    ctx.move(to: CGPoint(x: x1, y: gy)); ctx.addLine(to: CGPoint(x: x2, y: gy)); ctx.strokePath()
    dot(ctx, x1, gy, 6 * K, col)
    for m in 0..<3 { let u = fract(hash(g, 520 + m) + p); dot(ctx, x1 + (x2 - x1) * u, gy, 4 * K, col) }
    for k in 0..<22 {
      let ex = Wd * (0.7 + 0.16 * hash(g * 50 + k, 511)), ey = gy + (hash(g * 50 + k, 512) - 0.5) * Hd * 0.24
      ctx.setStrokeColor(col.copy(alpha: 0.35)!); ctx.setLineWidth(1.1 * K)
      ctx.move(to: CGPoint(x: x2, y: gy))
      ctx.addCurve(to: CGPoint(x: ex, y: ey), control1: CGPoint(x: x2 + (ex - x2) * 0.6, y: gy), control2: CGPoint(x: x2 + (ex - x2) * 0.4, y: ey))
      ctx.strokePath()
      ctx.setStrokeColor(col); flow(ctx, p, 14 * K, 110 * K, 1.5 + hash(k, 514))
      ctx.move(to: CGPoint(x: x2, y: gy))
      ctx.addCurve(to: CGPoint(x: ex, y: ey), control1: CGPoint(x: x2 + (ex - x2) * 0.6, y: gy), control2: CGPoint(x: x2 + (ex - x2) * 0.4, y: ey))
      ctx.strokePath(); noFlow(ctx)
      dot(ctx, ex, ey, (2.5 + 2 * hash(g * 50 + k, 513)) * K, col)
    }
  }
  // the dot cloud, white, orange and blue, breathing
  let cloud: [CGColor] = [CGColor(gray: 0.85, alpha: 1), CGColor(gray: 0.85, alpha: 1), ORANGE, CGColor(red: 0.35, green: 0.6, blue: 0.95, alpha: 1), LCYANC]
  for k in 0..<260 {
    let x = Wd * (0.78 + 0.24 * pow(hash(k, 531), 0.8)), y = Hd * (0.05 + 0.9 * hash(k, 532))
    let beat = 0.5 + 0.5 * sin(TAU * (p + hash(k, 533)))
    let col = cloud[Int(hash(k, 535) * Double(cloud.count))]
    dot(ctx, x, y, (3 + 8 * hash(k, 534)) * K * (0.7 + 0.3 * beat), col.copy(alpha: 0.6 + 0.4 * beat)!)
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


// small monospace labels (years, times, ids: never a figure that means something)
func label(_ ctx: CGContext, _ t: String, _ x: Double, _ y: Double, _ size: Double, _ c: CGColor) {
  let font = CTFontCreateWithName("Menlo-Regular" as CFString, size, nil)
  let attrs: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): font, NSAttributedString.Key(kCTForegroundColorAttributeName as String): c]
  let line = CTLineCreateWithAttributedString(NSAttributedString(string: t, attributes: attrs))
  ctx.saveGState(); ctx.textMatrix = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: 0); ctx.textPosition = CGPoint(x: x, y: y); CTLineDraw(line, ctx); ctx.restoreGState()
}
func roundedPolyline(_ ctx: CGContext, _ pts: [(Double, Double)], _ r: Double) {
  guard pts.count > 1 else { return }
  ctx.move(to: CGPoint(x: pts[0].0, y: pts[0].1))
  for k in 1..<pts.count - 1 {
    let a = pts[k - 1], b = pts[k], c = pts[k + 1]
    let d1 = hypot(b.0 - a.0, b.1 - a.1), d2 = hypot(c.0 - b.0, c.1 - b.1)
    let rr = min(r, d1 / 2, d2 / 2)
    let p1 = (b.0 + (a.0 - b.0) / max(d1, 1) * rr, b.1 + (a.1 - b.1) / max(d1, 1) * rr), p2 = (b.0 + (c.0 - b.0) / max(d2, 1) * rr, b.1 + (c.1 - b.1) / max(d2, 1) * rr)
    ctx.addLine(to: CGPoint(x: p1.0, y: p1.1)); ctx.addQuadCurve(to: CGPoint(x: p2.0, y: p2.1), control: CGPoint(x: b.0, y: b.1))
  }
  ctx.addLine(to: CGPoint(x: pts.last!.0, y: pts.last!.1))
}
func flow(_ ctx: CGContext, _ p: Double, _ on: Double, _ off: Double, _ speed: Double = 1) { ctx.setLineDash(phase: -p * (on + off) * speed * 6, lengths: [on, off]) }
func noFlow(_ ctx: CGContext) { ctx.setLineDash(phase: 0, lengths: []) }
let YELLOWC = CGColor(red: 1, green: 0.722, blue: 0.11, alpha: 1)
let LCYANC = CGColor(red: 0.467, green: 0.89, blue: 0.965, alpha: 1)

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

// 22 · activity: framed banks of cells lighting through the day, time marks under each
func activity(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(gray: 0, alpha: 1))
  let GREEN = CGColor(red: 0.3, green: 0.85, blue: 0.6, alpha: 1)
  let cols = 44, rows = 7, cell = 30 * K, gap = 10 * K
  let bw = Double(cols) * (cell + gap) - gap, x0 = (Wd - bw) / 2
  ctx.setStrokeColor(white(0.35)); ctx.setLineWidth(1.2 * K)
  ctx.stroke(CGRect(x: x0 - 20 * K, y: Hd * 0.04, width: bw * 0.34, height: 64 * K))
  ctx.setFillColor(white(0.85)); ctx.fill(CGRect(x: x0, y: Hd * 0.04 + 27 * K, width: bw * 0.14, height: 10 * K))
  for bank in 0..<2 {
    let y0 = Hd * (bank == 0 ? 0.2 : 0.6), busy = bank == 0 ? 0.62 : 0.3
    ctx.setFillColor(white(0.85)); ctx.fill(CGRect(x: x0, y: y0 - 30 * K, width: bw * 0.06, height: 8 * K))
    ctx.setFillColor(white(0.35)); ctx.fill(CGRect(x: x0 + bw * 0.08, y: y0 - 34 * K, width: 1, height: 16 * K))
    ctx.setFillColor(GREEN); ctx.fill(CGRect(x: x0 + bw * 0.1, y: y0 - 30 * K, width: bw * 0.05, height: 8 * K))
    ctx.setFillColor(white(0.7)); ctx.fill(CGRect(x: x0 + bw * 0.17, y: y0 - 30 * K, width: bw * 0.04, height: 8 * K))
    for r in 0..<rows { for c in 0..<cols {
      let x = x0 + Double(c) * (cell + gap), y = y0 + Double(r) * (cell + gap)
      let h = hash(c + bank * 100, r)
      let wave = 0.5 + 0.5 * sin(TAU * (p * 2 - Double(c) / 18 + Double(r) / 9 + h))
      if h < busy * (0.5 + wave) {
        let strong = hash(c * 7 + bank, r * 3) > 0.45
        ctx.setFillColor(strong ? GREEN : GREEN.copy(alpha: 0.55)!)
        ctx.fill(CGRect(x: x, y: y, width: cell, height: cell))
      } else { dot(ctx, x + cell / 2, y + cell / 2, 1.3 * K, white(0.3)) }
    } }
    let ly = y0 + Double(rows) * (cell + gap) + 12 * K
    for t in 0...7 { label(ctx, String(format: "%02d:00", 9 + t), x0 + Double(t) * bw / 8, ly + 16 * K, 18 * K, white(0.55)) }
  }
}
// 23 · workflow: node cards wired left to right, packets riding the wires
func workflow(_ ctx: CGContext, _ p: Double) {
  ground(ctx, GRAPH)
  ctx.saveGState(); ctx.translateBy(x: CX, y: CY); ctx.rotate(by: -0.09); ctx.scaleBy(x: 1.1, y: 1.04); ctx.translateBy(x: -CX, y: -CY)
  var gy = 20 * K; while gy < Hd { var gx = 20 * K; while gx < Wd { dot(ctx, gx, gy, 1 * K, white(0.07)); gx += 40 * K }; gy += 40 * K }
  let CARD = CGColor(red: 0.16, green: 0.18, blue: 0.22, alpha: 1)
  let nodes: [(Double, Double, Double, Double)] = [(0.04, 0.42, 0.14, 0.14), (0.24, 0.14, 0.15, 0.2), (0.24, 0.46, 0.15, 0.14), (0.24, 0.7, 0.15, 0.16), (0.47, 0.32, 0.17, 0.3), (0.72, 0.16, 0.15, 0.16), (0.72, 0.46, 0.15, 0.2), (0.72, 0.74, 0.15, 0.12)]
  let wires: [(Int, Int, Int)] = [(0, 1, 0), (0, 2, 1), (0, 3, 1), (1, 4, 0), (2, 4, 1), (3, 4, 1), (4, 5, 0), (4, 6, 0), (4, 7, 1)]
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
      dot(ctx, x, y, 6 * K, col)
    }
  }
  for (n, nd) in nodes.enumerated() {
    let x = Wd * nd.0, y = Hd * nd.1, w = Wd * nd.2, h = Hd * nd.3
    let path = CGPath(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerWidth: 14 * K, cornerHeight: 14 * K, transform: nil)
    ctx.addPath(path); ctx.setFillColor(CARD); ctx.fillPath()
    ctx.addPath(path); ctx.setStrokeColor(white(0.14)); ctx.setLineWidth(1.2 * K); ctx.strokePath()
    // a title bar and a few rows
    dot(ctx, x + 22 * K, y + 22 * K, 5 * K, n == 4 ? ORANGE : CYAN)
    let names = ["Brief received", "Audience", "Draft copy", "Assets", "Review", "Publish", "Send to Slack", "Delay 10 s"]
    let rowsT = [["Source  CRM", "Trigger  New brief"], ["Segment  High intent", "Size  Households"], ["Model  Claude", "Tone  Plain"], ["Format  Social", "Sizes  All"], ["Owner  Team lead", "Status  Waiting", "Due  Today"], ["Channel  Meta"], ["Room  #launch"], ["Then  Report"]]
    label(ctx, names[n], x + 34 * K, y + 27 * K, 15 * K, white(0.92))
    for (ri, rt) in rowsT[n].enumerated() { label(ctx, rt, x + 22 * K, y + 56 * K + Double(ri) * 26 * K, 12.5 * K, white(0.55)) }
    let rows = 1
    for r in 0..<rows {
      let ry = y + 27 * K
      if r == 0 { let on = fract(p * 2 + hash(n, 9)) < 0.5
        ctx.setFillColor(on ? CYAN : white(0.2)); let pw = 34 * K, ph = 18 * K
        ctx.addPath(CGPath(roundedRect: CGRect(x: x + w - 18 * K - pw, y: ry - 6 * K, width: pw, height: ph), cornerWidth: ph / 2, cornerHeight: ph / 2, transform: nil)); ctx.fillPath()
        dot(ctx, x + w - 18 * K - pw + (on ? pw - ph / 2 : ph / 2), ry + 3 * K, 6 * K, CGColor(gray: 1, alpha: 1)) }
    }
    for k in 0..<2 { let pi = port(n, false, k), po = port(n, true, k); dot(ctx, pi.0, pi.1, 4 * K, white(0.7)); dot(ctx, po.0, po.1, 4 * K, white(0.7)) }
  }
  ctx.restoreGState()
}

// 24 · world: a dotted world map, places lighting up in orange
let LAND: [[(Double, Double)]] = [
  [(-168,68),(-160,71),(-150,71),(-140,70),(-130,70),(-122,69),(-110,68),(-100,70),(-90,68),(-84,66),(-80,64),(-70,62),(-64,60),(-60,56),(-56,52),(-60,48),(-66,45),(-70,43),(-74,40),(-76,37),(-79,33),(-81,30),(-82,26),(-84,30),(-89,30),(-94,29),(-97,26),(-98,22),(-96,18),(-93,16),(-90,14),(-86,12),(-83,9),(-79,8),(-80,10),(-84,14),(-88,16),(-92,17),(-96,17),(-100,19),(-106,22),(-110,24),(-113,29),(-117,33),(-121,36),(-124,40),(-124,46),(-126,50),(-131,54),(-136,58),(-141,60),(-150,61),(-158,58),(-164,60),(-166,64)],
  [(-52,60),(-44,60),(-40,65),(-32,68),(-22,71),(-20,76),(-30,80),(-45,82),(-60,82),(-68,78),(-72,76),(-62,72),(-56,66),(-52,62)],
  [(-80,9),(-76,11),(-72,12),(-66,10),(-61,8),(-58,6),(-52,4),(-50,0),(-48,-2),(-42,-3),(-38,-5),(-35,-8),(-37,-12),(-39,-17),(-41,-22),(-46,-24),(-48,-28),(-52,-33),(-57,-38),(-62,-40),(-65,-45),(-68,-50),(-70,-54),(-74,-52),(-75,-46),(-73,-40),(-72,-32),(-70,-25),(-70,-18),(-76,-14),(-80,-6),(-81,-2),(-79,2),(-78,6)],
  [(-9,37),(-9,43),(-2,44),(-2,48),(-5,48),(-2,50),(2,51),(5,53),(9,54),(8,57),(11,58),(6,59),(5,62),(12,66),(16,69),(22,71),(29,71),(31,68),(28,64),(24,60),(22,56),(18,55),(14,54),(19,52),(24,54),(28,56),(30,59),(30,62),(40,64),(44,68),(45,60),(48,50),(40,47),(36,45),(30,45),(28,42),(24,40),(22,37),(18,40),(16,42),(13,44),(12,41),(16,38),(15,37),(12,38),(9,40),(4,43),(0,40),(-2,37),(-6,36)],
  [(-10,52),(-6,55),(-4,58),(-2,58),(1,53),(1,51),(-5,50),(-6,52),(-8,54),(-10,53)],
  [(-17,15),(-17,21),(-13,28),(-9,32),(-6,35),(0,36),(10,37),(11,34),(20,32),(25,32),(32,31),(35,28),(37,22),(39,16),(43,12),(48,11),(51,12),(49,7),(46,3),(42,-2),(40,-8),(39,-12),(36,-18),(35,-24),(33,-28),(28,-33),(22,-34),(18,-33),(16,-29),(14,-24),(12,-18),(13,-12),(12,-6),(9,-1),(9,4),(5,5),(0,5),(-4,5),(-8,4),(-13,8),(-16,12)],
  [(44,-13),(49,-13),(50,-16),(49,-21),(46,-25),(44,-24),(43,-19)],
  [(30,42),(36,37),(38,32),(35,28),(38,24),(42,17),(44,12),(52,16),(57,20),(59,25),(56,26),(52,30),(48,30),(50,32),(57,38),(62,36),(66,25),(70,22),(72,20),(74,15),(77,8),(80,10),(80,15),(85,20),(88,22),(92,22),(94,17),(98,10),(101,3),(104,1),(103,10),(106,10),(109,12),(108,18),(112,22),(117,23),(120,28),(122,32),(120,36),(122,40),(127,40),(130,43),(135,44),(140,48),(142,52),(138,54),(140,58),(150,60),(160,60),(163,65),(170,64),(180,66),(180,70),(170,70),(160,70),(150,72),(140,72),(130,72),(120,74),(110,76),(100,76),(90,74),(80,72),(70,72),(66,70),(60,70),(55,68),(50,68),(48,66),(52,62),(46,58),(40,56),(38,52),(32,48)],
  [(130,31),(132,34),(135,34),(137,35),(140,36),(141,40),(142,44),(145,44),(142,40),(140,37),(138,34),(134,33)],
  [(95,5),(100,1),(105,-5),(106,-6),(101,-1),(96,3)],
  [(109,1),(114,5),(119,4),(118,-1),(115,-4),(110,-3)],
  [(105,-6),(114,-7),(114,-8),(106,-7)],
  [(131,-1),(137,-2),(142,-3),(148,-6),(150,-10),(146,-8),(140,-8),(134,-4)],
  [(120,18),(122,18),(124,12),(126,8),(122,8),(120,12)],
  [(114,-22),(114,-27),(116,-33),(120,-34),(125,-33),(130,-32),(134,-33),(138,-36),(141,-38),(146,-39),(150,-37),(153,-32),(153,-26),(151,-22),(146,-18),(145,-14),(142,-11),(140,-17),(136,-12),(132,-11),(128,-15),(124,-16),(120,-19)],
  [(167,-46),(170,-43),(174,-40),(176,-38),(178,-37),(175,-41),(171,-44),(168,-47)]]
func onLand(_ lon: Double, _ lat: Double) -> Bool {
  for poly in LAND { var inside = false; var j = poly.count - 1
    for i in 0..<poly.count { let a = poly[i], b = poly[j]
      if (a.1 > lat) != (b.1 > lat) && lon < (b.0 - a.0) * (lat - a.1) / (b.1 - a.1) + a.0 { inside.toggle() }
      j = i }
    if inside { return true } }
  return false
}
func world(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.11, green: 0.1, blue: 0.1, alpha: 1))
  let cs0 = CGColorSpaceCreateDeviceRGB()
  let gr = CGGradient(colorsSpace: cs0, colors: [CGColor(gray: 0, alpha: 0), CGColor(gray: 0, alpha: 0.6)] as CFArray, locations: [0, 1])!
  ctx.drawLinearGradient(gr, start: CGPoint(x: 0, y: Hd * 0.6), end: CGPoint(x: 0, y: Hd), options: [])
  let cell = 11 * K, sp = 14 * K
  let mapW = Wd * 1.0, mapH = mapW / 2, mx = 0.0, my = (Hd - mapH) / 2 + Hd * 0.06
  var y = my, j = 0
  while y < my + mapH { var x = mx, i = 0
    while x < mx + mapW {
      let lon = (x - mx) / mapW * 360 - 180, lat = 90 - (y - my) / mapH * 180
      if onLand(lon, lat) {
        let h = hash(i, j)
        let cyc = fract(p * 2 + h * 7)
        let lit = h > 0.93 && cyc < 0.5 ? smooth(cyc / 0.08) * smooth((0.5 - cyc) / 0.15) : 0
        ctx.setFillColor(lit > 0 ? tint(ORANGE, 0.35 + 0.65 * lit) : white(0.18))
        ctx.fill(CGRect(x: x, y: y, width: cell, height: cell))
        if lit > 0.6 { ctx.setStrokeColor(tint(ORANGE, (lit - 0.6) * 1.5)); ctx.setLineWidth(1.5 * K); ctx.stroke(CGRect(x: x - 5 * K, y: y - 5 * K, width: cell + 10 * K, height: cell + 10 * K)) }
      }
      x += sp; i += 1 }
    y += sp; j += 1 }
  // a tooltip: an orange block and a white card with a line of type, drifting between places
  let cyc = fract(p), which = Int(p * 3) % 3
  let spots: [(Double, Double)] = [(0.31, 0.44), (0.52, 0.34), (0.74, 0.42)]
  let sp2 = spots[which], fade = smooth((fract(cyc * 3)) / 0.1) * smooth((1 - fract(cyc * 3)) / 0.1)
  let tx = mx + sp2.0 * mapW, tyy = my + sp2.1 * mapH
  let tw = 250 * K, th = 56 * K
  ctx.setFillColor(ORANGE.copy(alpha: fade)!); ctx.fill(CGRect(x: tx, y: tyy, width: th, height: th))
  dot(ctx, tx + th / 2, tyy + th / 2, 8 * K, CGColor(red: 0.45, green: 0.1, blue: 0.1, alpha: fade))
  ctx.setFillColor(white(0.95 * fade)); ctx.fill(CGRect(x: tx + th, y: tyy, width: tw, height: th))
  ctx.setFillColor(CGColor(gray: 0.1, alpha: fade)); ctx.fill(CGRect(x: tx + th + 18 * K, y: tyy + th / 2 - 5 * K, width: tw * 0.7, height: 10 * K))
}

// 25 · timeline: years as dotted columns, people appearing along them
func timeline(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.957, green: 0.945, blue: 0.925, alpha: 1))
  let INKC = CGColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1)
  let cols = 14, x0 = Wd * 0.06, x1 = Wd * 0.94
  for c in 0..<cols {
    let x = x0 + (x1 - x0) * Double(c) / Double(cols - 1)
    var y = Hd * 0.08; while y < Hd * 0.88 { dot(ctx, x, y, 1.2 * K, INKC.copy(alpha: 0.35)!); y += 10 * K }
    label(ctx, String(2010 + c), x - 18 * K, Hd * 0.95, 14 * K, INKC.copy(alpha: 0.55)!)
  }
  for (k, c) in [ORANGE, CYAN, INKC, YELLOWC].enumerated() { dot(ctx, Wd * 0.72 + Double(k) * 60 * K, Hd * 0.06, 5 * K, c); ctx.setFillColor(INKC.copy(alpha: 0.5)!); ctx.fill(CGRect(x: Wd * 0.72 + Double(k) * 60 * K + 12 * K, y: Hd * 0.06 - 3 * K, width: 30 * K, height: 6 * K)) }
  let cols3: [CGColor] = [ORANGE, CYAN, CGColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1), YELLOWC]
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
    ctx.setStrokeColor(cols3[k % 4]); ctx.setLineWidth(3 * K)
    ctx.addEllipse(in: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r)); ctx.strokePath()
  }
}

// 26 · graph: numbered hubs with rings of dots round them, linked across the light ground
func graph(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.93, green: 0.93, blue: 0.92, alpha: 1))
  let INKC = CGColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1)
  let RED = CGColor(red: 0.8, green: 0.2, blue: 0.2, alpha: 1), GREEN = CGColor(red: 0.3, green: 0.65, blue: 0.35, alpha: 1), BLUE = CGColor(red: 0.2, green: 0.45, blue: 0.85, alpha: 1)
  let hubs: [(Double, Double, Int, CGColor, String)] = [(0.14, 0.34, 26, ORANGE, "1"), (0.42, 0.2, 18, BLUE, "3"), (0.66, 0.24, 22, RED, "4"), (0.3, 0.62, 14, INKC, "5"), (0.58, 0.7, 34, INKC, "1"), (0.84, 0.5, 16, GREEN, "2"), (0.86, 0.8, 12, GREEN, "4"), (0.12, 0.76, 10, ORANGE, "2")]
  let links = [(0, 1), (1, 2), (0, 3), (3, 4), (2, 4), (4, 5), (1, 4), (5, 6), (3, 7), (2, 5)]
  for (i, l) in links.enumerated() {
    let a = hubs[l.0], b = hubs[l.1]
    line(ctx, a.0 * Wd, a.1 * Hd, b.0 * Wd, b.1 * Hd, INKC.copy(alpha: 0.2)!, 1 * K)
    let u = fract(p + Double(i) * 0.13)
    dot(ctx, (a.0 + (b.0 - a.0) * u) * Wd, (a.1 + (b.1 - a.1) * u) * Hd, 3.5 * K, INKC)
  }
  for (h, hub) in hubs.enumerated() {
    let cx = hub.0 * Wd, cy = hub.1 * Hd
    for ring in 0..<2 {
      let cnt = ring == 0 ? hub.2 : hub.2 / 2
      for k in 0..<cnt {
        let a = TAU * Double(k) / Double(cnt) + p * TAU / 8 * (ring == 0 ? 1 : -1), rr = (ring == 0 ? 52 : 30) * K + 6 * K * hash(h * 60 + k, 611)
        let x = cx + cos(a) * rr, y = cy + sin(a) * rr
        line(ctx, cx, cy, x, y, INKC.copy(alpha: 0.1)!, 1 * K)
        dot(ctx, x, y, (3.5 + 2 * hash(h * 60 + k, 612)) * K, (hash(h * 60 + k, 613) > 0.8 ? INKC : hub.3).copy(alpha: 0.9)!)
      }
    }
    dot(ctx, cx, cy, 15 * K, CGColor(red: 0.93, green: 0.93, blue: 0.92, alpha: 1))
    ctx.setStrokeColor(hub.3); ctx.setLineWidth(2.4 * K)
    ctx.addEllipse(in: CGRect(x: cx - 15 * K, y: cy - 15 * K, width: 30 * K, height: 30 * K)); ctx.strokePath()
    label(ctx, hub.4, cx - 5 * K, cy + 6 * K, 17 * K, hub.3)
  }
  for k in 0..<90 { let col: CGColor = [INKC, ORANGE, BLUE, GREEN, RED][Int(hash(k, 623) * 5)]; dot(ctx, Wd * hash(k, 621), Hd * hash(k, 622), 3 * K, col.copy(alpha: 0.75)!) }
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

// 28 · records: outlined boxes with ids, stacking in a cascade
func records(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(gray: 0, alpha: 1))
  let bw = 230 * K, bh = 52 * K
  for c in 0..<6 {
    let colx = Wd * (0.04 + 0.16 * Double(c))
    let stack = 22
    for r in 0..<stack {
      let born = (Double(r) / Double(stack)) * 0.6 + hash(c, 801) * 0.3
      let age = fract(p - born)
      if age > 0.92 { continue }
      let a = smooth(age / 0.05) * smooth((0.92 - age) / 0.08)
      let x = colx + Double(r) * 12 * K * hash(c, 802), y = Hd * 0.04 + Double(r) * (bh * 0.82)
      ctx.setFillColor(CGColor(gray: 0, alpha: a)); ctx.fill(CGRect(x: x, y: y, width: bw, height: bh))
      ctx.setStrokeColor(white(0.9 * a)); ctx.setLineWidth(1.2 * K); ctx.stroke(CGRect(x: x, y: y, width: bw, height: bh))
      label(ctx, String(format: "%02d%02d%02d", c + 1, r + 1, 1 + Int(hash(c * 20 + r, 803) * 9)), x + 18 * K, y + bh * 0.66, 24 * K, white(0.9 * a))
    }
  }
}
// 29 · sankey: strands from a column of ticks on the left flow into grouped bands on the right
func sankey(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.949, green: 0.949, blue: 0.937, alpha: 1))
  let INKC = CGColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1)
  let n = 90, groups = 4, x0 = Wd * 0.08, x1 = Wd * 0.92
  let gcols: [CGColor] = [INKC, ORANGE, CYAN, YELLOWC]
  for i in 0..<n {
    let y0 = Hd * (0.06 + 0.88 * (Double(i) + 0.5) / Double(n))
    let g = Int(hash(i, 701) * Double(groups))
    let slot = hash(i, 704)
    let y1 = Hd * (0.1 + 0.8 * (Double(g) + slot) / Double(groups))
    let col = gcols[g]
    ctx.setStrokeColor(col.copy(alpha: 0.18)!); ctx.setLineWidth(2 * K)
    ctx.move(to: CGPoint(x: x0, y: y0)); ctx.addCurve(to: CGPoint(x: x1, y: y1), control1: CGPoint(x: Wd * 0.5, y: y0), control2: CGPoint(x: Wd * 0.5, y: y1)); ctx.strokePath()
    ctx.setStrokeColor(col.copy(alpha: 0.9)!); flow(ctx, p, 60 * K, 420 * K, 1 + hash(i, 705))
    ctx.move(to: CGPoint(x: x0, y: y0)); ctx.addCurve(to: CGPoint(x: x1, y: y1), control1: CGPoint(x: Wd * 0.5, y: y0), control2: CGPoint(x: Wd * 0.5, y: y1)); ctx.strokePath(); noFlow(ctx)
    ctx.setFillColor(INKC.copy(alpha: 0.7)!); ctx.fill(CGRect(x: x0 - 14 * K, y: y0 - 1.5 * K, width: 12 * K, height: 3 * K))
    ctx.setFillColor(col); ctx.fill(CGRect(x: x1 + 2 * K, y: y1 - 1.5 * K, width: 12 * K, height: 3 * K))
  }
  ctx.setFillColor(INKC); ctx.fill(CGRect(x: x0 - 20 * K, y: Hd * 0.05, width: 4 * K, height: Hd * 0.9))
  for g in 0..<groups { ctx.setFillColor(gcols[g]); ctx.fill(CGRect(x: x1 + 16 * K, y: Hd * (0.1 + 0.8 * Double(g) / Double(groups)) + 6 * K, width: 6 * K, height: Hd * 0.8 / Double(groups) - 12 * K)) }
}
// 30 · radial: a ring larger than the frame; strands sweep into a colour band on its left; bars radiate on its right
func radial(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.07, green: 0.07, blue: 0.08, alpha: 1))
  let cx = Wd * 0.56, cy = CY, R = Hd * 0.34
  let bandCols: [CGColor] = [CYAN, LCYANC, YELLOWC, ORANGE, CGColor(red: 0.85, green: 0.3, blue: 0.35, alpha: 1), CGColor(red: 0.6, green: 0.4, blue: 0.85, alpha: 1), CGColor(gray: 0.9, alpha: 1)]
  for i in 0..<140 {
    let a = Double.pi * (0.78 + 0.44 * (Double(i) + 0.5) / 140)
    let ex = cx + cos(a) * R, ey = cy + sin(a) * R
    let y0 = Hd * (-0.1 + 1.2 * hash(i, 711))
    let col = bandCols[Int(hash(i, 712) * Double(bandCols.count))]
    ctx.setStrokeColor(col.copy(alpha: 0.28)!); ctx.setLineWidth(1.2 * K)
    ctx.move(to: CGPoint(x: -10, y: y0)); ctx.addCurve(to: CGPoint(x: ex, y: ey), control1: CGPoint(x: ex * 0.5, y: y0), control2: CGPoint(x: ex * 0.75, y: ey)); ctx.strokePath()
    ctx.setStrokeColor(col); flow(ctx, p, 30 * K, 300 * K, 1.5 + hash(i, 713))
    ctx.move(to: CGPoint(x: -10, y: y0)); ctx.addCurve(to: CGPoint(x: ex, y: ey), control1: CGPoint(x: ex * 0.5, y: y0), control2: CGPoint(x: ex * 0.75, y: ey)); ctx.strokePath(); noFlow(ctx)
    ctx.setFillColor(col); ctx.fill(CGRect(x: ex - 4 * K, y: ey - 3 * K, width: 30 * K, height: 6 * K))
  }
  ctx.setStrokeColor(CGColor(red: 0.16, green: 0.16, blue: 0.18, alpha: 1)); ctx.setLineWidth(56 * K)
  ctx.addEllipse(in: CGRect(x: cx - R - 28 * K, y: cy - R - 28 * K, width: 2 * R + 56 * K, height: 2 * R + 56 * K)); ctx.strokePath()
  for k in 0..<160 {
    let a = -Double.pi * 0.36 + Double.pi * 0.72 * Double(k) / 159
    let base = (40 + 240 * pow(hash(k, 714), 1.3)) * K
    let len = base * (0.8 + 0.2 * sin(TAU * (p * 2 + hash(k, 715))))
    let low = a > Double.pi * 0.16
    let col: CGColor = low ? bandCols[Int(hash(k, 716) * Double(bandCols.count))] : CGColor(gray: 0.92, alpha: 1)
    let r0 = R + 62 * K
    line(ctx, cx + cos(a) * r0, cy + sin(a) * r0, cx + cos(a) * (r0 + len), cy + sin(a) * (r0 + len), col, 5 * K)
  }
}
// 31 · circuit blocks: traces between clusters of small squares
func circuitBlocks(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(gray: 0, alpha: 1))
  let g = 24 * K
  let cols = Int(Wd / g), rows = Int(Hd / g)
  // clusters
  for c in 0..<7 {
    let cx = Int(hash(c, 721) * Double(cols - 10)) + 5, cy = Int(hash(c, 722) * Double(rows - 8)) + 4
    for j in -4...4 { for i in -5...5 {
      let h = hash(cx + i, cy + j)
      if h < 0.55 { continue }
      let x = Double(cx + i) * g, y = Double(cy + j) * g
      let beat = fract(p * 2 + h * 3) < 0.7
      let col: CGColor = h > 0.9 ? ORANGE : (h > 0.8 ? CYAN : (h > 0.72 ? YELLOWC : CGColor(gray: 1, alpha: 1)))
      ctx.setStrokeColor(white(0.7)); ctx.setLineWidth(1 * K); ctx.stroke(CGRect(x: x + 2, y: y + 2, width: g - 4, height: g - 4))
      if beat { ctx.setFillColor(col); ctx.fill(CGRect(x: x + 7 * K, y: y + 7 * K, width: g - 14 * K, height: g - 14 * K)) }
    } }
  }
  // traces with packets
  for t in 0..<16 {
    var x = Double(Int(hash(t, 731) * Double(cols))) * g, y = Double(Int(hash(t, 732) * Double(rows))) * g
    var pts = [(x, y)]
    var dir = Int(hash(t, 733) * 4)
    for k in 0..<6 { let run = Double(3 + Int(hash(t * 10 + k, 734) * 8)) * g
      switch dir { case 0: x += run; case 1: y += run; case 2: x -= run; default: y -= run }
      x = max(0, min(Wd, x)); y = max(0, min(Hd, y)); pts.append((x, y)); dir = (dir + (hash(t * 10 + k, 735) > 0.5 ? 1 : 3)) % 4 }
    let thin = t % 4 == 3
    ctx.setStrokeColor(thin ? CYAN.copy(alpha: 0.8)! : white(0.75)); ctx.setLineWidth((thin ? 1 : 1.6) * K)
    roundedPolyline(ctx, pts, 22 * K); ctx.strokePath()
    for k in 1..<pts.count { let a = pts[k-1], b = pts[k]; let seg = hypot(b.0 - a.0, b.1 - a.1); if seg < 60 * K { continue }; let steps = Int(seg / (70 * K)); for m in 1...max(1, steps) { let u = Double(m) / Double(steps + 1); let x = a.0 + (b.0 - a.0) * u, y = a.1 + (b.1 - a.1) * u; let dx = (b.0 - a.0) / seg, dy = (b.1 - a.1) / seg; ctx.setFillColor(white(0.85)); ctx.move(to: CGPoint(x: x + dx * 5 * K, y: y + dy * 5 * K)); ctx.addLine(to: CGPoint(x: x - dx * 3 * K - dy * 4 * K, y: y - dy * 3 * K + dx * 4 * K)); ctx.addLine(to: CGPoint(x: x - dx * 3 * K + dy * 4 * K, y: y - dy * 3 * K - dx * 4 * K)); ctx.closePath(); ctx.fillPath() } }
    var len = 0.0; for k in 1..<pts.count { len += abs(pts[k].0 - pts[k-1].0) + abs(pts[k].1 - pts[k-1].1) }
    let u = fract(p + hash(t, 736)); var d = u * len
    for k in 1..<pts.count { let a = pts[k-1], b = pts[k]; let seg = abs(b.0 - a.0) + abs(b.1 - a.1)
      if d <= seg { let tt = seg > 0 ? d / seg : 0; sq(ctx, a.0 + (b.0 - a.0) * tt, a.1 + (b.1 - a.1) * tt, 7 * K, t % 4 == 0 ? CYAN : CGColor(gray: 1, alpha: 1)); break }
      d -= seg }
    dot(ctx, pts[0].0, pts[0].1, 4 * K, white(0.8)); ctx.setStrokeColor(white(0.6)); ctx.setLineWidth(1 * K)
    ctx.addEllipse(in: CGRect(x: pts.last!.0 - 8 * K, y: pts.last!.1 - 8 * K, width: 16 * K, height: 16 * K)); ctx.strokePath()
  }
}
// 32 · people map: faces on a dotted world, linked by faint lines
func peopleMap(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(gray: 1, alpha: 1))
  let INKC = CGColor(red: 0.16, green: 0.17, blue: 0.19, alpha: 1)
  let mapW = Wd * 0.96, mapH = mapW / 2, mx = (Wd - mapW) / 2, my = (Hd - mapH) / 2 + Hd * 0.05
  let sp = 12 * K
  var y = my; while y < my + mapH { var x = mx; while x < mx + mapW {
    let lon = (x - mx) / mapW * 360 - 180, lat = 90 - (y - my) / mapH * 180
    if onLand(lon, lat) { dot(ctx, x, y, 1.4 * K, INKC.copy(alpha: 0.18)!) }
    x += sp }; y += sp }
  var spots: [(Double, Double)] = []
  var tries = 0
  while spots.count < 22 && tries < 400 {
    let lon = -170 + 340 * hash(tries, 741), lat = -50 + 120 * hash(tries, 742); tries += 1
    if !onLand(lon, lat) { continue }
    let x = mx + (lon + 180) / 360 * mapW, yy = my + (90 - lat) / 180 * mapH
    if spots.contains(where: { hypot($0.0 - x, $0.1 - yy) < 90 * K }) { continue }
    spots.append((x, yy))
  }
  for (i, a) in spots.enumerated() { for (j, b) in spots.enumerated() where j > i {
    let d = hypot(a.0 - b.0, a.1 - b.1); if d < 420 * K { ctx.setStrokeColor(INKC.copy(alpha: 0.2)!); ctx.setLineWidth(1 * K); ctx.setLineDash(phase: 0, lengths: [3 * K, 5 * K]); line(ctx, a.0, a.1, b.0, b.1, INKC.copy(alpha: 0.25)!, 1 * K); ctx.setLineDash(phase: 0, lengths: []) } } }
  for (i, sp2) in spots.enumerated() {
    let beat = 0.5 + 0.5 * sin(TAU * (p + hash(i, 743)))
    let r = (i == 0 ? 48 : 18 + 16 * hash(i, 744) + 3 * beat) * K
    face(ctx, i, sp2.0, sp2.1, r)
    ctx.setStrokeColor(CGColor(gray: 1, alpha: 1)); ctx.setLineWidth(3 * K)
    ctx.addEllipse(in: CGRect(x: sp2.0 - r, y: sp2.1 - r, width: 2 * r, height: 2 * r)); ctx.strokePath()
  }
}
// 33 · globe, blue: the dot sphere in white on the brand blue
func globeBlue(_ ctx: CGContext, _ p: Double) {
  ground(ctx, CGColor(red: 0.0, green: 0.612, blue: 0.741, alpha: 1))
  let R = min(Wd, Hd) * 0.38
  let rot = p * TAU, tilt = 0.3
  func proj(_ x: Double, _ y: Double, _ z: Double) -> (Double, Double, Double) {
    let x1 = x * cos(rot) + z * sin(rot), z1 = -x * sin(rot) + z * cos(rot)
    let y2 = y * cos(tilt) - z1 * sin(tilt), z2 = y * sin(tilt) + z1 * cos(tilt)
    return (CX + x1 * R, CY - y2 * R, z2)
  }
  let rings = 40
  for li in 1..<rings {
    let lat = -Double.pi / 2 + Double.pi * Double(li) / Double(rings)
    let cnt = max(6, Int((cos(lat) * 120).rounded()))
    for k in 0..<cnt {
      let th = TAU * Double(k) / Double(cnt)
      let q = proj(cos(lat) * cos(th), sin(lat), cos(lat) * sin(th))
      let front = (q.2 + 1) / 2
      if front < 0.5 { continue }
      let lon = fract(th / TAU), latd = lat / Double.pi * 180
      let land = onLand(180 - lon * 360, latd)
      if !land && hash(li, k) > 0.5 { continue }
      let r = (land ? 3.6 : 1.3) * K * (0.6 + 0.6 * front)
      if land { dot(ctx, q.0, q.1, r, white(0.55 + 0.45 * front)) } else { ctx.setStrokeColor(white(0.3)); ctx.setLineWidth(1.2 * K); ctx.addEllipse(in: CGRect(x: q.0 - r, y: q.1 - r, width: 2 * r, height: 2 * r)); ctx.strokePath() }
    }
  }
  let bw = Wd * 0.56, bh = 56 * K, bx0 = CX - bw / 2, by0 = CY - bh / 2
  ctx.addPath(CGPath(roundedRect: CGRect(x: bx0, y: by0, width: bw, height: bh), cornerWidth: bh / 2, cornerHeight: bh / 2, transform: nil)); ctx.setFillColor(CGColor(gray: 1, alpha: 1)); ctx.fillPath()
  dot(ctx, bx0 + bh / 2, CY, 14 * K, CGColor(red: 0.0, green: 0.612, blue: 0.741, alpha: 1))
  ctx.setFillColor(CGColor(gray: 0.55, alpha: 1)); ctx.fill(CGRect(x: bx0 + bw - 130 * K, y: CY - 5 * K, width: 100 * K, height: 10 * K))
}

let SCENES: [String: (CGContext, Double) -> Void] = [
  "streams": streams, "pulses": pulses, "orbits": orbits, "block-rain": blockRain, "plexus": plexus,
  "lanes": lanes, "radar": radar, "circuit": circuit, "terrain": terrain, "mosaic": mosaic,
  "converge": converge, "charts": charts, "clusters": clusters, "globe": globe, "tunnel": tunnel,
  "media-flow": mediaFlow, "id-spine": idSpine, "wave-dots": waveDots, "ripples": ripples, "pathways": pathways, "halo": halo,
  "activity": activity, "workflow": workflow, "world": world, "timeline": timeline, "graph": graph, "quadtree": quadtree, "records": records,
  "sankey": sankey, "radial": radial, "circuit-blocks": circuitBlocks, "people-map": peopleMap, "globe-blue": globeBlue,
]
guard let scene = SCENES[SCENE] else { print("unknown scene", SCENE); exit(1) }
if SCENE == "circuit" { buildRoutes() }
render(path: OUT, w: W, h: H, fps: FPS, frames: FR, bitrate: 10_000_000) { ctx, f in
  scene(ctx, Double(f) / Double(FR))
}
