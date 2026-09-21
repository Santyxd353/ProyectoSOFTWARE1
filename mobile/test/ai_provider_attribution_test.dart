import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/app_controller.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';

class _FallbackApi extends ApiClient {
  _FallbackApi() : super(baseUrl: 'http://local/api');

  @override
  Future<Map<String, dynamic>> chat(String diagramId, String message) async => {
    'response': 'La IA en la nube no está configurada.',
    'mode': 'offline-fallback',
    'provider': 'local',
  };
}

void main() {
  test('labels server offline fallback as fallback, not cloud', () async {
    final controller = AppController(apiClient: _FallbackApi())
      ..online = true
      ..activeDiagram = const DiagramModel(
        id: 'diagram-1',
        name: 'Modelo',
        version: 1,
        data: {'classes': [], 'relations': []},
      );

    final reply = await controller.askAi(
      'Diseña toda la arquitectura y genera el backend Spring Boot',
    );

    expect(reply.engine, 'fallback');
    expect(reply.proposedModel, isNull);
  });
}
