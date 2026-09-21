import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/core/ai/function_catalog.dart';
import 'package:proyecto_software1_mobile/core/ai/local_ai_engine.dart';
import 'package:proyecto_software1_mobile/core/ai/local_model_runtime.dart';

class FakeRuntime extends LocalModelRuntime {
  FakeRuntime({required this.isReady, this.result})
    : super(adapter: _UnusedAdapter());

  final bool isReady;
  final LocalInferenceResult? result;

  @override
  bool get ready => isReady;

  @override
  Future<LocalInferenceResult> infer(
    String prompt, {
    String? diagramContext,
  }) async => result!;
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

void main() {
  final engine = LocalAiEngine();

  test('answers basic conversational help completely offline', () {
    final result = engine.respond('¿Qué puedes hacer sin internet?');

    expect(result.requiresCloud, isFalse);
    expect(result.message.toLowerCase(), contains('clase'));
    expect(result.engine, AiEngine.fallback);
  });

  test('extracts a local create-class command', () {
    final result = engine.respond('Crea una clase Cliente');

    expect(result.requiresCloud, isFalse);
    expect(result.command?.type, LocalCommandType.createClass);
    expect(result.command?.arguments['name'], 'Cliente');
  });

  test('routes complex architecture generation to cloud AI', () {
    final result = engine.respond(
      'Diseña toda la arquitectura y genera el backend Spring Boot',
    );

    expect(result.requiresCloud, isTrue);
    expect(result.command, isNull);
    expect(result.engine, AiEngine.cloud);
  });

  test('uses installed FunctionGemma and attributes the response', () async {
    final engine = LocalAiEngine(
      runtime: FakeRuntime(
        isReady: true,
        result: const LocalInferenceResult(
          engine: AiEngine.functionGemma,
          message: 'Clase preparada por el modelo local.',
          command: LocalCommand(LocalCommandType.createClass, {
            'name': 'Pedido',
          }),
        ),
      ),
    );

    final result = await engine.respondHybrid('Crea una clase Pedido');

    expect(result.engine, AiEngine.functionGemma);
    expect(result.command?.arguments['name'], 'Pedido');
  });

  test('falls back honestly when FunctionGemma is not installed', () async {
    final engine = LocalAiEngine(runtime: FakeRuntime(isReady: false));

    final result = await engine.respondHybrid('Crea una clase Cliente');

    expect(result.engine, AiEngine.fallback);
    expect(result.command?.type, LocalCommandType.createClass);
  });
}
