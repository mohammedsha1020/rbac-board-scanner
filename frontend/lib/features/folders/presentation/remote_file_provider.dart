import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';

final remoteDirectoryProvider = FutureProvider.family<List<dynamic>, Map<String, String>>((ref, params) async {
  final targetUserId = params['targetUserId']!;
  final path = params['path'] ?? '/storage/emulated/0';
  final apiClient = ref.read(apiClientProvider);

  final response = await apiClient.get('/api/admin/remote-dir?targetUserId=$targetUserId&path=$path');
  if (response.statusCode == 200) {
    return json.decode(response.body) as List<dynamic>;
  } else {
    throw Exception('Failed to fetch remote directory: ${response.statusCode} - ${response.body}');
  }
});

final remoteFileUrlProvider = FutureProvider.family<String, Map<String, String>>((ref, params) async {
  final targetUserId = params['targetUserId']!;
  final filePath = params['filePath']!;
  final apiClient = ref.read(apiClientProvider);

  final response = await apiClient.post('/api/admin/remote-file', {
    'targetUserId': targetUserId,
    'filePath': filePath,
  });
  
  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return data['url'] as String;
  } else {
    throw Exception('Failed to request remote file: ${response.statusCode} - ${response.body}');
  }
});
