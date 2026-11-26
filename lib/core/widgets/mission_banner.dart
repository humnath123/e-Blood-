import 'package:flutter/material.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';

class MissionBanner extends StatelessWidget {
  const MissionBanner({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.banner,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'One Drop.',
            style: AppTextStyles.bannerText,
          ),
          const SizedBox(height: 4),
          Text(
            'One Hope.',
            style: AppTextStyles.bannerText,
          ),
          const SizedBox(height: 4),
          Text(
            'One Life.',
            style: AppTextStyles.bannerText,
          ),
        ],
      ),
    );
  }
}
