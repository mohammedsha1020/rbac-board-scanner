import 'dart:convert';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:rbac_board_scanner/core/network/api_client.dart';
import '../domain/user_model.dart';

class AuthState {
  final User? user;
  final bool isLoading;
  final String? errorMessage;
  final String? token;

  AuthState({this.user, this.isLoading = false, this.errorMessage, this.token});

  AuthState copyWith({
    User? user,
    bool? isLoading,
    String? errorMessage,
    String? token,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage ?? this.errorMessage,
      token: token ?? this.token,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _apiClient;

  AuthNotifier(this._apiClient) : super(AuthState()) {
    _checkInitialSession();
  }

  Future<void> _reportDeviceTelemetry() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      final packageInfo = await PackageInfo.fromPlatform();
      
      String deviceName = 'Unknown';
      String androidVersion = 'Unknown';
      String deviceModel = 'Unknown';
      
      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        deviceName = androidInfo.brand;
        androidVersion = androidInfo.version.release;
        deviceModel = androidInfo.model;
      }

      await _apiClient.post('/api/auth/device', {
        'deviceName': deviceName,
        'androidVersion': androidVersion,
        'deviceModel': deviceModel,
        'appVersion': packageInfo.version,
      });
    } catch (_) {
      // Fail silently for telemetry
    }
  }

  /// Safely parse response body — never throws FormatException
  Map<String, dynamic> _safeJsonDecode(String body) {
    try {
      final trimmed = body.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        final parsed = json.decode(trimmed);
        if (parsed is Map<String, dynamic>) {
          return parsed;
        }
      }
    } catch (_) {}
    return {};
  }

  /// Build a human-readable error message from an HTTP response
  String _errorFromResponse(int statusCode, String body, String url) {
    final data = _safeJsonDecode(body);
    if (data.containsKey('error')) {
      return '${data['error']}';
    }
    if (data.containsKey('message')) {
      return '${data['message']}';
    }
    // Show diagnostic info: status code, URL, and body preview
    final bodyPreview = body.length > 80 ? body.substring(0, 80) : body;
    return 'HTTP $statusCode from $url\nBody: $bodyPreview';
  }

  Future<void> _checkInitialSession() async {
    final token = await _apiClient.getToken();
    if (token != null) {
      try {
        final response = await _apiClient.get('/api/auth/profile');
        if (response.statusCode == 200) {
          final data = _safeJsonDecode(response.body);
          if (data.containsKey('id')) {
            state = AuthState(user: User.fromJson(data), token: token);
            _reportDeviceTelemetry();
            return;
          }
        }
        // Token is stale or server returned non-200 — clear silently
        await _apiClient.clearToken();
        state = AuthState();
      } catch (e) {
        // Network error during session check — clear token, show login
        await _apiClient.clearToken();
        state = AuthState();
      }
    }
  }

  Future<bool> login(String username, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    final url = '${_apiClient.baseUrl}/api/auth/login';
    try {
      final response = await _apiClient.post('/api/auth/login', {
        'username': username,
        'password': password,
      });

      if (response.statusCode == 200) {
        final data = _safeJsonDecode(response.body);
        if (data.containsKey('token') && data.containsKey('user')) {
          final token = data['token'] as String;
          final user = User.fromJson(data['user'] as Map<String, dynamic>);
          await _apiClient.saveToken(token);
          state = AuthState(user: user, token: token);
          _reportDeviceTelemetry();
          return true;
        }
        // 200 but unexpected body shape
        final bodySnippet = response.body.length > 120
            ? response.body.substring(0, 120)
            : response.body;
        state = state.copyWith(
          isLoading: false,
          errorMessage: 'Server returned 200 but missing token/user.\nURL: $url\nBody: $bodySnippet',
        );
        return false;
      } else {
        state = state.copyWith(
          isLoading: false,
          errorMessage: _errorFromResponse(response.statusCode, response.body, url),
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  Future<bool> register(String username, String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    final url = '${_apiClient.baseUrl}/api/auth/register';
    try {
      final response = await _apiClient.post('/api/auth/register', {
        'username': username,
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = _safeJsonDecode(response.body);
        if (data.containsKey('token') && data.containsKey('user')) {
          final token = data['token'] as String;
          final user = User.fromJson(data['user'] as Map<String, dynamic>);
          await _apiClient.saveToken(token);
          state = AuthState(user: user, token: token);
          _reportDeviceTelemetry();
          return true;
        }
        state = state.copyWith(
          isLoading: false,
          errorMessage: 'Server returned ${response.statusCode} but missing token/user.\nURL: $url',
        );
        return false;
      } else {
        state = state.copyWith(
          isLoading: false,
          errorMessage: _errorFromResponse(response.statusCode, response.body, url),
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _apiClient.clearToken();
    state = AuthState();
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(baseUrl: 'http://13.232.148.24:5000');
});

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(apiClientProvider));
});
