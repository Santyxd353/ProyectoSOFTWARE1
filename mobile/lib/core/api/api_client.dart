import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/models.dart';
import '../models/artifact_models.dart';

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

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
      body: jsonEncode({
        'email': email.trim().toLowerCase(),
        'password': password,
      }),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> register(
    String name,
    String email,
    String password,
  ) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: _headers,
      body: jsonEncode({
        'name': name.trim(),
        'email': email.trim().toLowerCase(),
        'password': password,
      }),
    );
    return _decode(response);
  }

  Future<UserProfile> getProfile() async {
    final response = await _client.get(
      Uri.parse('$baseUrl/auth/profile'),
      headers: _headers,
    );
    return UserProfile.fromJson(_decode(response));
  }

  Future<List<WorkspaceModel>> getWorkspaces() async {
    final response = await _client.get(
      Uri.parse('$baseUrl/workspaces'),
      headers: _headers,
    );
    final data = _decode(response);
    return [
      ...(data['owned'] as List? ?? const []).map(
        (item) => WorkspaceModel.fromJson(
          Map<String, dynamic>.from(item as Map),
          fallbackRole: 'OWNER',
        ),
      ),
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
    final response = await _client.get(
      Uri.parse('$baseUrl/workspaces/$id'),
      headers: _headers,
    );
    return WorkspaceModel.fromJson(_decode(response));
  }

  Future<WorkspaceModel> createWorkspace(
    String name,
    String description,
  ) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/workspaces'),
      headers: _headers,
      body: jsonEncode({
        'name': name.trim(),
        'description': description.trim(),
      }),
    );
    return WorkspaceModel.fromJson(_decode(response), fallbackRole: 'OWNER');
  }

  Future<WorkspaceModel> updateWorkspace(
    String id, {
    String? name,
    String? description,
  }) async {
    final response = await _client.patch(
      Uri.parse('$baseUrl/workspaces/$id'),
      headers: _headers,
      body: jsonEncode({
        if (name != null) 'name': name.trim(),
        if (description != null) 'description': description.trim(),
      }),
    );
    return WorkspaceModel.fromJson(_decode(response), fallbackRole: 'OWNER');
  }

  Future<WorkspaceMembersModel> getWorkspaceMembers(String id) async {
    final response = await _client.get(
      Uri.parse('$baseUrl/workspaces/$id/members'),
      headers: _headers,
    );
    return WorkspaceMembersModel.fromJson(_decode(response));
  }

  Future<List<WorkspaceInvitationModel>> getWorkspaceInvitations(
    String id,
  ) async {
    final response = await _client.get(
      Uri.parse('$baseUrl/workspaces/$id/invitations'),
      headers: _headers,
    );
    return _decodeList(response)
        .map(
          (item) => WorkspaceInvitationModel.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<PortableInvitationModel> createPortableInvitation(
    String workspaceId, {
    required WorkspaceRole role,
    int expiresInHours = 168,
    String? email,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/workspaces/$workspaceId/invitations/portable'),
      headers: _headers,
      body: jsonEncode({
        'role': role.wire,
        'expiresInHours': expiresInHours,
        if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      }),
    );
    return PortableInvitationModel.fromJson(_decode(response));
  }

  Future<ClaimedInvitationModel> claimPortableInvitation(String secret) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/workspaces/invitations/claim'),
      headers: _headers,
      body: jsonEncode({'secret': secret.trim()}),
    );
    return ClaimedInvitationModel.fromJson(_decode(response));
  }

  Future<void> revokeInvitation(String workspaceId, String invitationId) async {
    final response = await _client.delete(
      Uri.parse('$baseUrl/workspaces/$workspaceId/invitations/$invitationId'),
      headers: _headers,
    );
    _decode(response);
  }

  Future<WorkspaceMemberModel> updateMemberRole(
    String workspaceId,
    String memberId,
    WorkspaceRole role,
  ) async {
    final response = await _client.patch(
      Uri.parse('$baseUrl/workspaces/$workspaceId/members/$memberId'),
      headers: _headers,
      body: jsonEncode({'role': role.wire}),
    );
    return WorkspaceMemberModel.fromJson(_decode(response));
  }

  Future<void> removeMember(String workspaceId, String memberId) async {
    final response = await _client.delete(
      Uri.parse('$baseUrl/workspaces/$workspaceId/members/$memberId'),
      headers: _headers,
    );
    _decode(response);
  }

  Future<DiagramModel> getDiagram(String id) async {
    final response = await _client.get(
      Uri.parse('$baseUrl/diagrams/$id'),
      headers: _headers,
    );
    return DiagramModel.fromJson(_decode(response));
  }

  Future<DiagramModel> createDiagram(String workspaceId, String name) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/diagrams'),
      headers: _headers,
      body: jsonEncode({'workspaceId': workspaceId, 'name': name.trim()}),
    );
    return DiagramModel.fromJson(_decode(response));
  }

  Future<DiagramModel> archiveDiagram(String id) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/diagrams/$id/archive'),
      headers: _headers,
    );
    return DiagramModel.fromJson(_decode(response));
  }

  Future<DiagramModel> restoreDiagram(String id) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/diagrams/$id/restore'),
      headers: _headers,
    );
    return DiagramModel.fromJson(_decode(response));
  }

  Future<DiagramModel> updateDiagram(
    String id,
    Map<String, dynamic> data,
  ) async {
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

  Future<List<SyncConflict>> getDiagramConflicts(String diagramId) async {
    final response = await _client.get(
      Uri.parse('$baseUrl/diagrams/$diagramId/conflicts'),
      headers: _headers,
    );
    return _decodeList(response)
        .map(
          (item) =>
              SyncConflict.fromJson(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<Map<String, dynamic>> resolveDiagramConflict(
    String conflictId,
    Map<String, dynamic> resolution,
  ) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/diagrams/conflicts/$conflictId/resolve'),
      headers: _headers,
      body: jsonEncode({'resolution': resolution}),
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

  Future<GeneratedProjectResult> generateProject(
    String diagramId,
    GeneratedProjectType type,
  ) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/code-generation/${type.endpoint}/$diagramId'),
      headers: _headers,
      body: '{}',
    );
    return GeneratedProjectResult.fromJson(_decode(response));
  }

  Future<List<RevisionSummaryModel>> listRevisions(
    String workspaceId, {
    String? diagramId,
  }) async {
    final uri = Uri.parse('$baseUrl/workspaces/$workspaceId/revisions').replace(
      queryParameters: diagramId == null ? null : {'diagramId': diagramId},
    );
    final response = await _client.get(uri, headers: _headers);
    return _decodeList(response)
        .map(
          (item) => RevisionSummaryModel.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<List<RevisionFileModel>> getRevisionTree(
    String workspaceId,
    String revisionId,
  ) async {
    final response = await _client.get(
      Uri.parse('$baseUrl/workspaces/$workspaceId/revisions/$revisionId/tree'),
      headers: _headers,
    );
    return _decodeList(response)
        .map(
          (item) => RevisionFileModel.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<RevisionFileModel> readRevisionFile(
    String workspaceId,
    String revisionId,
    String fileId,
  ) async {
    final response = await _client.get(
      Uri.parse(
        '$baseUrl/workspaces/$workspaceId/revisions/$revisionId/files/$fileId',
      ),
      headers: _headers,
    );
    return RevisionFileModel.fromJson(_decode(response));
  }

  Future<List<ReviewCommentModel>> listRevisionComments(
    String workspaceId,
    String revisionId, {
    String? fileId,
  }) async {
    final uri = Uri.parse(
      '$baseUrl/workspaces/$workspaceId/revisions/$revisionId/comments',
    ).replace(queryParameters: fileId == null ? null : {'fileId': fileId});
    final response = await _client.get(uri, headers: _headers);
    return _decodeList(response)
        .map(
          (item) => ReviewCommentModel.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  Future<ReviewCommentModel> createRevisionComment(
    String workspaceId,
    String revisionId, {
    required String fileId,
    int? line,
    required String body,
  }) async {
    final response = await _client.post(
      Uri.parse(
        '$baseUrl/workspaces/$workspaceId/revisions/$revisionId/comments',
      ),
      headers: _headers,
      body: jsonEncode({'fileId': fileId, 'line': ?line, 'body': body}),
    );
    return ReviewCommentModel.fromJson(_decode(response));
  }

  Future<RevisionComparisonModel> compareRevisions(
    String workspaceId,
    String baseRevisionId,
    String targetRevisionId, {
    String? fileId,
  }) async {
    final uri = Uri.parse('$baseUrl/workspaces/$workspaceId/revisions/compare')
        .replace(
          queryParameters: {
            'base': baseRevisionId,
            'target': targetRevisionId,
            'fileId': ?fileId,
          },
        );
    final response = await _client.get(uri, headers: _headers);
    return RevisionComparisonModel.fromJson(_decode(response));
  }

  Future<RevisionSummaryModel> restoreRevision(
    String workspaceId,
    String revisionId,
  ) async {
    final response = await _client.post(
      Uri.parse(
        '$baseUrl/workspaces/$workspaceId/revisions/$revisionId/restore',
      ),
      headers: _headers,
      body: '{}',
    );
    return RevisionSummaryModel.fromJson(_decode(response));
  }

  Future<DownloadedFile> downloadGeneratedProject(String generatedCodeId) =>
      _download('$baseUrl/code-generation/download/$generatedCodeId');

  Future<DownloadedFile> downloadRevision(
    String workspaceId,
    String revisionId,
  ) => _download(
    '$baseUrl/workspaces/$workspaceId/revisions/$revisionId/download',
  );

  Future<DownloadedFile> exportDiagram(
    String diagramId,
    InterchangeFormat format,
  ) => _download('$baseUrl/diagrams/$diagramId/export/${format.name}');

  Future<ImportPreviewModel> previewDiagramImport({
    required String workspaceId,
    required String name,
    required InterchangeFormat format,
    required String content,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/diagrams/import/preview'),
      headers: _headers,
      body: jsonEncode({
        'workspaceId': workspaceId,
        'name': name,
        'format': format.name,
        'content': content,
      }),
    );
    return ImportPreviewModel.fromJson(_decode(response));
  }

  Future<DiagramModel> confirmDiagramImport(String token) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/diagrams/import/confirm'),
      headers: _headers,
      body: jsonEncode({'token': token}),
    );
    return DiagramModel.fromJson(_decode(response));
  }

  Future<DownloadedFile> _download(String url) async {
    final response = await _client.get(Uri.parse(url), headers: _headers);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _decode(response);
    }
    final disposition = response.headers['content-disposition'] ?? '';
    final match = RegExp(r'filename="?([^";]+)').firstMatch(disposition);
    return DownloadedFile(
      filename: match?.group(1) ?? 'artifact.bin',
      contentType:
          response.headers['content-type'] ?? 'application/octet-stream',
      bytes: response.bodyBytes,
    );
  }

  Map<String, dynamic> _decode(http.Response response) {
    final decoded = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map ? decoded['message'] : null;
      throw ApiException(
        message?.toString() ?? 'Error ${response.statusCode}',
        response.statusCode,
      );
    }
    return Map<String, dynamic>.from(decoded as Map);
  }

  List<dynamic> _decodeList(http.Response response) {
    final decoded = response.body.isEmpty
        ? <dynamic>[]
        : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map ? decoded['message'] : null;
      throw ApiException(
        message?.toString() ?? 'Error ${response.statusCode}',
        response.statusCode,
      );
    }
    return List<dynamic>.from(decoded as List);
  }
}
