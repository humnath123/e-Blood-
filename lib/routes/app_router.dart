import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_provider.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_state.dart';
import 'package:ebloods/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:ebloods/features/auth/presentation/screens/login_screen.dart';
import 'package:ebloods/features/auth/presentation/screens/register_screen.dart';
import 'package:ebloods/features/blood_requests/presentation/screens/blood_requests_screen.dart';
import 'package:ebloods/features/donors/presentation/screens/donors_screen.dart';
import 'package:ebloods/features/home/presentation/screens/home_screen.dart';
import 'package:ebloods/features/home/presentation/screens/main_shell_screen.dart';
import 'package:ebloods/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:ebloods/features/profile/presentation/screens/profile_screen.dart';
import 'package:ebloods/routes/app_routes.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: AppRoutes.home,
    redirect: (context, state) {
      final status = authState.status;
      if (status == AuthStatus.initial || status == AuthStatus.loading) {
        return null;
      }

      final isAuthRoute = state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.register ||
          state.matchedLocation == AppRoutes.forgotPassword;

      final isAuthenticated = status == AuthStatus.authenticated;

      if (!isAuthenticated && !isAuthRoute) {
        return AppRoutes.login;
      }

      if (isAuthenticated && isAuthRoute) {
        return AppRoutes.home;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return MainShellScreen(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.requests,
                builder: (context, state) => const BloodRequestsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.donors,
                builder: (context, state) => const DonorsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.notifications,
                builder: (context, state) => const NotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
