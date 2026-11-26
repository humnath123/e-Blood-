import 'package:flutter/material.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';
import 'package:ebloods/core/widgets/ecg_heartbeat_painter.dart';

class FooterBanner extends StatefulWidget {
  const FooterBanner({super.key});

  @override
  State<FooterBanner> createState() => _FooterBannerState();
}

class _FooterBannerState extends State<FooterBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Together we can save lives banner with ECG line
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.banner,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.favorite_rounded,
                color: AppColors.primary,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Together, we can save lives.',
                  style: AppTextStyles.bodySmall.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              SizedBox(
                width: 90,
                height: 30,
                child: AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) {
                    return CustomPaint(
                      painter: EcgHeartbeatPainter(animationValue: _controller.value),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        // Footer Links
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 12,
          runSpacing: 6,
          children: [
            _buildLink('Privacy Policy'),
            const Text('|', style: TextStyle(color: AppColors.textFooter, fontSize: 12)),
            _buildLink('Terms & Conditions'),
            const Text('|', style: TextStyle(color: AppColors.textFooter, fontSize: 12)),
            _buildLink('Help & Support'),
          ],
        ),
      ],
    );
  }

  Widget _buildLink(String text) {
    return InkWell(
      onTap: () {},
      child: Text(
        text,
        style: AppTextStyles.footerLink,
      ),
    );
  }
}
