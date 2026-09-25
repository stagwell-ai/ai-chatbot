import CoreGraphics
import CoreText
import Foundation

func mono(_ size: Double, bold: Bool = false) -> CTFont {
  CTFontCreateWithName((bold ? "Menlo-Bold" : "Menlo-Regular") as CFString, size, nil)
}
func sans(_ size: Double) -> CTFont { CTFontCreateWithName("HelveticaNeue-Medium" as CFString, size, nil) }
@discardableResult
func text(_ ctx: CGContext, _ s: String, _ x: Double, _ y: Double, _ font: CTFont, _ c: CGColor, tracking: Double = 0) -> Double {
  var attrs: [NSAttributedString.Key: Any] = [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): c]
  if tracking != 0 { attrs[NSAttributedString.Key(kCTKernAttributeName as String)] = tracking }
  let line = CTLineCreateWithAttributedString(NSAttributedString(string: s, attributes: attrs))
  ctx.textMatrix = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: 0)
  ctx.textPosition = CGPoint(x: x, y: y)
  CTLineDraw(line, ctx)
  return Double(CTLineGetTypographicBounds(line, nil, nil, nil))
}
func ease(_ x: Double) -> Double { let c = max(0, min(1, x)); return 1 - pow(1 - c, 3) }
func smooth(_ x: Double) -> Double { let c = max(0, min(1, x)); return c * c * (3 - 2 * c) }
let TAU = Double.pi * 2
let ORANGE = CGColor(red: 1, green: 0.427, blue: 0.141, alpha: 1)
let CYAN = CGColor(red: 0.0, green: 0.612, blue: 0.741, alpha: 1)
let LCYAN = CGColor(red: 0.467, green: 0.89, blue: 0.965, alpha: 1)
let YELLOW = CGColor(red: 1, green: 0.722, blue: 0.11, alpha: 1)
func white(_ a: Double) -> CGColor { CGColor(gray: 1, alpha: max(0, min(1, a))) }
func ground(_ ctx: CGContext, _ W: Int, _ H: Int) {
  ctx.setFillColor(CGColor(red: 0.105, green: 0.105, blue: 0.11, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
}
