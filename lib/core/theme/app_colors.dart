import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  static const primary = Color(0xFFE60023);
  static const primaryLight = Color(0xFFFF1A3E);
  static const primaryDark = Color(0xFFC8102E);
  static const heartRed = Color(0xFFE3112B);

  static const scaffoldBg = Color(0xFFFFF8FA);
  static const lightPink = Color(0xFFFCE8ED);

  static const textDark = Color(0xFF151321);
  static const textBody = Color(0xFF2B2B35);
  static const textMuted = Color(0xFF777184);
  static const textFooter = Color(0xFF6B6B76);

  static const inputBorder = Color(0xFFE8DEE0);
  static const tabTrack = Color(0xFFF7F2F3);
  static const tabTrackBorder = Color(0xFFEDE3E5);
  static const banner = Color(0xFFFCE8ED);
  static const divider = Color(0xFFE3DADC);
  static const headerEnd = Color(0xFFFDE4E8);

  static const waveRed = Color(0xFFC8102E);
  static const waveRedLight = Color(0xFFE8505F);

  static const primaryGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [primaryLight, primaryDark],
  );

  static const headerGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFFFF8FA), Color(0xFFFCE8ED)],
  );
}
