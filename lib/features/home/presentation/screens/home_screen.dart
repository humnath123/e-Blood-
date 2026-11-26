import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';
import 'package:ebloods/core/utils/responsive_wrapper.dart';
import 'package:ebloods/core/widgets/empty_state.dart';
import 'package:ebloods/core/widgets/loading_indicator.dart';
import 'package:ebloods/core/widgets/mission_banner.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_provider.dart';
import 'package:ebloods/features/blood_requests/presentation/providers/blood_requests_provider.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final requestsAsync = ref.watch(bloodRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'eBlood',
          style: AppTextStyles.brandName.copyWith(fontSize: 22),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.primary),
            onPressed: () {
              ref.read(authProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: ResponsiveWrapper(
        child: SafeArea(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(bloodRequestsProvider);
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const MissionBanner(),
                  const SizedBox(height: 24),
                  Text(
                    'Welcome back, ${user?.firstName ?? 'Donor'}! 👋',
                    style: AppTextStyles.welcomeTitle.copyWith(fontSize: 22),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Together we save lives. Check urgent blood requests below.',
                    style: AppTextStyles.bodySmall.copyWith(color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Recent Blood Requests',
                        style: AppTextStyles.welcomeTitle.copyWith(fontSize: 18),
                      ),
                      TextButton(
                        onPressed: () {
                          ref.read(bloodRequestsProvider.notifier).refresh();
                        },
                        child: const Text('Refresh', style: TextStyle(color: AppColors.primary)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  requestsAsync.when(
                    loading: () => const SizedBox(
                      height: 200,
                      child: LoadingIndicator(message: 'Fetching blood requests...'),
                    ),
                    error: (error, _) => EmptyState(
                      icon: Icons.error_outline,
                      title: 'Failed to load requests',
                      message: error.toString(),
                      buttonText: 'Retry',
                      onRetry: () {
                        ref.read(bloodRequestsProvider.notifier).refresh();
                      },
                    ),
                    data: (requests) {
                      if (requests.isEmpty) {
                        return EmptyState(
                          icon: Icons.water_drop_outlined,
                          title: 'No Active Requests',
                          message: 'There are currently no urgent blood requests near you.',
                          buttonText: 'Refresh',
                          onRetry: () {
                            ref.read(bloodRequestsProvider.notifier).refresh();
                          },
                        );
                      }
                      return ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: requests.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final req = requests[index];
                          return Card(
                            elevation: 1,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(color: AppColors.inputBorder),
                            ),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: AppColors.primary,
                                child: Text(
                                  req.bloodGroup,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              title: Text(
                                '${req.unitsRequired} Unit(s) - ${req.requestType.toUpperCase()}',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(
                                'Urgency: ${req.urgency.toUpperCase()} | Status: ${req.status}',
                                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                              ),
                              trailing: Chip(
                                label: Text(
                                  req.status,
                                  style: const TextStyle(fontSize: 11, color: Colors.white),
                                ),
                                backgroundColor: req.urgency == 'urgent'
                                    ? AppColors.primary
                                    : Colors.orange,
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
