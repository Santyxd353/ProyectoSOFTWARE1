import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';

void main() {
  test(
    'lists variants with authorship and resolves an explicit payload',
    () async {
      final requests = <http.Request>[];
      final client = MockClient((request) async {
        requests.add(request);
        if (request.method == 'GET') {
          return http.Response(
            jsonEncode([
              {
                'id': 'conflict-1',
                'diagramId': 'diagram-1',
                'baseVersion': 2,
                'baseData': {'name': 'Base'},
                'localData': {'name': 'Local'},
                'remoteData': {'name': 'Remoto'},
                'operation': {
                  'authorId': 'user-2',
                  'serverSequence': 8,
                  'createdAt': '2026-09-20T12:00:00Z',
                },
              },
            ]),
            200,
          );
        }
        return http.Response(
          jsonEncode({'id': 'conflict-1', 'status': 'RESOLVED'}),
          201,
        );
      });
      final api = ApiClient(baseUrl: 'http://host/api', client: client);

      final conflicts = await api.getDiagramConflicts('diagram-1');
      await api.resolveDiagramConflict('conflict-1', const {
        'name': 'Combinado',
      });

      expect(conflicts.single.authorId, 'user-2');
      expect(conflicts.single.serverSequence, 8);
      expect(
        requests[1].url.path,
        '/api/diagrams/conflicts/conflict-1/resolve',
      );
      expect(jsonDecode(requests[1].body), {
        'resolution': {'name': 'Combinado'},
      });
    },
  );
}
