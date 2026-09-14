import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/models.dart';

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  String baseUrl;
  String? token;
  final http.Client _client;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _headers,
      body: jsonEncode({'email': email.trim().toLowerCase(), 'password': password}),
    );
    return _decode(response);
  }

  Future<List<WorkspaceModel>> getWorkspaces() async {
    final response = await _client.get(Uri.parse('$baseUrl/workspaces'), headers: _headers);
    final data = _decode(response);
    return [
      ...(data['owned'] as List? ?? const []).map((item) =>
          WorkspaceModel.fromJson(Map<String, dynamic>.from(item as Map), fallbackRole: 'OWNER')),
      ...(data['collaborated'] as List? ?? const []).map((item) {
        final map = Map<String, dynamic>.from(item as Map);
        final collaborators = map['collaborators'] as List? ?? const [];
        final role = collaborators.isEmpty
            ? 'VIEWER'
            : (collaborators.first as Map)['role'] as String? ?? 'VIEWER';
        return WorkspaceModel.fromJson(map, fallbackRole: role);
      }),
    ];
  }

  Future<WorkspaceModel> getWorkspace(String id) async {
    final response = await _client.get(Uri.parse('$baseUrl/workspaces/$id'), headers: _headers);
    return WorkspaceModel.fromJson(_decode(response));
  }

  Future<DiagramModel> getDiagram(String id) async {
    final response = await _client.get(Uri.parse('$baseUrl/diagrams/$id'), headers: _headers);
    return DiagramModel.fromJson(_decode(response));
  }

  Future<DiagramModel> updateDiagram(String id, Map<String, dynamic> data) async {
    final response = await _client.put(
      Uri.parse('$baseUrl/diagrams/$id'),
      headers: _headers,
      body: jsonEncode({'data': data}),
    );
    return DiagramModel.fromJson(_decode(response));
  }

  Future<Map<String, dynamic>> applyDiagramOperation({
    required String diagramId,
    required String deviceId,
    required int clientSequence,
    required int baseVersion,
    required Map<String, dynamic> baseData,
    required Map<String, dynamic> data,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/diagrams/$diagramId/operations'),
      headers: _headers,
      body: jsonEncode({
        'deviceId': deviceId,
        'clientSequence': clientSequence,
        'baseVersion': baseVersion,
        'baseData': baseData,
        'changes': {'type': 'full_update', 'data': data},
      }),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> chat(String diagramId, String message) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/ai-chat/chat'),
      headers: _headers,
      body: jsonEncode({'diagramId': diagramId, 'message': message}),
    );
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map ? decoded['message'] : null;
      throw ApiException(message?.toString() ?? 'Error ${response.statusCode}', response.statusCode);
    }
    return Map<String, dynamic>.from(decoded as Map);
  }
}
