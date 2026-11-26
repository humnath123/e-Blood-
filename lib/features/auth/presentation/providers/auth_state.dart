import 'package:ebloods/features/auth/data/models/user_model.dart';

enum AuthStatus { initial, authenticated, unauthenticated, loading }

class AuthState {
  final AuthStatus status;
  final UserModel? user;
  final String? token;
  final String? error;

  const AuthState._({required this.status, this.user, this.token, this.error});

  const AuthState.initial() : this._(status: AuthStatus.initial);
  const AuthState.authenticated(UserModel user, String token)
      : this._(status: AuthStatus.authenticated, user: user, token: token);
  const AuthState.unauthenticated([String? error])
      : this._(status: AuthStatus.unauthenticated, error: error);
  const AuthState.loading() : this._(status: AuthStatus.loading);

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    String? token,
    String? error,
  }) {
    return AuthState._(
      status: status ?? this.status,
      user: user ?? this.user,
      token: token ?? this.token,
      error: error,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthState &&
          status == other.status &&
          user == other.user &&
          token == other.token &&
          error == other.error;

  @override
  int get hashCode => Object.hashAll([status, user, token, error]);

  @override
  String toString() =>
      'AuthState{status: $status, user: $user, token: $token, error: $error}';
}
