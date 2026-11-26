import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';
import 'package:ebloods/core/utils/responsive_wrapper.dart';
import 'package:ebloods/core/widgets/empty_state.dart';
import 'package:ebloods/core/widgets/gradient_button.dart';
import 'package:ebloods/core/widgets/loading_indicator.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_provider.dart';
import 'package:ebloods/features/profile/presentation/providers/profile_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final profileAsync = ref.watch(profileProvider);
    final user = authState.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        centerTitle: true,
      ),
      body: ResponsiveWrapper(
        child: SafeArea(
          child: profileAsync.when(
            loading: () => const LoadingIndicator(message: 'Loading profile...'),
            error: (err, _) => SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  _buildUserInfoHeader(user?.firstName, user?.lastName, user?.email, user?.role),
                  const SizedBox(height: 24),
                  EmptyState(
                    icon: Icons.person_off_outlined,
                    title: 'Profile sync issue',
                    message: err.toString(),
                    buttonText: 'Retry',
                    onRetry: () {
                      ref.read(profileProvider.notifier).refresh();
                    },
                  ),
                  const SizedBox(height: 24),
                  GradientButton(
                    text: 'LOGOUT',
                    onPressed: () {
                      ref.read(authProvider.notifier).logout();
                    },
                  ),
                ],
              ),
            ),
            data: (profile) {
              final firstName = profile?.firstName ?? user?.firstName ?? 'User';
              final lastName = profile?.lastName ?? user?.lastName ?? '';
              final email = profile?.email ?? user?.email ?? '';
              final bloodGroup = profile?.bloodGroup ?? 'Not set';
              final phone = profile?.phone ?? user?.phone ?? 'Not set';
              final totalDonations = profile?.totalDonations ?? 0;

              return SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  children: [
                    _buildUserInfoHeader(firstName, lastName, email, user?.role),
                    const SizedBox(height: 24),
                    Card(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: const BorderSide(color: AppColors.inputBorder),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          children: [
                            _buildProfileTile(Icons.water_drop, 'Blood Group', bloodGroup),
                            const Divider(color: AppColors.divider),
                            _buildProfileTile(Icons.phone, 'Phone Number', phone),
                            const Divider(color: AppColors.divider),
                            _buildProfileTile(
                              Icons.favorite,
                              'Total Donations',
                              '$totalDonations Times',
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    GradientButton(
                      text: 'LOGOUT',
                      onPressed: () {
                        ref.read(authProvider.notifier).logout();
                      },
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildUserInfoHeader(String? first, String? last, String? email, String? role) {
    final initials = '${(first ?? 'U').isNotEmpty ? (first ?? 'U')[0] : ''}${(last ?? '').isNotEmpty ? (last ?? '')[0] : ''}'.toUpperCase();

    return Column(
      children: [
        CircleAvatar(
          radius: 44,
          backgroundColor: AppColors.primary,
          child: Text(
            initials.isEmpty ? 'U' : initials,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          '$first $last'.trim(),
          style: AppTextStyles.welcomeTitle.copyWith(fontSize: 20),
        ),
        const SizedBox(height: 4),
        Text(
          email ?? '',
          style: AppTextStyles.bodySmall.copyWith(color: AppColors.textMuted),
        ),
        if (role != null) ...[
          const SizedBox(height: 6),
          Chip(
            label: Text(
              role.toUpperCase(),
              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
            ),
            backgroundColor: AppColors.primaryDark,
          ),
        ],
      ],
    );
  }

  Widget _buildProfileTile(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              style: AppTextStyles.bodySmall.copyWith(fontWeight: FontWeight.w500),
            ),
          ),
          Text(
            value,
            style: AppTextStyles.bodySmall.copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.textDark,
            ),
          ),
        ],
      ),
    );
  }
}
