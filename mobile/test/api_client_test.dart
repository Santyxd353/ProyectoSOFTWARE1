import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';

void main() {
  test(
    'sends a versioned idempotent offline operation to the sync endpoint',
    () async {
      late http.Request captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'status': 'APPLIED',
            'operationId': 'operation-1',
            'sequence': 9,
            'version': 4,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });
      final api = ApiClient(
        baseUrl: 'http://localhost:3002/api',
        client: client,
      )..token = 'token';

      final result = await api.applyDiagramOperation(
        diagramId: 'diagram-1',
        deviceId: 'android-xr',
        clientSequence: 11,
        baseVersion: 3,
        baseData: const {'classes': [], 'relations': []},
        data: const {
          'classes': [
            {'id': 'class-1', 'name': 'Cliente'},
          ],
          'relations': [],
        },
      );

      expect(captured.method, 'POST');
      expect(captured.url.path, '/api/diagrams/diagram-1/operations');
      expect(captured.headers['authorization'], 'Bearer token');
      expect(jsonDecode(captured.body), {
        'deviceId': 'android-xr',
        'clientSequence': 11,
        'baseVersion': 3,
        'baseData': {'classes': [], 'relations': []},
        'changes': {
          'type': 'full_update',
          'data': {
            'classes': [
              {'id': 'class-1', 'name': 'Cliente'},
            ],
            'relations': [],
          },
        },
      });
      expect(result['sequence'], 9);
    },
  );
}
