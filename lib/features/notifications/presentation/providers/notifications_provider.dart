import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/features/notifications/data/models/notification_model.dart';
import 'package:ebloods/features/notifications/data/notifications_repository.dart';

class NotificationsNotifier extends AsyncNotifier<List<NotificationModel>> {
  late final NotificationsRepository _repository;

  @override
  Future<List<NotificationModel>> build() async {
    _repository = NotificationsRepository();
    return _repository.getAllNotifications();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repository.getAllNotifications());
  }

  Future<void> markAsRead(String id) async {
    final updated = await _repository.markAsRead(id);
    if (updated != null) {
      ref.invalidateSelf();
    }
  }

  Future<void> markAllAsRead() async {
    final success = await _repository.markAllAsRead();
    if (success) {
      ref.invalidateSelf();
    }
  }

  Future<bool> deleteNotification(String id) async {
    final success = await _repository.deleteNotification(id);
    if (success) {
      ref.invalidateSelf();
    }
    return success;
  }
}

final notificationsProvider =
    AsyncNotifierProvider<NotificationsNotifier, List<NotificationModel>>(
  NotificationsNotifier.new,
);
