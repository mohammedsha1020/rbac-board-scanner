import 'dart:convert';
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

  Future<void> _checkInitialSession() async {
    final token = await _apiClient.getToken();
    if (token != null) {
      try {
        final response = await _apiClient.get('/api/auth/profile');
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          state = AuthState(user: User.fromJson(data), token: token);
        } else {
          await _apiClient.clearToken();
          state = AuthState();
        }
      } catch (e) {
        state = AuthState(errorMessage: 'Offline session active');
      }
    }
  }

  Future<bool> login(String username, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final response = await _apiClient.post('/api/auth/login', {
        'username': username,
        'password': password,
      });

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final token = data['token'];
        final user = User.fromJson(data['user']);
        
        await _apiClient.saveToken(token);
        state = AuthState(user: user, token: token);
        return true;
      } else {
        final data = json.decode(response.body);
        state = state.copyWith(
          isLoading: false,
          errorMessage: data['error'] ?? 'Login failed (${response.statusCode})',
        );
        return false;
      }
    } catch (e) {
      final msg = e.toString().replaceAll('Exception: ', '');
      state = state.copyWith(
        isLoading: false,
        errorMessage: msg,
      );
      return false;
    }
  }

  Future<bool> register(String username, String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final response = await _apiClient.post('/api/auth/register', {
        'username': username,
        'email': email,
        'password': password,
      });

      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = json.decode(response.body);
        final token = data['token'];
        final user = User.fromJson(data['user']);
        
        await _apiClient.saveToken(token);
        state = AuthState(user: user, token: token);
        return true;
      } else {
        final data = json.decode(response.body);
        state = state.copyWith(
          isLoading: false,
          errorMessage: data['error'] ?? 'Registration failed (${response.statusCode})',
        );
        return false;
      }
    } catch (e) {
      final msg = e.toString().replaceAll('Exception: ', '');
      state = state.copyWith(
        isLoading: false,
        errorMessage: msg,
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
