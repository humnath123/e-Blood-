class ApiEndpoints {
  ApiEndpoints._();

  /// Base URL is provided via --dart-define=API_URL
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.10.9.55:3000/api/v1',
  );

  /// API Key of backend provided via --dart-define=API_KEY (blank by default, connects later)
  static const String apiKey = String.fromEnvironment(
    'API_KEY',
    defaultValue: '',
  );

  // Auth endpoints
  static String get register => '/auth/register';
  static String get login => '/auth/login';
  static String get forgotPassword => '/auth/forgot-password';
  static String get resetPassword => '/auth/reset-password';
  static String get me => '/auth/me';
  static String get updatePassword => '/auth/password';

  // Feature endpoints
  static String get donors => '/donors';
  static String donorById(String id) => '/donors/$id';

  static String get bloodRequests => '/requests';
  static String bloodRequestById(String id) => '/requests/$id';

  static String get bloodBanks => '/blood-banks';
  static String bloodBankById(String id) => '/blood-banks/$id';

  static String get donations => '/donations';
  static String donationById(String id) => '/donations/$id';

  static String get notifications => '/notifications';
  static String notificationById(String id) => '/notifications/$id';
  static String markNotificationRead(String id) => '/notifications/$id/read';
  static String get markAllNotificationsRead => '/notifications/read-all';
}
