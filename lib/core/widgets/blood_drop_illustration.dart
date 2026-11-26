import 'dart:math';
import 'package:flutter/material.dart';
import 'package:ebloods/core/theme/app_colors.dart';

class BloodDropIllustration extends StatefulWidget {
  const BloodDropIllustration({super.key});

  @override
  State<BloodDropIllustration> createState() => _BloodDropIllustrationState();
}

class _BloodDropIllustrationState extends State<BloodDropIllustration>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final double floatOffset = sin(_controller.value * 2 * pi) * 8;
        return SizedBox(
          height: 140,
          width: 140,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Positioned(
                right: 4,
                top: 10,
                child: Transform.scale(
                  scale: 1.0 + (_controller.value * 0.05),
                  child: Icon(
                    Icons.favorite_rounded,
                    color: AppColors.primary.withValues(alpha: 0.15),
                    size: 64,
                  ),
                ),
              ),
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.3),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
              Transform.translate(
                offset: Offset(0, floatOffset),
                child: CustomPaint(
                  size: const Size(60, 80),
                  painter: GlossyBloodDropPainter(),
                ),
              ),
              Positioned(
                bottom: 10 + (20 * _controller.value),
                child: Container(
                  width: 8,
                  height: 12,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 1.0 - _controller.value),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class GlossyBloodDropPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final Paint dropPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFFFF334B), Color(0xFFC8102E), Color(0xFF8B0015)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height))
      ..style = PaintingStyle.fill;

    final Path path = Path();
    final double w = size.width;
    final double h = size.height;

    path.moveTo(w * 0.5, 0);
    path.cubicTo(w * 0.9, h * 0.4, w, h * 0.7, w * 0.5, h);
    path.cubicTo(0, h * 0.7, w * 0.1, h * 0.4, w * 0.5, 0);
    path.close();

    canvas.drawShadow(path, AppColors.primary, 8, true);
    canvas.drawPath(path, dropPaint);

    final Paint highlightPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.6)
      ..style = PaintingStyle.fill;

    final Path highlightPath = Path();
    highlightPath.addOval(Rect.fromLTWH(w * 0.25, h * 0.2, w * 0.25, h * 0.35));
    canvas.save();
    canvas.rotate(-0.3);
    canvas.drawPath(highlightPath, highlightPaint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
