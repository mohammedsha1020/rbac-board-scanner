import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../core/database/sqlite_helper.dart';
import '../../../core/network/api_client.dart';
import '../../auth/presentation/auth_provider.dart';

// SQLite database provider
final sqliteHelperProvider = Provider<SqliteHelper>((ref) => SqliteHelper());

// Current folder ID state (null for root)
final currentFolderProvider = StateProvider<String?>((ref) => null);
final selectedSandboxUserProvider = StateProvider<String?>((ref) => null);

// Folders State Notifier
class FoldersNotifier extends StateNotifier<AsyncValue<List<Map<String, dynamic>>>> {
  final ApiClient _apiClient;
  final SqliteHelper _dbHelper;
  final String? _currentFolderId;
  final String? _targetUserId;

  FoldersNotifier({
    required ApiClient apiClient,
    required SqliteHelper dbHelper,
    required String? currentFolderId,
    required String? targetUserId,
  })  : _apiClient = apiClient,
        _dbHelper = dbHelper,
        _currentFolderId = currentFolderId,
        _targetUserId = targetUserId,
        super(const AsyncValue.loading()) {
    loadFolders();
  }

  Future<void> loadFolders() async {
    state = const AsyncValue.loading();
    try {
      if (_targetUserId != null) {
        // Direct remote fetch for inspecting other users
        final response = await _apiClient.get('/api/folders?parentId=${_currentFolderId ?? ""}&targetUserId=$_targetUserId');
        if (response.statusCode == 200) {
          final List<dynamic> remoteData = json.decode(response.body);
          state = AsyncValue.data(remoteData.cast<Map<String, dynamic>>());
        } else {
          state = AsyncValue.error("Failed to fetch user's folders", StackTrace.current);
        }
        return;
      }

      // 1. Fetch from offline SQLite database
      final localFolders = await _dbHelper.getFolders(_currentFolderId);
      state = AsyncValue.data(localFolders);

      // 2. Query remote API background sync
      final response = await _apiClient.get('/api/folders?parentId=${_currentFolderId ?? ""}');
      if (response.statusCode == 200) {
        final List<dynamic> remoteData = json.decode(response.body);
        
        // 3. Update SQLite and refresh local state
        for (var folder in remoteData) {
          await _dbHelper.insertFolder({
            'id': folder['id'],
            'name': folder['name'],
            'parentId': folder['parentId'],
            'isSynced': 1,
            'isDeleted': folder['isDeleted'] == true ? 1 : 0,
            'createdAt': folder['createdAt'] ?? DateTime.now().toIso8601String(),
          });
        }
        
        final updatedLocalFolders = await _dbHelper.getFolders(_currentFolderId);
        state = AsyncValue.data(updatedLocalFolders);
      }
    } catch (e) {
      // Graceful fallback to offline cached data
      // State retains local folders loaded in step 1
    }
  }

  Future<bool> createFolder(String name) async {
    final newId = const Uuid().v4();
    final now = DateTime.now().toIso8601String();

    final newFolder = {
      'id': newId,
      'name': name,
      'parentId': _currentFolderId,
      'isSynced': 0,
      'isDeleted': 0,
      'createdAt': now,
    };

    try {
      // Write locally first
      await _dbHelper.insertFolder(newFolder);
      
      // Update UI state immediately
      final currentList = state.value ?? [];
      state = AsyncValue.data([...currentList, newFolder]);

      // Push to remote server in background
      final response = await _apiClient.post('/api/folders', {
        'name': name,
        'parentId': _currentFolderId,
      });

      if (response.statusCode == 201) {
        // Mark as synced locally
        final createdFolder = json.decode(response.body);
        await _dbHelper.insertFolder({
          'id': createdFolder['id'],
          'name': createdFolder['name'],
          'parentId': createdFolder['parentId'],
          'isSynced': 1,
          'isDeleted': 0,
          'createdAt': createdFolder['createdAt'],
        });
      }
      return true;
    } catch (e) {
      // Retained offline
      return true;
    }
  }
}

final foldersListProvider = StateNotifierProvider.family<FoldersNotifier, AsyncValue<List<Map<String, dynamic>>>, String?>((ref, folderId) {
  return FoldersNotifier(
    apiClient: ref.read(apiClientProvider),
    dbHelper: ref.read(sqliteHelperProvider),
    currentFolderId: folderId,
    targetUserId: ref.watch(selectedSandboxUserProvider),
  );
});

