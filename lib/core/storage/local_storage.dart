import 'package:shared_preferences/shared_preferences.dart';
import 'package:ebloods/core/constants/app_constants.dart';

class LocalStorage {
  static final LocalStorage _instance = LocalStorage._internal();
  factory LocalStorage() => _instance;
  LocalStorage._internal();

  Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();

  Future<void> saveToken(String token) async {
    final prefs = await _prefs;
    await prefs.setString(AppConstants.authTokenKey, token);
  }

  Future<String?> getToken() async {
    final prefs = await _prefs;
    return prefs.getString(AppConstants.authTokenKey);
  }

  Future<void> clearToken() async {
    final prefs = await _prefs;
    await prefs.remove(AppConstants.authTokenKey);
  }

  Future<void> saveUserJson(String userJson) async {
    final prefs = await _prefs;
    await prefs.setString(AppConstants.userModelKey, userJson);
  }

  Future<String?> getUserJson() async {
    final prefs = await _prefs;
    return prefs.getString(AppConstants.userModelKey);
  }

  Future<void> clearUserJson() async {
    final prefs = await _prefs;
    await prefs.remove(AppConstants.userModelKey);
  }

  Future<void> clearAll() async {
    final prefs = await _prefs;
    await prefs.remove(AppConstants.authTokenKey);
    await prefs.remove(AppConstants.userModelKey);
  }
}
