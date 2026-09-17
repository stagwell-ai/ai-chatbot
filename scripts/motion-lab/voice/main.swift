import CoreGraphics
import Foundation

let W = 1920, H = 1080, FPS = 30, L = 12.0
let FR = Int(L) * FPS
let TAU = Double.pi * 2
let T = 9.0, G = 4.0
let n = Int((Double(W) * 0.78) / (T + G))
let rows = Int((Double(H) * 0.36) / (T + G))
struct Col { var env: Double; var up = 0.0, dn = 0.0, tu = 0.0, td = 0.0; var seed: UInt64 }
var cols: [Col] = (0..<n).map { i in
  let u = Double(i) / Double(n - 1)
  return Col(env: pow(sin(Double.pi * u), 1.6) * (0.75 + 0.25 * sin(u * 17)), seed: UInt64(i) &* 2654435761)
}
let TINTS: [(Double, Double, Double)] = [(0, 0.61, 0.74), (0.47, 0.89, 0.96), (1, 0.43, 0.14), (1, 0.72, 0.11)]
let STEP = 3   // new loudness every 3 frames (100ms)
func noise(_ a: Int, _ b: Int) -> Double {
  var x = UInt64(truncatingIfNeeded: a &* 73856093 ^ b &* 19349663) &+ 0x9E3779B97F4A7C15
  x = (x ^ (x >> 30)) &* 0xBF58476D1CE4E5B9; x = (x ^ (x >> 27)) &* 0x94D049BB133111EB; x ^= x >> 31
  return Double(x % 10000) / 10000
}
func pick(_ f: Int) {
  let k = (f / STEP) % (FR / STEP)          // wraps with the loop
  let s = Double(k * STEP) / Double(FR) * L
  let amp = 0.25 + 0.75 * abs(sin(s * TAU / L * 32) * sin(s * TAU / L * 10 + 1.1))
  for i in 0..<cols.count {
    cols[i].tu = cols[i].env * amp * (0.35 + noise(i, k) * 0.65)
    cols[i].td = cols[i].env * amp * (0.25 + noise(i + 5000, k) * 0.6)
  }
}
func step(_ f: Int) {
  if f % STEP == 0 { pick(f) }
  for i in 0..<cols.count { cols[i].up += (cols[i].tu - cols[i].up) * 0.28; cols[i].dn += (cols[i].td - cols[i].dn) * 0.28 }
}
for f in 0..<FR { step(f) }   // warm-up loop so frame 0 matches the end

render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: FR) { ctx, f in
  step(f)
  ctx.setFillColor(CGColor(red: 0.043, green: 0.071, blue: 0.125, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  let mid = Double(H) / 2 - T / 2
  let x0 = (Double(W) - Double(n) * (T + G)) / 2
  for (i, c) in cols.enumerated() {
    let x = x0 + Double(i) * (T + G)
    let nu = Int((c.up * Double(rows)).rounded()), nd = Int((c.dn * Double(rows)).rounded())
    if nd < -nu { continue }
    for k in -nd...nu {
      let y = mid - Double(k) * (T + G)
      let h = UInt64(truncatingIfNeeded: Int64(bitPattern: c.seed) ^ Int64(k * 40503))
      let far = Double(abs(k)) / Double(rows + 1)
      var a = (k == 0 ? 0.75 : 0.35 + 0.5 * (1 - far)) * (0.6 + Double(h % 5) * 0.1)
      a = min(1, a)
      if h % 9 == 0 { let tc = TINTS[Int(h % 4)]; ctx.setFillColor(CGColor(red: tc.0, green: tc.1, blue: tc.2, alpha: a)) }
      else { ctx.setFillColor(CGColor(gray: 1, alpha: a)) }
      ctx.fill(CGRect(x: x, y: y, width: T, height: T))
    }
  }
}
