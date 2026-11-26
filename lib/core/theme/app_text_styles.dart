import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:ebloods/core/theme/app_colors.dart';

class AppTextStyles {
  AppTextStyles._();

  static TextStyle get brandName => GoogleFonts.poppins(
      fontSize: 34, fontWeight: FontWeight.w700, color: AppColors.textDark, height: 1.1);

  static TextStyle get tagline => GoogleFonts.poppins(
      fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textDark);

  static TextStyle get welcomeTitle => GoogleFonts.poppins(
      fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.textDark);

  static TextStyle get welcomeSubtitle => GoogleFonts.poppins(
      fontSize: 14, height: 1.3, color: AppColors.textDark);

  static TextStyle get tabLabel =>
      GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w500);

  static TextStyle get inputText =>
      GoogleFonts.poppins(fontSize: 15, color: AppColors.textDark);

  static TextStyle get inputHint =>
      GoogleFonts.poppins(fontSize: 14, color: AppColors.textMuted);

  static TextStyle get bodySmall =>
      GoogleFonts.poppins(fontSize: 14, color: AppColors.textBody);

  static TextStyle get linkRed => GoogleFonts.poppins(
      fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.primary);

  static TextStyle get linkRedBold => GoogleFonts.poppins(
      fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.primary);

  static TextStyle get buttonLabel => GoogleFonts.poppins(
      fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white);

  static TextStyle get googleLabel => GoogleFonts.poppins(
      fontSize: 16, fontWeight: FontWeight.w500, color: AppColors.textDark);

  static TextStyle get bannerText => GoogleFonts.poppins(
      fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textDark);

  static TextStyle get footerLink =>
      GoogleFonts.poppins(fontSize: 12, color: AppColors.textFooter);
}