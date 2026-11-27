import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:ebloods/core/theme/app_colors.dart';

class AppTextStyles {
  AppTextStyles._();

  static TextStyle get brandName => GoogleFonts.poppins(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        color: AppColors.textDark,
        letterSpacing: -0.5,
        height: 1.1,
      );

  static TextStyle get tagline => GoogleFonts.poppins(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        fontStyle: FontStyle.italic,
        color: AppColors.textMuted,
        letterSpacing: 0.1,
      );

  static TextStyle get welcomeTitle => GoogleFonts.poppins(
        fontSize: 28,
        fontWeight: FontWeight.w800,
        color: AppColors.textDark,
        letterSpacing: -0.5,
      );

  static TextStyle get welcomeSubtitle => GoogleFonts.poppins(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.4,
        color: AppColors.textMuted,
      );

  static TextStyle get tabLabel => GoogleFonts.poppins(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.2,
      );

  static TextStyle get inputText => GoogleFonts.poppins(
        fontSize: 15,
        fontWeight: FontWeight.w500,
        color: AppColors.textDark,
      );

  static TextStyle get inputHint => GoogleFonts.poppins(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AppColors.textMuted,
      );

  static TextStyle get bodySmall => GoogleFonts.poppins(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AppColors.textBody,
      );

  static TextStyle get linkRed => GoogleFonts.poppins(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppColors.primary,
      );

  static TextStyle get linkRedBold => GoogleFonts.poppins(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: AppColors.primary,
      );

  static TextStyle get buttonLabel => GoogleFonts.poppins(
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: Colors.white,
        letterSpacing: 0.5,
      );

  static TextStyle get googleLabel => GoogleFonts.poppins(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: AppColors.textDark,
      );

  static TextStyle get bannerText => GoogleFonts.poppins(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.textDark,
      );

  static TextStyle get footerLink => GoogleFonts.poppins(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AppColors.textFooter,
      );
}
