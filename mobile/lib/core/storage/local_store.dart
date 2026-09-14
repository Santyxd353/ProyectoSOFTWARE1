import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../sync/sync_queue.dart';

class LocalStore {
  LocalStore({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _secureStorage;
  static const _queueKey = 'offline_sync_queue';
  static const _tokenKey = 'session_token';
  static const _apiUrlKey = 'api_url';

  Future<void> saveJson(String key, Map<String, dynamic> value) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(key, jsonEncode(value));
  }

  Future<Map<String, dynamic>?> readJson(String key) async {
    final preferences = await SharedPreferences.getInstance();
    final encoded = preferences.getString(key);
    if (encoded == null) return null;
    return Map<String, dynamic>.from(jsonDecode(encoded) as Map);
  }

  Future<void> saveJsonList(String key, List<dynamic> value) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(key, jsonEncode(value));
  }

  Future<List<dynamic>> readJsonList(String key) async {
    final preferences = await SharedPreferences.getInstance();
    final encoded = preferences.getString(key);
    if (encoded == null) return [];
    return List<dynamic>.from(jsonDecode(encoded) as List);
  }

  Future<void> saveQueue(List<SyncOperation> operations) =>
      saveJsonList(_queueKey, operations.map((item) => item.toJson()).toList());

  Future<List<SyncOperation>> readQueue() async => (await readJsonList(_queueKey))
      .map((item) => SyncOperation.fromJson(Map<String, dynamic>.from(item as Map)))
      .toList();

  Future<void> saveToken(String token) => _secureStorage.write(key: _tokenKey, value: token);
  Future<String?> readToken() => _secureStorage.read(key: _tokenKey);
  Future<void> clearToken() => _secureStorage.delete(key: _tokenKey);

  Future<void> saveApiUrl(String value) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_apiUrlKey, value);
  }

  Future<String> readApiUrl() async {
    final preferences = await SharedPreferences.getInstance();
    return preferences.getString(_apiUrlKey) ?? 'http://10.0.2.2:3002/api';
  }
}
