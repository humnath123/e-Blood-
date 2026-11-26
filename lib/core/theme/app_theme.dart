import 'package:flutter/material.dart';
import 'package:ebloods/core/theme/app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary),
    scaffoldBackgroundColor: Colors.white,
    textTheme: const TextTheme(
      displayLarge: TextStyle(fontSize: 72, fontWeight: FontWeight.w700, color: Color(0xFF14141F)),
      displayMedium: TextStyle(fontSize: 56, fontWeight: FontWeight.w700, color: Color(0xFF14141F)),
      headlineLarge: TextStyle(fontSize: 45, fontWeight: FontWeight.w700, color: Color(0xFF14141F)),
      headlineMedium: TextStyle(fontSize: 36, fontWeight: FontWeight.w700, color: Color(0xFF14141F)),
      titleLarge: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF14141F)),
      titleMedium: TextStyle(fontSize: 20, fontWeight: FontWeight.w500, color: Color(0xFF14141F)),
      bodyLarge: TextStyle(fontSize: 16, color: Color(0xFF2B2B35)),
      bodyMedium: TextStyle(fontSize: 14, color: Color(0xFF2B2B35)),
      bodySmall: TextStyle(fontSize: 12, color: Color(0xFF2B2B35)),
      labelLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white),
      labelMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      labelSmall: TextStyle(fontSize: 12),
      headlineSmall: TextStyle(fontSize: 11),
    ),
  );
}