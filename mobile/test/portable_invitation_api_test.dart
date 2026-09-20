import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';

void main() {
  test(
    'creates, claims and revokes portable invitations with documented contracts',
    () async {
      final requests = <http.Request>[];
      final client = MockClient((request) async {
        requests.add(request);
        if (request.url.path.endsWith('/portable')) {
          return http.Response(
            jsonEncode({
              'kind': 'portable',
              'token': 'raw-token',
              'code': 'ABCD1234',
              'url': 'proyectosoftware1://invite?token=raw-token',
              'invitation': {
                'id': 'invite-1',
                'workspaceId': 'workspace-1',
                'role': 'EDITOR',
                'status': 'PENDING',
                'expiresAt': '2026-09-27T12:00:00Z',
              },
            }),
            201,
          );
        }
        if (request.url.path.endsWith('/claim')) {
          return http.Response(
            jsonEncode({
              'alreadyAccepted': false,
              'alreadyMember': false,
              'invitation': {'workspaceId': 'workspace-1'},
            }),
            201,
          );
        }
        return http.Response('{}', 200);
      });
      final api = ApiClient(baseUrl: 'http://host/api', client: client)
        ..token = 'jwt';

      final created = await api.createPortableInvitation(
        'workspace-1',
        role: WorkspaceRole.editor,
        expiresInHours: 48,
        email: 'ana@example.com',
      );
      final claimed = await api.claimPortableInvitation('ABCD-1234');
      await api.revokeInvitation('workspace-1', 'invite-1');

      expect(created.code, 'ABCD1234');
      expect(created.url, startsWith('proyectosoftware1://'));
      expect(claimed.workspaceId, 'workspace-1');
      expect(jsonDecode(requests[0].body), {
        'role': 'EDITOR',
        'expiresInHours': 48,
        'email': 'ana@example.com',
      });
      expect(jsonDecode(requests[1].body), {'secret': 'ABCD-1234'});
      expect(requests[2].method, 'DELETE');
    },
  );
}
