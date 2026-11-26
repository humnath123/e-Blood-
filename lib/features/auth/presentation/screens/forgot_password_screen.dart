import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';
import 'package:ebloods/core/utils/responsive_wrapper.dart';
import 'package:ebloods/core/utils/validators.dart';
import 'package:ebloods/core/widgets/blood_drop_illustration.dart';
import 'package:ebloods/core/widgets/eblood_text_field.dart';
import 'package:ebloods/core/widgets/footer_banner.dart';
import 'package:ebloods/core/widgets/gradient_button.dart';
import 'package:ebloods/core/widgets/nepal_scenery_painter.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_provider.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_state.dart';
import 'package:ebloods/routes/app_routes.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _otpSent = false;

  late final AnimationController _entranceController;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOut,
    );
    _entranceController.forward();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _entranceController.dispose();
    super.dispose();
  }

  void _onSendOtpSubmitted() async {
    if (_formKey.currentState!.validate()) {
      final success = await ref.read(authProvider.notifier).forgotPassword(
            email: _emailController.text.trim(),
          );
      if (success && mounted) {
        setState(() {
          _otpSent = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('OTP code sent successfully to your email/phone!'),
            backgroundColor: AppColors.primary,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: ResponsiveWrapper(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Stack(
                  children: [
                    Container(
                      height: 320,
                      width: double.infinity,
                      decoration: const BoxDecoration(
                        gradient: AppColors.headerGradient,
                      ),
                      child: CustomPaint(
                        painter: NepalSceneryPainter(),
                      ),
                    ),
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 20, 0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textDark),
                              onPressed: () {
                                ref.read(authProvider.notifier).clearError();
                                if (context.canPop()) {
                                  context.pop();
                                } else {
                                  context.go(AppRoutes.login);
                                }
                              },
                            ),
                            const SizedBox(
                              width: 120,
                              height: 120,
                              child: BloodDropIllustration(),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: 24,
                      top: 140,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          RichText(
                            text: const TextSpan(
                              text: 'Reset ',
                              style: TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textDark,
                              ),
                              children: [
                                TextSpan(
                                  text: 'Password',
                                  style: TextStyle(color: AppColors.primary),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Enter your email or phone number\nto receive a verification OTP code.',
                            style: AppTextStyles.welcomeSubtitle.copyWith(
                              color: AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            width: 50,
                            height: 3,
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                Transform.translate(
                  offset: const Offset(0, -1),
                  child: Container(
                    height: 24,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(32),
                        topRight: Radius.circular(32),
                      ),
                    ),
                  ),
                ),
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 16),
                      if (authState.error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.primary),
                          ),
                          child: Text(
                            authState.error!,
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontSize: 13,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      Form(
                        key: _formKey,
                        child: Column(
                          children: [
                            EBloodTextField(
                              controller: _emailController,
                              hint: 'Enter your email or phone number',
                              label: '',
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.done,
                              suffixIcon: const Icon(Icons.lock_reset_outlined, color: AppColors.textMuted, size: 20),
                              onFieldSubmitted: (_) => _onSendOtpSubmitted(),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Please enter your email or phone';
                                }
                                final isEmail = Validators.validateEmail(value) == null;
                                final isPhone = Validators.validatePhone(value) == null;
                                if (!isEmail && !isPhone) {
                                  return 'Please enter a valid email or phone number';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 24),
                            GradientButton(
                              text: _otpSent ? 'Resend OTP Code →' : 'Send Reset Link →',
                              isLoading: isLoading,
                              onPressed: _onSendOtpSubmitted,
                            ),
                            const SizedBox(height: 16),
                            TextButton(
                              onPressed: () {
                                ref.read(authProvider.notifier).clearError();
                                context.go(AppRoutes.login);
                              },
                              child: Text(
                                'Back to Login',
                                style: AppTextStyles.linkRedBold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 48),
                      const FooterBanner(),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
