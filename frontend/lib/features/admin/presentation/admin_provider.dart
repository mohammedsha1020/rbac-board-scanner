import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../auth/presentation/auth_provider.dart';

class AdminState {
  final List<dynamic> users;
  final List<dynamic> devices;
  final List<dynamic> auditLogs;
  final bool isLoading;
  final String? errorMessage;

  AdminState({
    this.users = const [],
    this.devices = const [],
    this.auditLogs = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  AdminState copyWith({
    List<dynamic>? users,
    List<dynamic>? devices,
    List<dynamic>? auditLogs,
    bool? isLoading,
    String? errorMessage,
  }) {
    return AdminState(
      users: users ?? this.users,
      devices: devices ?? this.devices,
      auditLogs: auditLogs ?? this.auditLogs,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

class AdminNotifier extends StateNotifier<AdminState> {
  final ApiClient _apiClient;

  AdminNotifier(this._apiClient) : super(AdminState());

  Future<void> fetchUsers() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _apiClient.get('/api/admin/users');
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        state = state.copyWith(users: data, isLoading: false);
      } else {
        state = state.copyWith(isLoading: false, errorMessage: 'Failed to load users');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  Future<void> fetchDevices() async {
    try {
      final response = await _apiClient.get('/api/admin/devices');
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        state = state.copyWith(devices: data);
      }
    } catch (e) {
      // Offline fallback
    }
  }

  Future<void> fetchAuditLogs() async {
    try {
      final response = await _apiClient.get('/api/admin/audit-logs');
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        state = state.copyWith(auditLogs: data);
      }
    } catch (e) {
      // Restricted or Offline
    }
  }

  Future<bool> toggleUserLock(String userId, bool currentLockState) async {
    try {
      final response = await _apiClient.put('/api/admin/users/$userId', {
        'isLocked': !currentLockState,
      });
      if (response.statusCode == 200) {
        // Refresh local state list
        await fetchUsers();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> resetPassword(String userId, String newPassword) async {
    try {
      final response = await _apiClient.post('/api/admin/users/$userId/reset-password', {
        'newPassword': newPassword,
      });
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}

final adminProvider = StateNotifierProvider<AdminNotifier, AdminState>((ref) {
  return AdminNotifier(ref.read(apiClientProvider));
});
