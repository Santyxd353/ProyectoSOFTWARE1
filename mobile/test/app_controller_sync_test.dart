import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/app_controller.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';
import 'package:proyecto_software1_mobile/core/storage/local_store.dart';
import 'package:proyecto_software1_mobile/core/sync/sync_queue.dart';

class RecordingStore extends LocalStore {
  List<SyncOperation> saved = [];
  final Map<String, Map<String, dynamic>> json = {};
  final List<String> writes = [];
  int sequence = 8;

  @override
  Future<void> saveToken(String token) async => writes.add('token');

  @override
  Future<void> saveJsonList(String key, List<dynamic> value) async => writes.add(key);

  @override
  Future<void> saveQueue(List<SyncOperation> operations) async {
    writes.add('queue');
    saved = List.of(operations);
  }

  @override
  Future<String> readOrCreateDeviceId() async => 'android-1';

  @override
  Future<int> nextClientSequence() async => ++sequence;

  @override
  Future<void> saveJson(String key, Map<String, dynamic> value) async {
    writes.add(key);
    json[key] = value;
  }
}

class RecordingApi extends ApiClient {
  RecordingApi(this.response) : super(baseUrl: 'http://local/api');

  final Map<String, dynamic> response;
  final List<Map<String, dynamic>> calls = [];

  @override
  Future<Map<String, dynamic>> login(String email, String password) async => {'token': 'renewed'};

  @override
  Future<List<WorkspaceModel>> getWorkspaces() async => [];

  @override
  Future<UserProfile> getProfile() async => const UserProfile(id: 'user-1', name: 'Felix', email: 'felix@example.com');

  @override
  Future<DiagramModel> updateDiagram(String id, Map<String, dynamic> data) =>
      throw StateError('legacy unversioned write');

  @override
  Future<Map<String, dynamic>> applyDiagramOperation({
    required String diagramId,
    required String deviceId,
    required int clientSequence,
    required int baseVersion,
    required Map<String, dynamic> baseData,
    required Map<String, dynamic> data,
  }) async {
    calls.add({
      'diagramId': diagramId,
      'deviceId': deviceId,
      'clientSequence': clientSequence,
      'baseVersion': baseVersion,
      'baseData': baseData,
      'data': data,
    });
    return response;
  }
}

const queued = SyncOperation(
  id: 'op-1',
  entityId: 'diagram-1',
  deviceId: 'android-1',
  clientSequence: 8,
  baseVersion: 3,
  baseData: {'classes': []},
  payload: {
    'classes': [
      {'id': 'class-1'},
    ],
  },
);

