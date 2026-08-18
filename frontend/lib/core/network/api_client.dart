import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  final String baseUrl;
  final http.Client _client = http.Client();
  final _storage = const FlutterSecureStorage();

  ApiClient({required this.baseUrl});

  Future<String?> getToken() async {
    return await _storage.read(key: 'auth_token');
  }

  Future<void> saveToken(String token) async {
    await _storage.write(key: 'auth_token', value: token);
  }

  Future<void> clearToken() async {
    await _storage.delete(key: 'auth_token');
  }

  Map<String, String> _buildHeaders(String? token) {
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<http.Response> get(String path) async {
    final token = await getToken();
    final url = Uri.parse('$baseUrl$path');
    try {
      final response = await _client
          .get(url, headers: _buildHeaders(token))
          .timeout(const Duration(seconds: 12));
      _checkUnauthorized(response);
      return response;
    } catch (e) {
      throw Exception('Network error connecting to $url. Check connection or server status.');
    }
  }

  Future<http.Response> post(String path, Map<String, dynamic> body) async {
    final token = await getToken();
    final url = Uri.parse('$baseUrl$path');
    try {
      final response = await _client
          .post(
            url,
            headers: _buildHeaders(token),
            body: json.encode(body),
          )
          .timeout(const Duration(seconds: 12));
      _checkUnauthorized(response);
      return response;
    } catch (e) {
      throw Exception('Network error connecting to $url. Check connection or server status.');
    }
  }

  Future<http.Response> delete(String path) async {
    final token = await getToken();
    final url = Uri.parse('$baseUrl$path');
    try {
      final response = await _client
          .delete(url, headers: _buildHeaders(token))
          .timeout(const Duration(seconds: 12));
      _checkUnauthorized(response);
      return response;
    } catch (e) {
      throw Exception('Network error connecting to $url. Check connection or server status.');
    }
  }

  Future<http.Response> put(String path, Map<String, dynamic> body) async {
    final token = await getToken();
    final url = Uri.parse('$baseUrl$path');
    try {
      final response = await _client
          .put(
            url,
            headers: _buildHeaders(token),
            body: json.encode(body),
          )
          .timeout(const Duration(seconds: 12));
      _checkUnauthorized(response);
      return response;
    } catch (e) {
      throw Exception('Network error connecting to $url. Check connection or server status.');
    }
  }

  void _checkUnauthorized(http.Response response) {
    if (response.statusCode == 401) {
      clearToken();
    }
  }
}
