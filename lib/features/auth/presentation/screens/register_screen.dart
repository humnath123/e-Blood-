import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ebloods/core/constants/app_constants.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';
import 'package:ebloods/core/utils/responsive_wrapper.dart';
import 'package:ebloods/core/utils/validators.dart';
import 'package:ebloods/core/widgets/blood_drop_illustration.dart';
import 'package:ebloods/core/widgets/blood_group_chip.dart';
import 'package:ebloods/core/widgets/eblood_text_field.dart';
import 'package:ebloods/core/widgets/footer_banner.dart';
import 'package:ebloods/core/widgets/google_button.dart';
import 'package:ebloods/core/widgets/gradient_button.dart';
import 'package:ebloods/core/widgets/nepal_scenery_painter.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_provider.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_state.dart';
import 'package:ebloods/features/auth/presentation/widgets/auth_tab_switcher.dart';
import 'package:ebloods/routes/app_routes.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  String _selectedBloodGroup = 'A+';
  bool _acceptTerms = true;

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
    _fullNameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _entranceController.dispose();
    super.dispose();
  }

  void _onRegisterSubmitted() async {
    if (!_acceptTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please accept Terms & Conditions to proceed.'),
          backgroundColor: AppColors.primary,
        ),
      );
      return;
    }

    if (_formKey.currentState!.validate()) {
      final names = _fullNameController.text.trim().split(' ');
      final firstName = names.isNotEmpty ? names.first : 'User';
      final lastName = names.length > 1 ? names.sublist(1).join(' ') : '';

      final success = await ref.read(authProvider.notifier).register(
            email: _emailController.text.trim(),
            username: _usernameController.text.trim().isNotEmpty
                ? _usernameController.text.trim()
                : _emailController.text.split('@').first,
            firstName: firstName,
            lastName: lastName.isNotEmpty ? lastName : 'Donor',
            password: _passwordController.text,
            phone: _phoneController.text.trim().isNotEmpty
                ? _phoneController.text.trim()
                : null,
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
                  // Header section
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
                                text: 'Create ',
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textDark,
                                ),
                                children: [
                                  TextSpan(
                                    text: 'Account',
                                    style: TextStyle(color: AppColors.primary),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Join our life-saving community\nand become a hero.',
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
                        const SizedBox(height: 8),
                        AuthTabSwitcher(
                          isRegister: true,
                          onTabChanged: (isRegister) {
                            if (!isRegister) {
                              ref.read(authProvider.notifier).clearError();
                              context.go(AppRoutes.login);
                            }
                          },
                        ),
                        const SizedBox(height: 24),
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
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              EBloodTextField(
                                controller: _fullNameController,
                                hint: 'Full Name (e.g. John Doe)',
                                label: '',
                                textInputAction: TextInputAction.next,
                                suffixIcon: const Icon(Icons.person_outline, color: AppColors.textMuted, size: 20),
                                validator: (val) => Validators.validateRequired(val, 'Full name'),
                              ),
                              const SizedBox(height: 16),
                              EBloodTextField(
                                controller: _emailController,
                                hint: 'Email address',
                                label: '',
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                suffixIcon: const Icon(Icons.email_outlined, color: AppColors.textMuted, size: 20),
                                validator: Validators.validateEmail,
                              ),
                              const SizedBox(height: 16),
                              EBloodTextField(
                                controller: _phoneController,
                                hint: 'Phone number (optional)',
                                label: '',
                                isOptional: true,
                                keyboardType: TextInputType.phone,
                                textInputAction: TextInputAction.next,
                                suffixIcon: const Icon(Icons.phone_outlined, color: AppColors.textMuted, size: 20),
                                validator: Validators.validatePhone,
                              ),
                              const SizedBox(height: 16),
                              EBloodTextField(
                                controller: _passwordController,
                                hint: 'Password (min 8 chars)',
                                label: '',
                                isPassword: true,
                                textInputAction: TextInputAction.next,
                                validator: Validators.validatePassword,
                              ),
                              const SizedBox(height: 16),
                              EBloodTextField(
                                controller: _confirmPasswordController,
                                hint: 'Confirm password',
                                label: '',
                                isPassword: true,
                                textInputAction: TextInputAction.done,
                                validator: (val) => Validators.validateConfirmPassword(
                                  val,
                                  _passwordController.text,
                                ),
                              ),
                              const SizedBox(height: 20),
                              Text(
                                'Select Blood Group',
                                style: AppTextStyles.bodySmall.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textDark,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: AppConstants.bloodGroups.map((bg) {
                                  return BloodGroupChip(
                                    bloodGroup: bg,
                                    isSelected: _selectedBloodGroup == bg,
                                    onTap: () {
                                      setState(() {
                                        _selectedBloodGroup = bg;
                                      });
                                    },
                                  );
                                }).toList(),
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Checkbox(
                                    value: _acceptTerms,
                                    activeColor: AppColors.primary,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    onChanged: (val) {
                                      setState(() {
                                        _acceptTerms = val ?? true;
                                      });
                                    },
                                  ),
                                  Expanded(
                                    child: Text(
                                      'I agree to the Terms & Conditions and Privacy Policy',
                                      style: AppTextStyles.bodySmall.copyWith(
                                        color: AppColors.textMuted,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 24),
                              GradientButton(
                                text: 'Create Account →',
                                isLoading: isLoading,
                                onPressed: _onRegisterSubmitted,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
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
                        const GoogleButton(),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Already have an account? ',
                              style: AppTextStyles.bodySmall.copyWith(
                                color: AppColors.textMuted,
                              ),
                            ),
                            InkWell(
                              onTap: () {
                                ref.read(authProvider.notifier).clearError();
                                context.go(AppRoutes.login);
                              },
                              child: Text(
                                'Login',
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 32),
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