// Scans State Notifier
class ScansNotifier extends StateNotifier<AsyncValue<List<Map<String, dynamic>>>> {
  final ApiClient _apiClient;
  final SqliteHelper _dbHelper;
  final String? _currentFolderId;
  final String? _targetUserId;

  ScansNotifier({
    required ApiClient apiClient,
    required SqliteHelper dbHelper,
    required String? currentFolderId,
    required String? targetUserId,
  })  : _apiClient = apiClient,
        _dbHelper = dbHelper,
        _currentFolderId = currentFolderId,
        _targetUserId = targetUserId,
        super(const AsyncValue.loading()) {
    loadScans();
  }

  Future<void> loadScans() async {
    state = const AsyncValue.loading();
    try {
      if (_targetUserId != null) {
        // Direct remote fetch for inspecting other users
        final response = await _apiClient.get('/api/scans?folderId=${_currentFolderId ?? ""}&targetUserId=$_targetUserId');
        if (response.statusCode == 200) {
          final List<dynamic> remoteData = json.decode(response.body);
          state = AsyncValue.data(remoteData.cast<Map<String, dynamic>>());
        } else {
          state = AsyncValue.error("Failed to fetch user's scans", StackTrace.current);
        }
        return;
      }

      // 1. Fetch offline SQLite scans
      final localScans = await _dbHelper.getScans(_currentFolderId);
      state = AsyncValue.data(localScans);

      // 2. Query remote API
      final response = await _apiClient.get('/api/scans?folderId=${_currentFolderId ?? ""}');
      if (response.statusCode == 200) {
        final List<dynamic> remoteData = json.decode(response.body);

        for (var scan in remoteData) {
          await _dbHelper.insertScan({
            'id': scan['id'],
            'name': scan['name'],
            'filePath': scan['filePath'],
            'boardType': scan['boardType'],
            'storageSize': scan['storageSize'],
            'ocrText': scan['ocrText'],
            'folderId': scan['folderId'],
            'isSynced': 1,
            'isDeleted': scan['isDeleted'] == true ? 1 : 0,
            'createdAt': scan['createdAt'] ?? DateTime.now().toIso8601String(),
          });
        }

        final updatedLocalScans = await _dbHelper.getScans(_currentFolderId);
        state = AsyncValue.data(updatedLocalScans);
      }
    } catch (e) {
      // Graceful offline retain
    }
  }

  Future<bool> addScan({
    required String name,
    required String filePath,
    required String boardType,
    required int storageSize,
    String? ocrText,
  }) async {
    final newId = const Uuid().v4();
    final now = DateTime.now().toIso8601String();

    final newScan = {
      'id': newId,
      'name': name,
      'filePath': filePath,
      'boardType': boardType,
      'storageSize': storageSize,
      'ocrText': ocrText ?? '',
      'folderId': _currentFolderId,
      'isSynced': 0,
      'isDeleted': 0,
      'createdAt': now,
    };

    try {
      // Save locally
      await _dbHelper.insertScan(newScan);
      
      // Update local state list
      final currentList = state.value ?? [];
      state = AsyncValue.data([...currentList, newScan]);

      // Synchronize to cloud
      final response = await _apiClient.post('/api/scans', {
        'name': name,
        'filePath': filePath,
        'boardType': boardType,
        'storageSize': storageSize,
        'ocrText': ocrText ?? '',
        'folderId': _currentFolderId,
      });

      if (response.statusCode == 201) {
        await _dbHelper.markScanSynced(newId);
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  Future<void> deleteScan(String scanId) async {
    try {
      // Mark local delete
      await _dbHelper.deleteScan(scanId);
      final currentList = state.value ?? [];
      state = AsyncValue.data(currentList.where((s) => s['id'] != scanId).toList());

      // Push delete to server API
      final response = await _apiClient.delete('/api/scans/$scanId');
      if (response.statusCode == 200) {
        // Sync complete
      }
    } catch (e) {
      // Retained offline deletion
    }
  }
}

final scansListProvider = StateNotifierProvider.family<ScansNotifier, AsyncValue<List<Map<String, dynamic>>>, String?>((ref, folderId) {
  return ScansNotifier(
    apiClient: ref.read(apiClientProvider),
    dbHelper: ref.read(sqliteHelperProvider),
    currentFolderId: folderId,
    targetUserId: ref.watch(selectedSandboxUserProvider),
  );
});
