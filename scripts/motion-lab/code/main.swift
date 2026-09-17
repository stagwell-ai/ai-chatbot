import CoreGraphics
import CoreText
import Foundation

let W = 1920, H = 1080, FPS = 30, L = 12.0
let FR = Int(L) * FPS
let TAU = Double.pi * 2
var rng = RNG(s: 11)

// grain: three speckle layers, cycled so the paper shimmers
func grain(_ seed: UInt64) -> CGImage {
  var g = RNG(s: seed)
  var px = [UInt8](repeating: 0, count: W * H * 4)
  for i in 0..<(W * H) {
    let v = g.next()
    if v < 0.16 { px[i*4] = 255; px[i*4+1] = 255; px[i*4+2] = 255; px[i*4+3] = UInt8(40 + g.next() * 90) }
    else if v < 0.30 { px[i*4] = 10; px[i*4+1] = 90; px[i*4+2] = 200; px[i*4+3] = UInt8(30 + g.next() * 70) }
  }
  let data = CFDataCreate(nil, px, px.count)!
  return CGImage(width: W, height: H, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: W * 4,
    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
    provider: CGDataProvider(data: data)!, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
}
let grains = [grain(1), grain(2), grain(3)]

struct Block { var x, y, size: Double; var snippets: [[String]]; var ph: Double; var alpha: Double }
let blocks: [Block] = [
  Block(x: 74, y: 70, size: 17, snippets: [
    ["def observe(context):", "    state = perceive(context)", "    signals = extract_signals(state)", "    return {", "        \"state\": state,", "        \"signals\": signals", "    }"],
    ["def perceive(context):", "    frames = context.stream()", "    return normalize(frames)"]], ph: 0.10, alpha: 0.62),
  Block(x: 1468, y: 96, size: 17, snippets: [
    ["def verify(output):", "    checks = [", "        check_factual(output),", "        check_safety(output),", "        check_completeness(output)", "    ]", "    return all(checks)"],
    ["def score(output):", "    return weigh(output.signals)"]], ph: 0.55, alpha: 0.62),
  Block(x: 1120, y: 266, size: 18, snippets: [
    ["def reason(state):", "    goals = infer_goals(state)", "    plan = decompose(goals)", "    return plan"],
    ["def reason(state):", "    options = rank(state.goals)", "    return options[0]"]], ph: 0.30, alpha: 0.66),
  Block(x: 1088, y: 440, size: 32, snippets: [
    ["if confidence < threshold:", "   revised_plan = reason(state)", "   result = agent.run(revised_plan, context)", "else:", "   final_answer = synthesize(result)", "   return final_answer"],
    ["while not done:", "   step = planner.next(state)", "   result = agent.run(step, context)", "   state = observe(result)", "done = verify(result)", "return synthesize(result)"]], ph: 0.0, alpha: 0.74),
  Block(x: 80, y: 756, size: 22, snippets: [
    ["def tool_call(action):", "    tool = resolve_tool(action.type)", "    params = action.params", "    return tool.call(**params)"],
    ["def tool_call(action):", "    tool = registry.get(action.type)", "    return tool.call(action.params)"]], ph: 0.72, alpha: 0.66),
  Block(x: 746, y: 774, size: 22, snippets: [
    ["def delegate(task, context):", "    agent = create_agent(task)", "    return agent.run(task, context)"],
    ["def delegate(task, context):", "    team = assemble(task.skills)", "    return team.run(task, context)"]], ph: 0.45, alpha: 0.66),
  Block(x: 1534, y: 756, size: 17, snippets: [
    ["# finalize and return", "final_answer = verify(output)", "return final_answer"],
    ["# log the decision", "memory.store(final_answer)", "return final_answer"]], ph: 0.85, alpha: 0.6),
  Block(x: 1288, y: 892, size: 19, snippets: [
    ["for task in tasks:", "    result = agent.run(task, context)", "    if not verify(result):", "        result = delegate(task, context)", "    memory.store(result)"],
    ["for signal in signals:", "    insight = reason(signal)", "    queue.push(insight)"]], ph: 0.2, alpha: 0.64),
  Block(x: 80, y: 924, size: 16, snippets: [
    ["def store_memory(key, value):", "    memory.store({", "        \"key\": key,", "        \"value\": value", "    })"],
    ["def recall(key):", "    return memory.get(key)"]], ph: 0.62, alpha: 0.58),
]

func smooth(_ x: Double) -> Double { let c = max(0, min(1, x)); return c * c * (3 - 2 * c) }
let INK = CGColor(red: 0.13, green: 0.22, blue: 0.32, alpha: 1)

func drawText(_ ctx: CGContext, _ s: String, _ x: Double, _ y: Double, _ font: CTFont, _ a: Double) {
  let attr = NSAttributedString(string: s, attributes: [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): INK.copy(alpha: a)!])
  let line = CTLineCreateWithAttributedString(attr)
  ctx.textMatrix = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: 0)
  ctx.textPosition = CGPoint(x: x, y: y)
  CTLineDraw(line, ctx)
}

