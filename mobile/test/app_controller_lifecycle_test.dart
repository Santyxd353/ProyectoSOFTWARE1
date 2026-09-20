import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/app_controller.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';
import 'package:proyecto_software1_mobile/core/storage/local_store.dart';

class LifecycleStore extends LocalStore {
  String locale = 'es';
  String theme = 'system';

  @override
  Future<void> saveLocale(String value) async => locale = value;
  @override
  Future<String> readLocale() async => locale;
  @override
  Future<void> saveThemeMode(String value) async => theme = value;
  @override
  Future<String> readThemeMode() async => theme;
  @override
  Future<void> saveJson(String key, Map<String, dynamic> value) async {}
  @override
  Future<void> saveJsonList(String key, List<dynamic> value) async {}
}

class LifecycleApi extends ApiClient {
  LifecycleApi() : super(baseUrl: 'http://local/api');

  @override
  Future<WorkspaceModel> createWorkspace(
    String name,
    String description,
  ) async => WorkspaceModel(
    id: 'w1',
    name: name,
    description: description,
    role: 'OWNER',
  );

  @override
  Future<DiagramModel> createDiagram(String workspaceId, String name) async =>
      DiagramModel(
        id: 'd1',
        name: name,
        version: 1,
        data: const {'classes': [], 'relations': []},
      );
}

void main() {
  test('persists language and theme through the controller', () async {
    final store = LifecycleStore();
    final controller = AppController(store: store, apiClient: LifecycleApi());

    await controller.setLocale('en');
    await controller.setThemeMode('dark');

    expect(controller.locale, 'en');
    expect(controller.themeMode, 'dark');
    expect(store.locale, 'en');
    expect(store.theme, 'dark');
  });

  test('creates a project and a diagram for an owner', () async {
    final controller = AppController(
      store: LifecycleStore(),
      apiClient: LifecycleApi(),
    )..online = true;

    final workspace = await controller.createWorkspace('Ventas', 'Móvil');
    controller.activeWorkspace = workspace;
    final diagram = await controller.createDiagram('Dominio');

    expect(controller.workspaces.single.id, 'w1');
    expect(diagram.id, 'd1');
    expect(controller.activeWorkspace!.diagrams.single.id, 'd1');
  });

  test(
    'viewer cannot trigger diagram mutations from stale mobile UI',
    () async {
      final controller =
          AppController(store: LifecycleStore(), apiClient: LifecycleApi())
            ..online = true
            ..activeWorkspace = const WorkspaceModel(
              id: 'w1',
              name: 'Solo lectura',
              role: 'VIEWER',
            );

      await expectLater(
        controller.createDiagram('Bloqueado'),
        throwsA(isA<StateError>()),
      );
    },
  );
}
