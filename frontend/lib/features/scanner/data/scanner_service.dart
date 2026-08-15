import 'dart:math';
import 'dart:typed_data';
import 'package:image/image.dart' as img;

class ScannerService {
  // 1. Shadow and Glare Removal Algorithm
  // Implements Local Adaptive Thresholding & Shadow subtraction
  static Uint8List removeShadowsAndGlare(Uint8List rawBytes) {
    img.Image? image = img.decodeImage(rawBytes);
    if (image == null) return rawBytes;

    // Convert to grayscale first for shadow estimation
    img.Image grayscale = img.copyRotate(image, angle: 0); // copy
    for (int y = 0; y < grayscale.height; y++) {
      for (int x = 0; x < grayscale.width; x++) {
        final pixel = grayscale.getPixel(x, y);
        final r = pixel.r;
        final g = pixel.g;
        final b = pixel.b;
        final gray = (0.299 * r + 0.587 * g + 0.114 * b).round();
        grayscale.setPixelRgb(x, y, gray, gray, gray);
      }
    }

    // Apply adaptive division: Divide original image by local blurred background to neutralize shadow gradients
    // This is a standard document image processing technique
    img.Image blurred = img.gaussianBlur(grayscale, radius: 25);

    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final origPixel = image.getPixel(x, y);
        final bgPixel = blurred.getPixel(x, y);

        // Normalize color channels based on background intensity
        int newR = _divideChannel(origPixel.r.toInt(), bgPixel.r.toInt());
        int newG = _divideChannel(origPixel.g.toInt(), bgPixel.g.toInt());
        int newB = _divideChannel(origPixel.b.toInt(), bgPixel.b.toInt());

        image.setPixelRgb(x, y, newR, newG, newB);
      }
    }

    return Uint8List.fromList(img.encodePng(image));
  }

  static int _divideChannel(int orig, int bg) {
    if (bg == 0) return 0;
    int result = ((orig / bg) * 255).round();
    return result.clamp(0, 255);
  }

  // 2. Enhance contrast and sharpen handwriting
  static Uint8List sharpenHandwriting(Uint8List rawBytes, {bool isBlackboard = false}) {
    img.Image? image = img.decodeImage(rawBytes);
    if (image == null) return rawBytes;

    // Enhance contrast
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final pixel = image.getPixel(x, y);
        
        int r = _stretchContrast(pixel.r.toInt());
        int g = _stretchContrast(pixel.g.toInt());
        int b = _stretchContrast(pixel.b.toInt());

        image.setPixelRgb(x, y, r, g, b);
      }
    }

    return Uint8List.fromList(img.encodePng(image));
  }

  static int _stretchContrast(int value) {
    // Contrast stretching: clip values below 50 (darker) and above 200 (brighter)
    if (value < 55) return 0;
    if (value > 200) return 255;
    return (((value - 55) / 145) * 255).round();
  }

  // 3. Perspective Warp / Projection Math
  // Corrects whiteboard captured at angle
  static Uint8List warpPerspective(Uint8List rawBytes, List<Point<double>> corners) {
    img.Image? src = img.decodeImage(rawBytes);
    if (src == null || corners.length < 4) return rawBytes;

    // Sort corners: Top-Left, Top-Right, Bottom-Right, Bottom-Left
    final tl = corners[0];
    final tr = corners[1];
    final br = corners[2];
    final bl = corners[3];

    // Calculate dimensions of destination image
    double widthA = sqrt(pow(br.x - bl.x, 2) + pow(br.y - bl.y, 2));
    double widthB = sqrt(pow(tr.x - tl.x, 2) + pow(tr.y - tl.y, 2));
    int destWidth = max(widthA.round(), widthB.round());

    double heightA = sqrt(pow(tr.y - br.y, 2) + pow(tr.x - br.x, 2));
    double heightB = sqrt(pow(tl.y - bl.y, 2) + pow(tl.x - bl.x, 2));
    int destHeight = max(heightA.round(), heightB.round());

    img.Image dest = img.Image(width: destWidth, height: destHeight);

    // Apply bilinear interpolation to project source pixels onto target coordinates
    for (int y = 0; y < destHeight; y++) {
      double v = y / destHeight;
      for (int x = 0; x < destWidth; x++) {
        double u = x / destWidth;

        // Bilinear mapping formula
        double srcX = (1 - u) * (1 - v) * tl.x +
                      u * (1 - v) * tr.x +
                      u * v * br.x +
                      (1 - u) * v * bl.x;
                      
        double srcY = (1 - u) * (1 - v) * tl.y +
                      u * (1 - v) * tr.y +
                      u * v * br.y +
                      (1 - u) * v * bl.y;

        if (srcX >= 0 && srcX < src.width && srcY >= 0 && srcY < src.height) {
          final color = src.getPixel(srcX.round(), srcY.round());
          dest.setPixel(x, y, color);
        }
      }
    }

    return Uint8List.fromList(img.encodePng(dest));
  }
}
