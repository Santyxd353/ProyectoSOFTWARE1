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

  @override
  Future<void> saveQueue(List<SyncOperation> operations) async {
    writes.add('queue');
    saved = List.of(operations);
  }

  @override
  Future<String> readOrCreateDeviceId() async => 'android-1';

  @override
  Future<int> nextClientSequence() async => 9;

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

      expect(controller.pendingOperations, [queued]);
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
}
