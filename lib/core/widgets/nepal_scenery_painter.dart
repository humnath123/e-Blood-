import 'package:flutter/material.dart';

class NepalSceneryPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paintMountain = Paint()
      ..color = const Color(0xFFE88D99).withValues(alpha: 0.35)
      ..style = PaintingStyle.fill;

    final paintPagoda = Paint()
      ..color = const Color(0xFFD66070).withValues(alpha: 0.45)
      ..style = PaintingStyle.fill;

    // Draw Himalayan mountain range silhouettes
    final mountainPath = Path();
    mountainPath.moveTo(0, size.height * 0.7);
    mountainPath.lineTo(size.width * 0.15, size.height * 0.4);
    mountainPath.lineTo(size.width * 0.3, size.height * 0.55);
    mountainPath.lineTo(size.width * 0.5, size.height * 0.25);
    mountainPath.lineTo(size.width * 0.7, size.height * 0.5);
    mountainPath.lineTo(size.width * 0.85, size.height * 0.35);
    mountainPath.lineTo(size.width, size.height * 0.6);
    mountainPath.lineTo(size.width, size.height);
    mountainPath.lineTo(0, size.height);
    mountainPath.close();

    canvas.drawPath(mountainPath, paintMountain);

    // Draw Nepalese Pagoda / Temple silhouettes on the right/center
    final pagodaPath = Path();
    final double px = size.width * 0.75;
    final double py = size.height * 0.65;

    // Base tier
    pagodaPath.moveTo(px - 40, py);
    pagodaPath.lineTo(px + 40, py);
    pagodaPath.lineTo(px + 30, py - 20);
    pagodaPath.lineTo(px - 30, py - 20);
    pagodaPath.close();

    // Second tier
    pagodaPath.moveTo(px - 30, py - 25);
    pagodaPath.lineTo(px + 30, py - 25);
    pagodaPath.lineTo(px + 22, py - 45);
    pagodaPath.lineTo(px - 22, py - 45);
    pagodaPath.close();

    // Top tier & spire
    pagodaPath.moveTo(px - 20, py - 50);
    pagodaPath.lineTo(px + 20, py - 50);
    pagodaPath.lineTo(px + 12, py - 70);
    pagodaPath.lineTo(px - 12, py - 70);
    pagodaPath.close();

    canvas.drawPath(pagodaPath, paintPagoda);

    // Spire
    final spirePaint = Paint()
      ..color = const Color(0xFFC8102E).withValues(alpha: 0.5)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(px, py - 70), Offset(px, py - 90), spirePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
