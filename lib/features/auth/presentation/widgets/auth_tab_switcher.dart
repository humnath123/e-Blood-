import 'package:flutter/material.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';

class AuthTabSwitcher extends StatelessWidget {
  final bool isRegister;
  final ValueChanged<bool> onTabChanged;

  const AuthTabSwitcher({
    super.key,
    required this.isRegister,
    required this.onTabChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.tabTrack,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(
          color: AppColors.tabTrackBorder,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          _buildTab(
            label: 'Login',
            isActive: !isRegister,
            onTabTap: () => onTabChanged(false),
          ),
          _buildTab(
            label: 'Register',
            isActive: isRegister,
            onTabTap: () => onTabChanged(true),
          ),
        ],
      ),
    );
  }

  Widget _buildTab({
    required String label,
    required bool isActive,
    required VoidCallback onTabTap,
  }) {
    return Expanded(
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: onTabTap,
          behavior: HitTestBehavior.opaque,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: isActive ? AppColors.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: AppTextStyles.tabLabel.copyWith(
                color: isActive ? Colors.white : AppColors.textMuted,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
