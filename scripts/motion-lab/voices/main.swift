import CoreGraphics
import Foundation

// many small voices: one pops up, then another somewhere else, then another, quickly;
// each speaks in its own way (width, height, envelope, rhythm, pauses, tint)
let W = 1920, H = 1080, FPS = 30, L = 12.0
let FR = Int(L) * FPS
let TAU = Double.pi * 2
var rng = RNG(s: 23)
let TINTS: [(Double, Double, Double)] = [(0, 0.61, 0.74), (0.47, 0.89, 0.96), (1, 0.43, 0.14), (1, 0.72, 0.11)]

struct Voice {
  var cx, cy, tile, gap: Double
  var cols, rows: Int
  var born: Double
  var shape: Int            // 0 bell, 1 two humps, 2 lean left, 3 flat and wide, 4 spiky
  var f1, f2, ph: Double    // rhythm
  var talk, rest: Double    // seconds talking / silent
  var tintBias: UInt64
  var up: [Double], dn: [Double]
}
var voices: [Voice] = []
// a composed field: four bands, big and small voices alternating along each,
// so the frame reads as a pattern before a single one speaks
let bands: [(Double, [Int])] = [
  (215, [1, 0, 0, 1, 0]),
  (430, [0, 1, 0, 0, 1, 0]),
  (650, [1, 0, 1, 0, 0]),
  (865, [0, 0, 1, 0, 1, 0]),
]
var order: [(Int, Int)] = []
for (bi, band) in bands.enumerated() {
  let (y, kinds) = band
  var widths: [Double] = [], specs: [(Double, Double, Int, Int)] = []
  for k in kinds {
    let big = k == 1
    let tile = big ? 6.0 : 4.0, gap = big ? 3.0 : 2.0
    let cols = big ? Int(rng.r(38, 52)) : Int(rng.r(16, 26))
    let rows = big ? Int(rng.r(13, 17)) : Int(rng.r(5, 8))
    specs.append((tile, gap, cols, rows)); widths.append(Double(cols) * (tile + gap))
  }
  let margin = 90.0
  let free = Double(W) - 2 * margin - widths.reduce(0, +)
  let space = free / Double(kinds.count - 1)
  var x = margin
  for (j, sp) in specs.enumerated() {
    let cx = x + widths[j] / 2
    x += widths[j] + space
    voices.append(Voice(cx: cx, cy: y + rng.r(-14, 14), tile: sp.0, gap: sp.1, cols: sp.2, rows: sp.3,
      born: 0, shape: [0, 1, 2, 4, 0, 1][Int(rng.next() * 6)], f1: rng.r(3.5, 9), f2: rng.r(0.8, 2.4), ph: rng.r(0, 6),
      talk: rng.r(1.0, 2.6), rest: rng.r(0.2, 0.7), tintBias: UInt64(rng.next() * 1000),
      up: [Double](repeating: 0, count: sp.2), dn: [Double](repeating: 0, count: sp.2)))
    order.append((bi, j))
  }
}
// they arrive fast, in a shuffled order, ~0.09 s apart: the whole field is up in two seconds
var ids = Array(voices.indices)
for k in stride(from: ids.count - 1, to: 0, by: -1) { let r = Int(rng.next() * Double(k + 1)); ids.swapAt(k, r) }
for (n, i) in ids.enumerated() { voices[i].born = 0.1 + Double(n) * 0.04 }

func envelope(_ v: Voice, _ u: Double) -> Double {
  switch v.shape {
  case 1: return max(0, 0.55 * pow(sin(Double.pi * u), 1.2) + 0.45 * pow(abs(sin(Double.pi * 2 * u)), 1.5))
  case 2: return pow(sin(Double.pi * pow(u, 0.6)), 1.4)
  case 3: return 0.55 + 0.45 * pow(sin(Double.pi * u), 0.5)
  case 4: return pow(sin(Double.pi * u), 2.2) * (0.6 + 0.4 * abs(sin(u * 23)))
  default: return pow(sin(Double.pi * u), 1.6)
  }
}
func hash(_ a: Int, _ b: Int) -> Double {
  var x = UInt64(truncatingIfNeeded: a &* 73856093 ^ b &* 19349663) &+ 0x9E3779B97F4A7C15
  x = (x ^ (x >> 30)) &* 0xBF58476D1CE4E5B9; x = (x ^ (x >> 27)) &* 0x94D049BB133111EB; x ^= x >> 31
  return Double(x % 10000) / 10000
}

render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: FR) { ctx, f in
  let sec = Double(f) / Double(FPS)
  ctx.setFillColor(CGColor(red: 0.043, green: 0.071, blue: 0.125, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  for vi in voices.indices {
    var v = voices[vi]
    let age = sec - v.born
    if age < 0 { continue }
    // arrival: the line draws out from the centre in a quarter second, then the voice starts
    let open = min(1, age / 0.1)
    let cyc = v.talk + v.rest
    let inTalk = ((age + v.ph).truncatingRemainder(dividingBy: cyc)) < v.talk ? 1.0 : 0.12
    let s = age + v.ph
    let amp = (0.3 + 0.7 * abs(sin(s * v.f1) * sin(s * v.f2 + 1.1))) * inTalk * min(1, age / 0.15)
    let k = f / 3
    let step = Double(v.tile + v.gap)
    let x0 = v.cx - Double(v.cols) * step / 2
    let mid = v.cy - v.tile / 2
    for i in 0..<v.cols {
      let u = Double(i) / Double(v.cols - 1)
      if abs(u - 0.5) * 2 > open { continue }
      let e = envelope(v, u)
      if f % 3 == 0 || v.up[i] == 0 {
        let tu = e * amp * (0.35 + hash(vi * 1000 + i, k) * 0.65)
        let td = e * amp * (0.25 + hash(vi * 1000 + i + 500, k) * 0.6)
        v.up[i] += (tu - v.up[i]) * 0.55; v.dn[i] += (td - v.dn[i]) * 0.55
      } else {
        v.up[i] *= 0.98; v.dn[i] *= 0.98
      }
      let nu = Int((v.up[i] * Double(v.rows)).rounded()), nd = Int((v.dn[i] * Double(v.rows)).rounded())
      let x = x0 + Double(i) * step
      for r in -nd...max(-nd, nu) {
        let y = mid - Double(r) * step
        let hh = UInt64(hash(vi * 7919 + i, r + 99) * 10000) &+ v.tintBias
        let far = Double(abs(r)) / Double(v.rows + 1)
        let a = min(1, (r == 0 ? 0.8 : 0.35 + 0.5 * (1 - far)) * (0.6 + Double(hh % 5) * 0.1))
        if hh % 9 == 0 { let tc = TINTS[Int(hh % 4)]; ctx.setFillColor(CGColor(red: tc.0, green: tc.1, blue: tc.2, alpha: a)) }
        else { ctx.setFillColor(CGColor(gray: 1, alpha: a)) }
        ctx.fill(CGRect(x: x, y: y, width: v.tile, height: v.tile))
      }
    }
    voices[vi] = v
  }
}
