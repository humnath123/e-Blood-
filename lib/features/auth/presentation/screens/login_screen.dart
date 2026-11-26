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
import 'package:ebloods/core/widgets/google_button.dart';
import 'package:ebloods/core/widgets/gradient_button.dart';
import 'package:ebloods/core/widgets/nepal_scenery_painter.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_provider.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_state.dart';
import 'package:ebloods/features/auth/presentation/widgets/auth_tab_switcher.dart';
import 'package:ebloods/routes/app_routes.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _rememberMe = true;

  late final AnimationController _entranceController;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOut,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOutCubic,
    ));
    _entranceController.forward();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _entranceController.dispose();
    super.dispose();
  }

  void _onLoginSubmitted() async {
    if (_formKey.currentState!.validate()) {
      final success = await ref.read(authProvider.notifier).login(
            identifier: _emailController.text.trim(),
            password: _passwordController.text,
          );
      if (success && mounted) {
        context.go(AppRoutes.home);
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
          child: SlideTransition(
            position: _slideAnimation,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Header section with Nepal scenery & blood drop illustration
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
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              // Logo & Tagline wrapped in Expanded to prevent any overflow
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(8),
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            shape: BoxShape.circle,
                                            boxShadow: [
                                              BoxShadow(
                                                color: AppColors.primary.withValues(alpha: 0.2),
                                                blurRadius: 10,
                                              ),
                                            ],
                                          ),
                                          child: const Icon(
                                            Icons.water_drop_rounded,
                                            color: AppColors.primary,
                                            size: 26,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          'eBlood',
                                          style: AppTextStyles.brandName.copyWith(fontSize: 30),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'One Drop. One Hope. One Life.',
                                      style: AppTextStyles.tagline,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              // Blood Drop & Hand Illustration with constrained width
                              const SizedBox(
                                width: 120,
                                height: 120,
                                child: BloodDropIllustration(),
                              ),
                            ],
                          ),
                        ),
                      ),
                      // Welcome text
                      Positioned(
                        left: 24,
                        top: 140,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            RichText(
                              text: const TextSpan(
                                text: 'Welcome ',
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textDark,
                                ),
                                children: [
                                  TextSpan(
                                    text: 'Back!',
                                    style: TextStyle(color: AppColors.primary),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Sign in to continue\nour life-saving mission.',
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
                  // Curved red bottom wave transition
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
                  // Form Content Container
                  Container(
                    color: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 8),
                        // Segmented Tab Switcher
                        AuthTabSwitcher(
                          isRegister: false,
                          onTabChanged: (isRegister) {
                            if (isRegister) {
                              ref.read(authProvider.notifier).clearError();
                              context.go(AppRoutes.register);
                            }
                          },
                        ),
                        const SizedBox(height: 28),
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
                        // Login Form
                        Form(
                          key: _formKey,
                          child: Column(
                            children: [
                              EBloodTextField(
                                controller: _emailController,
                                hint: 'Email address or phone number',
                                label: '',
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                suffixIcon: const Icon(Icons.email_outlined, color: AppColors.textMuted, size: 20),
                                validator: (value) => Validators.validateRequired(
                                  value,
                                  'Email or phone',
                                ),
                              ),
                              const SizedBox(height: 16),
                              EBloodTextField(
                                controller: _passwordController,
                                hint: 'Password',
                                label: '',
                                isPassword: true,
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) => _onLoginSubmitted(),
                                validator: Validators.validatePassword,
                              ),
                              const SizedBox(height: 12),
                              // Remember me & Forgot password
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Checkbox(
                                        value: _rememberMe,
                                        activeColor: AppColors.primary,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        onChanged: (val) {
                                          setState(() {
                                            _rememberMe = val ?? true;
                                          });
                                        },
                                      ),
                                      Text(
                                        'Remember me',
                                        style: AppTextStyles.bodySmall.copyWith(
                                          color: AppColors.textDark,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                  TextButton(
                                    onPressed: () {
                                      ref.read(authProvider.notifier).clearError();
                                      context.push(AppRoutes.forgotPassword);
                                    },
                                    child: const Text(
                                      'Forgot password?',
                                      style: TextStyle(
                                        color: AppColors.primary,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),
                              // Login Button with arrow
                              GradientButton(
                                text: 'Login →',
                                isLoading: isLoading,
                                onPressed: _onLoginSubmitted,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                        // or continue with divider
                        const Row(
                          children: [
                            Expanded(child: Divider(color: AppColors.divider)),
                            Padding(
                              padding: EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                'or continue with',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            Expanded(child: Divider(color: AppColors.divider)),
                          ],
                        ),
                        const SizedBox(height: 20),
                        // Google Button
                        const GoogleButton(),
                        const SizedBox(height: 24),
                        // Registration Navigation Link
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              "Don't have an account? ",
                              style: AppTextStyles.bodySmall.copyWith(
                                color: AppColors.textMuted,
                              ),
                            ),
                            InkWell(
                              onTap: () {
                                ref.read(authProvider.notifier).clearError();
                                context.go(AppRoutes.register);
                              },
                              child: Text(
                                'Create Account',
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 32),
                        // Footer Banner & Links
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
      ),
    );
  }
}
