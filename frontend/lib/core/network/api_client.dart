import 'dart:async';
import 'dart:convert';
import 'dart:io';
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
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<http.Response> get(String path) async {
    final token = await getToken();
    final url = Uri.parse('$baseUrl$path');
    try {
      final response = await _client
          .get(url, headers: _buildHeaders(token))
          .timeout(const Duration(seconds: 15));
      _checkUnauthorized(response);
      return response;
    } on TimeoutException {
      throw Exception('Request timed out connecting to server. Check your internet connection.');
    } on SocketException catch (e) {
      throw Exception('Cannot reach server at $baseUrl. Network error: ${e.message}');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Connection error: $e');
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
          .timeout(const Duration(seconds: 15));
      _checkUnauthorized(response);
      return response;
    } on TimeoutException {
      throw Exception('Request timed out connecting to server. Check your internet connection.');
    } on SocketException catch (e) {
      throw Exception('Cannot reach server at $baseUrl. Network error: ${e.message}');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Connection error: $e');
    }
  }

  Future<http.Response> delete(String path) async {
    final token = await getToken();
    final url = Uri.parse('$baseUrl$path');
    try {
      final response = await _client
          .delete(url, headers: _buildHeaders(token))
          .timeout(const Duration(seconds: 15));
      _checkUnauthorized(response);
      return response;
    } on TimeoutException {
      throw Exception('Request timed out connecting to server. Check your internet connection.');
    } on SocketException catch (e) {
      throw Exception('Cannot reach server at $baseUrl. Network error: ${e.message}');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Connection error: $e');
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
          .timeout(const Duration(seconds: 15));
      _checkUnauthorized(response);
      return response;
    } on TimeoutException {
      throw Exception('Request timed out connecting to server. Check your internet connection.');
    } on SocketException catch (e) {
      throw Exception('Cannot reach server at $baseUrl. Network error: ${e.message}');
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Connection error: $e');
    }
  }

  void _checkUnauthorized(http.Response response) {
    if (response.statusCode == 401) {
      clearToken();
    }
  }
}
