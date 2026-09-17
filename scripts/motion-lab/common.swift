import AVFoundation
import CoreGraphics
import AppKit

struct RNG { var s: UInt64
  mutating func next() -> Double { s = s &* 6364136223846793005 &+ 1442695040888963407; return Double((s >> 11) & ((1<<53)-1)) / Double(1<<53) }
  mutating func r(_ a: Double, _ b: Double) -> Double { a + (b - a) * next() } }

func render(path: String, w: Int, h: Int, fps: Int, frames: Int, bitrate: Int = 24_000_000, draw: (CGContext, Int) -> Void) {
  let url = URL(fileURLWithPath: path)
  try? FileManager.default.removeItem(at: url)
  let wr = try! AVAssetWriter(outputURL: url, fileType: .mp4)
  wr.shouldOptimizeForNetworkUse = true
  let settings: [String: Any] = [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: bitrate, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel, AVVideoMaxKeyFrameIntervalKey: fps * 2]]
  let inp = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
  inp.expectsMediaDataInRealTime = false
  let ad = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: inp, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h])
  wr.add(inp); wr.startWriting(); wr.startSession(atSourceTime: .zero)
  let cs = CGColorSpaceCreateDeviceRGB()
  for f in 0..<frames {
    while !inp.isReadyForMoreMediaData { usleep(2000) }
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, ad.pixelBufferPool!, &pb)
    let buf = pb!
    CVPixelBufferLockBaseAddress(buf, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: w, height: h, bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
    ctx.translateBy(x: 0, y: CGFloat(h)); ctx.scaleBy(x: 1, y: -1)   // top-left origin
    ctx.setShouldAntialias(true)
    draw(ctx, f)
    if f == 0 || f == frames / 2 { if let img = ctx.makeImage() {
      let rep = NSBitmapImageRep(cgImage: img)
      try? rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85])!.write(to: URL(fileURLWithPath: path + ".f\(f).jpg")) } }
    CVPixelBufferUnlockBaseAddress(buf, [])
    ad.append(buf, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: CMTimeScale(fps)))
  }
  inp.markAsFinished()
  let sem = DispatchSemaphore(value: 0)
  wr.finishWriting { sem.signal() }
  sem.wait()
  print("done", path, wr.status.rawValue, wr.error as Any)
}
