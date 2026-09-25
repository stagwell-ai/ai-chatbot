import CoreGraphics
import Foundation
// a faint dot field across the whole frame: texture for the part that sits under the cards
func ambientDots(_ ctx: CGContext, _ W: Int, _ H: Int, _ s: Double, _ fadeIn: Double, seed: Int = 1) {
  let sp = 44.0
  var j = 0
  var y = 22.0
  while y < Double(H) {
    var x = 22.0; var i = 0
    while x < Double(W) {
      var h = UInt64(truncatingIfNeeded: (i * 73856093) ^ (j * 19349663) ^ (seed * 83492791))
      h = (h ^ (h >> 13)) &* 0x9E3779B97F4A7C15
      let ph = Double(h % 1000) / 1000
      let tw = 0.5 + 0.5 * sin((s * 0.6 + ph) * TAU)
      let born = ph * 0.8
      let a = ease((s - born) / 0.3) * fadeIn * (0.07 + 0.08 * tw)
      if a > 0.005 {
        ctx.setFillColor(white(a))
        ctx.fill(CGRect(x: x - 1.2, y: y - 1.2, width: 2.4, height: 2.4))
        if h % 97 == 0 {   // the odd accent that blinks
          let on = pow(max(0, sin((s * 0.9 + ph) * TAU)), 6)
          ctx.setFillColor((h % 2 == 0 ? ORANGE : LCYAN).copy(alpha: on * 0.8 * fadeIn)!)
          ctx.fill(CGRect(x: x - 3, y: y - 3, width: 6, height: 6))
        }
      }
      x += sp; i += 1
    }
    y += sp; j += 1
  }
}
