import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';

void main() {
  test(
    'account and project lifecycle use the documented REST contracts',
    () async {
      final calls = <http.Request>[];
      final api = ApiClient(
        baseUrl: 'http://localhost:3002/api',
        client: MockClient((request) async {
          calls.add(request);
          final path = request.url.path;
          if (path.endsWith('/auth/register')) {
            return http.Response(
              jsonEncode({
                'token': 'jwt',
                'user': {
                  'id': 'u1',
                  'name': 'Felix',
                  'email': 'felix@test.com',
                },
              }),
              201,
            );
          }
          if (path.endsWith('/auth/profile')) {
            return http.Response(
              jsonEncode({
                'id': 'u1',
                'name': 'Felix',
                'email': 'felix@test.com',
              }),
              200,
            );
          }
          if (path.endsWith('/workspaces') && request.method == 'POST') {
            return http.Response(
              jsonEncode({
                'id': 'w1',
                'name': 'Ventas',
                'description': 'Móvil',
              }),
              201,
            );
          }
          if (path.endsWith('/workspaces/w1') && request.method == 'PATCH') {
            return http.Response(
              jsonEncode({
                'id': 'w1',
                'name': 'Ventas 2',
                'description': 'Actualizado',
              }),
              200,
            );
          }
          if (path.endsWith('/workspaces/w1/members')) {
            return http.Response(
              jsonEncode({
                'workspaceId': 'w1',
                'currentUserRole': 'OWNER',
                'allowViewerComments': false,
                'members': [],
              }),
              200,
            );
          }
          if (path.endsWith('/workspaces/w1/invitations')) {
            return http.Response(
              jsonEncode([
                {
                  'id': 'i1',
                  'workspaceId': 'w1',
                  'email': null,
                  'role': 'VIEWER',
                  'status': 'PENDING',
                  'expiresAt': '2026-09-27T00:00:00.000Z',
                },
              ]),
              200,
            );
          }
          if (path.endsWith('/workspaces/w1/members/m1')) {
            return http.Response(
              jsonEncode({
                'id': 'm1',
                'userId': 'u2',
                'role': 'EDITOR',
                'user': {'id': 'u2', 'name': 'Ana', 'email': 'ana@test.com'},
              }),
              200,
            );
          }
          throw StateError('${request.method} $path');
        }),
      )..token = 'jwt';

      final registration = await api.register(
        'Felix',
        ' FELIX@test.com ',
        'password123',
      );
      final profile = await api.getProfile();
      final created = await api.createWorkspace('Ventas', 'Móvil');
      final updated = await api.updateWorkspace(
        'w1',
        name: 'Ventas 2',
        description: 'Actualizado',
      );
      final members = await api.getWorkspaceMembers('w1');
      final invitations = await api.getWorkspaceInvitations('w1');
      final promoted = await api.updateMemberRole(
        'w1',
        'm1',
        WorkspaceRole.editor,
      );

      expect(registration['token'], 'jwt');
      expect(profile.name, 'Felix');
      expect(created.id, 'w1');
      expect(updated.name, 'Ventas 2');
      expect(members.currentUserRole, WorkspaceRole.owner);
      expect(invitations.single.email, isNull);
      expect(promoted.role, WorkspaceRole.editor);
      expect(jsonDecode(calls[0].body), {
        'name': 'Felix',
        'email': 'felix@test.com',
        'password': 'password123',
      });
      expect(
        calls.map((call) => '${call.method} ${call.url.path}'),
        containsAll([
          'GET /api/auth/profile',
          'POST /api/workspaces',
          'PATCH /api/workspaces/w1',
          'GET /api/workspaces/w1/members',
          'GET /api/workspaces/w1/invitations',
          'PATCH /api/workspaces/w1/members/m1',
        ]),
      );
    },
  );

  test(
    'diagram lifecycle uses create, archive, and restore endpoints',
    () async {
      final calls = <String>[];
      final api = ApiClient(
        baseUrl: 'http://localhost:3002/api',
        client: MockClient((request) async {
          calls.add('${request.method} ${request.url.path}');
          return http.Response(
            jsonEncode({
              'id': 'd1',
              'name': 'Dominio',
              'version': 1,
              'archivedAt': request.url.path.endsWith('/archive')
                  ? '2026-09-20T00:00:00.000Z'
                  : null,
              'data': {'classes': [], 'relations': []},
            }),
            request.method == 'POST' && request.url.path.endsWith('/diagrams')
                ? 201
                : 200,
          );
        }),
      );

      final created = await api.createDiagram('w1', 'Dominio');
      final archived = await api.archiveDiagram('d1');
      final restored = await api.restoreDiagram('d1');

      expect(created.name, 'Dominio');
      expect(archived.archived, isTrue);
      expect(restored.archived, isFalse);
      expect(calls, [
        'POST /api/diagrams',
        'POST /api/diagrams/d1/archive',
        'POST /api/diagrams/d1/restore',
      ]);
    },
  );

  test('server roles are the source of mobile capabilities', () {
    expect(WorkspaceRole.owner.canManageMembers, isTrue);
    expect(WorkspaceRole.editor.canEditDiagrams, isTrue);
    expect(WorkspaceRole.viewer.canEditDiagrams, isFalse);
    expect(WorkspaceRole.viewer.canManageMembers, isFalse);
  });
}
