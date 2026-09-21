import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/app_controller.dart';
import 'package:proyecto_software1_mobile/core/ai/function_catalog.dart';
import 'package:proyecto_software1_mobile/core/ai/local_ai_engine.dart';
import 'package:proyecto_software1_mobile/core/ai/local_model_runtime.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';
import 'package:proyecto_software1_mobile/core/storage/local_store.dart';
import 'package:proyecto_software1_mobile/core/sync/sync_queue.dart';

class _DeleteRuntime extends LocalModelRuntime {
  _DeleteRuntime() : super(adapter: _UnusedAdapter());

  @override
  bool get ready => true;

  @override
  Future<LocalInferenceResult> infer(
    String prompt, {
    String? diagramContext,
  }) async => const LocalInferenceResult(
    engine: AiEngine.functionGemma,
    message: 'La eliminación requiere confirmación.',
    command: LocalCommand(LocalCommandType.deleteClass, {'classId': 'class-1'}),
    requiresConfirmation: true,
  );
}

class _UnusedAdapter implements LocalModelAdapter {
  @override
  Future<bool> hasInstalledModel() async => false;
  @override
  Future<void> initialize() async {}
  @override
  Future<void> installFile(
    String path,
    void Function(double) onProgress,
  ) async {}
  @override
  Future<RawModelResponse> infer(
    String prompt, {
    required List<ModelToolDefinition> tools,
  }) async => const RawModelResponse.text('');
  @override
  Future<void> unload() async {}
  @override
  Future<void> uninstall() async {}
}

class _MemoryStore extends LocalStore {
  List<SyncOperation> queue = [];

  @override
  Future<void> saveQueue(List<SyncOperation> operations) async {
    queue = List.of(operations);
  }

  @override
  Future<List<SyncOperation>> readQueue() async => List.of(queue);

  @override
  Future<void> saveJson(String key, Map<String, dynamic> value) async {}

  @override
  Future<String> readOrCreateDeviceId() async => 'test-device';

  @override
  Future<int> nextClientSequence() async => 1;
}

void main() {
  test(
    'destructive AI action changes nothing until explicit confirmation',
    () async {
      final store = _MemoryStore();
      final controller =
          AppController(
              store: store,
              localAi: LocalAiEngine(runtime: _DeleteRuntime()),
            )
            ..activeWorkspace = const WorkspaceModel(
              id: 'workspace-1',
              name: 'Proyecto',
              role: 'OWNER',
            )
            ..activeDiagram = const DiagramModel(
              id: 'diagram-1',
              name: 'Modelo',
              version: 1,
              data: {
                'classes': [
                  {'id': 'class-1', 'name': 'Cliente'},
                ],
                'relations': [
                  {
                    'id': 'relation-1',
                    'source': 'class-1',
                    'target': 'class-2',
                  },
                ],
              },
            );

      final proposal = await controller.askAi('Elimina la clase Cliente');

      expect(proposal.requiresConfirmation, isTrue);
      expect(controller.activeDiagram!.data['classes'], hasLength(1));
      expect(store.queue, isEmpty);

      final applied = await controller.confirmPendingAiCommand();

      expect(applied.localCommandApplied, isTrue);
      expect(controller.activeDiagram!.data['classes'], isEmpty);
      expect(controller.activeDiagram!.data['relations'], isEmpty);
      expect(store.queue, hasLength(1));
    },
  );
}
