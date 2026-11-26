import 'package:flutter/material.dart';
import 'package:ebloods/core/theme/app_colors.dart';

class EcgHeartbeatPainter extends CustomPainter {
  final double animationValue;

  EcgHeartbeatPainter({required this.animationValue});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.primary
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final glowPaint = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.3)
      ..strokeWidth = 5.0
      ..style = PaintingStyle.stroke
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);

    final path = Path();
    final double h = size.height;
    final double w = size.width;
    final double midY = h * 0.5;

    // Standard ECG waveform sequence repeated
    final points = [
      Offset(0, midY),
      Offset(w * 0.1, midY),
      Offset(w * 0.15, midY - 4),
      Offset(w * 0.2, midY + 4),
      Offset(w * 0.25, midY),
      Offset(w * 0.35, midY),
      Offset(w * 0.38, midY - 18), // P wave / QRS spike
      Offset(w * 0.42, midY + 22),
      Offset(w * 0.46, midY - 8),
      Offset(w * 0.5, midY),
      Offset(w * 0.65, midY),
      Offset(w * 0.7, midY - 6),
      Offset(w * 0.75, midY + 6),
      Offset(w * 0.8, midY),
      Offset(w, midY),
    ];

    if (points.isNotEmpty) {
      path.moveTo(points[0].dx, points[0].dy);
      for (int i = 1; i < points.length; i++) {
        path.lineTo(points[i].dx, points[i].dy);
      }
    }

    // Draw glow and main path
    canvas.drawPath(path, glowPaint);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant EcgHeartbeatPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue;
  }
}