render(path: CommandLine.arguments[1], w: W, h: H, fps: FPS, frames: FR) { ctx, f in
  let t = Double(f) / Double(FR)
  let cs = CGColorSpaceCreateDeviceRGB()
  // paper: pale sky
  ctx.setFillColor(CGColor(red: 0.80, green: 0.92, blue: 0.98, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  // deep-blue weather, drifting on small circles so the loop closes
  let blobs: [(Double, Double, Double, Double)] = [(0, 540, 820, 0), (700, 330, 380, 0.3), (1920, 0, 620, 0.6), (1920, 1080, 560, 0.15), (0, 1080, 460, 0.8), (1000, 1080, 300, 0.45)]
  for (bx, by, br, bp) in blobs {
    let cx = bx + sin((t + bp) * TAU) * 40, cy = by + cos((t + bp) * TAU) * 30
    let g = CGGradient(colorsSpace: cs, colors: [CGColor(red: 0.10, green: 0.52, blue: 0.89, alpha: 0.95), CGColor(red: 0.10, green: 0.52, blue: 0.89, alpha: 0)] as CFArray, locations: [0, 1])!
    ctx.drawRadialGradient(g, startCenter: CGPoint(x: cx, y: cy), startRadius: 0, endCenter: CGPoint(x: cx, y: cy), endRadius: br, options: [])
  }
  // rings, moving outward one spacing per loop
  let sp = 22.0, ox = -120.0, oy = 540.0
  let off = t * sp * 3
  ctx.setLineWidth(5)
  var r = 30.0 + off.truncatingRemainder(dividingBy: sp)
  while r < 1500 {
    let band = smooth((r - 120) / 260) * (1 - smooth((r - 900) / 500))
    if band > 0.02 {
      ctx.setStrokeColor(CGColor(gray: 1, alpha: 0.55 * band))
      ctx.strokeEllipse(in: CGRect(x: ox - r, y: oy - r, width: r * 2, height: r * 2))
    }
    r += sp
  }
  ctx.draw(grains[f % 3], in: CGRect(x: 0, y: 0, width: W, height: H))

  // code: each block types a snippet, holds, erases, types the next
  for b in blocks {
    let font = CTFontCreateWithName("Menlo" as CFString, b.size, nil)
    let lh = b.size * 1.42
    let n = b.snippets.count
    let q = (t * 2 + b.ph).truncatingRemainder(dividingBy: 1)   // two snippet cycles per loop
    let idx = Int(floor((t * 2 + b.ph))) % n
    let lines = b.snippets[idx]
    let total = lines.reduce(0) { $0 + $1.count }
    var shown: Int
    if q < 0.42 { shown = Int(Double(total) * smooth(q / 0.42) + 0.5) }
    else if q < 0.82 { shown = total }
    else { shown = Int(Double(total) * (1 - (q - 0.82) / 0.14)); shown = max(0, shown) }
    var left = shown, cx = b.x, cy = b.y
    for (li, s) in lines.enumerated() {
      if left <= 0 { break }
      let part = String(s.prefix(left))
      left -= s.count
      cy = b.y + Double(li) * lh + b.size
      drawText(ctx, part, b.x, cy, font, b.alpha)
      cx = b.x + Double(part.count) * b.size * 0.602
    }
    // caret
    let blink = (q > 0.42 && q < 0.82) ? (sin(t * TAU * 18) > 0 ? 1.0 : 0.0) : 1.0
    if q < 0.97 {
      ctx.setFillColor(INK.copy(alpha: b.alpha * blink)!)
      ctx.fill(CGRect(x: cx + 2, y: cy - b.size * 0.8, width: b.size * 0.55, height: b.size * 0.95))
    }
  }
}