void main() {
  test('replays pending edits after interactive login restores a valid session', () async {
    final store = RecordingStore();
    final api = RecordingApi({'status': 'APPLIED', 'version': 4});
    final controller = AppController(store: store, apiClient: api)
      ..online = true
      ..pendingOperations = [queued];

    await controller.login('felix@example.com', 'password');

    expect(api.calls, hasLength(1));
    expect(controller.pendingOperations, isEmpty);
    expect(controller.signedIn, isTrue);
  });

  test('adopts the server snapshot after an automatic merge', () async {
    final merged = {'classes': [{'id': 'remote'}, {'id': 'local'}], 'relations': []};
    final controller = AppController(
      store: RecordingStore(),
      apiClient: RecordingApi({'status': 'APPLIED', 'version': 5, 'autoMerged': true, 'data': merged}),
    )
      ..activeDiagram = const DiagramModel(id: 'diagram-1', name: 'Ventas', version: 3, data: {'classes': []})
      ..pendingOperations = [queued];

    await controller.syncPending();

    expect(controller.activeDiagram!.version, 5);
    expect(controller.activeDiagram!.data, merged);
  });

  test('does not overwrite an optimistic edit with its own REST broadcast', () {
    final controller = AppController(store: RecordingStore(), apiClient: RecordingApi({}))
      ..activeDiagram = const DiagramModel(id: 'diagram-1', name: 'Ventas', version: 4, data: {'classes': [{'id': 'local'}]})
      ..pendingOperations = [queued];
    controller.realtime.onDurableEvent({
      'deviceId': 'android-1', 'version': 5,
      'changes': {'type': 'full_update', 'data': {'classes': [{'id': 'server'}]}},
    });
    expect(controller.activeDiagram!.data, {'classes': [{'id': 'local'}]});
  });

  test(
    'removes an offline operation only after the server applies it',
    () async {
      final store = RecordingStore();
      final api = RecordingApi({
        'status': 'APPLIED',
        'operationId': 'server-op-1',
        'sequence': 4,
        'version': 4,
      });
      final controller = AppController(store: store, apiClient: api)
        ..pendingOperations = [queued];

      await controller.syncPending();

      expect(api.calls.single, {
        'diagramId': 'diagram-1',
        'deviceId': 'android-1',
        'clientSequence': 8,
        'baseVersion': 3,
        'baseData': {'classes': []},
        'data': {
          'classes': [
            {'id': 'class-1'},
          ],
        },
      });
      expect(controller.pendingOperations, isEmpty);
      expect(store.saved, isEmpty);
    },
  );

  test(
    'keeps a conflicting operation queued with an explicit message',
    () async {
      final store = RecordingStore();
      final api = RecordingApi({
        'status': 'CONFLICT',
        'operationId': 'server-op-1',
        'conflictId': 'conflict-1',
        'sequence': 4,
        'version': 4,
      });
      final controller = AppController(store: store, apiClient: api)
        ..pendingOperations = [queued];

      await controller.syncPending();

      expect(controller.pendingOperations.single.id, queued.id);
      expect(controller.pendingOperations.single.attemptCount, 1);
      expect(controller.error, contains('conflict-1'));
    },
  );

  test(
    'saves a connected edit through the same versioned operation contract',
    () async {
      final store = RecordingStore();
      final api = RecordingApi({
        'status': 'APPLIED',
        'operationId': 'server-op-2',
        'sequence': 5,
        'version': 4,
      });
      final controller = AppController(store: store, apiClient: api)
        ..online = true
        ..activeDiagram = const DiagramModel(
          id: 'diagram-1',
          name: 'Ventas',
          version: 3,
          data: {'classes': [], 'relations': []},
        );

      await controller.applyProposal({
        'classes': [
          {'id': 'class-1', 'name': 'Cliente'},
        ],
        'relations': [],
      });

      expect(api.calls.single['deviceId'], 'android-1');
      expect(api.calls.single['clientSequence'], 9);
      expect(api.calls.single['baseVersion'], 3);
      expect(api.calls.single['baseData'], {'classes': [], 'relations': []});
      expect(controller.activeDiagram!.version, 4);
      expect(controller.pendingOperations, isEmpty);
    },
  );

  test('persists the operation before rendering an offline edit', () async {
    final store = RecordingStore();
    final controller = AppController(store: store, apiClient: RecordingApi({}))
      ..online = false
      ..activeWorkspace = const WorkspaceModel(
        id: 'workspace-1',
        name: 'Ventas',
        role: 'EDITOR',
      )
      ..activeDiagram = const DiagramModel(
        id: 'diagram-1',
        name: 'Ventas',
        version: 3,
        data: {'classes': [], 'relations': []},
      );

    await controller.saveDiagramData(const {
      'classes': [
        {'id': 'class-1'},
      ],
      'relations': [],
    });

    expect(store.writes.first, 'queue');
    expect(store.saved, hasLength(1));
    expect(controller.activeDiagram!.data['classes'], hasLength(1));
  });

  test('keeps the confirmed server baseline for consecutive optimistic offline edits', () async {
    final controller = AppController(store: RecordingStore(), apiClient: RecordingApi({}))
      ..online = false
      ..pendingOperations = [queued]
      ..activeWorkspace = const WorkspaceModel(id: 'workspace-1', name: 'Ventas', role: 'EDITOR')
      ..activeDiagram = const DiagramModel(
        id: 'diagram-1', name: 'Ventas', version: 4,
        data: {'classes': [{'id': 'class-1'}], 'relations': []},
      );
    await controller.saveDiagramData(const {
      'classes': [{'id': 'class-1'}, {'id': 'class-2'}], 'relations': [],
    });
    final later = controller.pendingOperations.last;
    expect(controller.pendingOperations, hasLength(1));
    expect(later.clientSequence, 8);
    expect(later.baseVersion, 3);
    expect(later.baseData, {'classes': []});
    expect(later.payload['classes'], hasLength(2));
  });

  test('coalesces repeated offline changes to the same field into one operation', () async {
    final controller = AppController(store: RecordingStore(), apiClient: RecordingApi({}))
      ..online = false
      ..activeWorkspace = const WorkspaceModel(id: 'workspace-1', name: 'Ventas', role: 'EDITOR')
      ..activeDiagram = const DiagramModel(
        id: 'diagram-1', name: 'Ventas', version: 3,
        data: {'classes': [{'id': 'class-1', 'name': 'Original'}], 'relations': []},
      );

    await controller.saveDiagramData(const {
      'classes': [{'id': 'class-1', 'name': 'Intermedio'}], 'relations': [],
    });
    await controller.saveDiagramData(const {
      'classes': [{'id': 'class-1', 'name': 'Final'}], 'relations': [],
    });

    expect(controller.pendingOperations, hasLength(1));
    expect(controller.pendingOperations.single.baseVersion, 3);
    expect(controller.pendingOperations.single.baseData['classes'], [
      {'id': 'class-1', 'name': 'Original'},
    ]);
    expect(controller.pendingOperations.single.payload['classes'], [
      {'id': 'class-1', 'name': 'Final'},
    ]);
  });
}
