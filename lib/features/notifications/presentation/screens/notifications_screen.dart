import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';
import 'package:ebloods/core/utils/responsive_wrapper.dart';
import 'package:ebloods/core/widgets/empty_state.dart';
import 'package:ebloods/core/widgets/loading_indicator.dart';
import 'package:ebloods/features/notifications/presentation/providers/notifications_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all, color: AppColors.primary),
            tooltip: 'Mark all as read',
            onPressed: () {
              ref.read(notificationsProvider.notifier).markAllAsRead();
            },
          ),
        ],
      ),
      body: ResponsiveWrapper(
        child: SafeArea(
          child: notificationsAsync.when(
            loading: () => const LoadingIndicator(message: 'Loading notifications...'),
            error: (err, _) => EmptyState(
              icon: Icons.notifications_off_outlined,
              title: 'Could not load notifications',
              message: err.toString(),
              buttonText: 'Try Again',
              onRetry: () {
                ref.read(notificationsProvider.notifier).refresh();
              },
            ),
            data: (notifications) {
              if (notifications.isEmpty) {
                return EmptyState(
                  icon: Icons.notifications_none,
                  title: 'No Notifications',
                  message: 'You have no new notifications right now.',
                  buttonText: 'Refresh',
                  onRetry: () {
                    ref.read(notificationsProvider.notifier).refresh();
                  },
                );
              }
              return RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async {
                  ref.read(notificationsProvider.notifier).refresh();
                },
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: notifications.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final item = notifications[index];
                    return Card(
                      color: item.isRead ? Colors.white : AppColors.banner,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: item.isRead ? AppColors.inputBorder : AppColors.primaryLight,
                        ),
                      ),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: item.isRead ? Colors.grey.shade300 : AppColors.primary,
                          child: Icon(
                            Icons.notifications,
                            color: item.isRead ? Colors.grey.shade700 : Colors.white,
                            size: 20,
                          ),
                        ),
                        title: Text(
                          item.title,
                          style: TextStyle(
                            fontWeight: item.isRead ? FontWeight.normal : FontWeight.bold,
                          ),
                        ),
                        subtitle: Text(
                          item.message,
                          style: AppTextStyles.bodySmall.copyWith(fontSize: 12),
                        ),
                        onTap: () {
                          if (!item.isRead) {
                            ref.read(notificationsProvider.notifier).markAsRead(item.id);
                          }
                        },
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
