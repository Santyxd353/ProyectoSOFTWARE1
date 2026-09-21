import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/core/ai/function_catalog.dart';
import 'package:proyecto_software1_mobile/core/ai/local_model_runtime.dart';

class FakeLocalModelAdapter implements LocalModelAdapter {
  FakeLocalModelAdapter({this.installed = false, this.response});

  bool installed;
  RawModelResponse? response;
  bool unloaded = false;

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasInstalledModel() async => installed;

  @override
  Future<void> installFile(
    String path,
    void Function(double) onProgress,
  ) async {
    installed = true;
    onProgress(1);
  }

  @override
  Future<RawModelResponse> infer(
    String prompt, {
    required List<ModelToolDefinition> tools,
  }) async => response ?? const RawModelResponse.text('Respuesta local');

  @override
  Future<void> unload() async => unloaded = true;

  @override
  Future<void> uninstall() async => installed = false;
}

void main() {
  test('reports unavailable when no on-device model is installed', () async {
    final runtime = LocalModelRuntime(adapter: FakeLocalModelAdapter());

    await runtime.start();

    expect(runtime.status, LocalModelStatus.unavailable);
    expect(runtime.ready, isFalse);
  });

  test('verifies checksum before installing a local task model', () async {
    final file = File(
      '${Directory.systemTemp.path}/function-gemma-test-${DateTime.now().microsecondsSinceEpoch}.task',
    );
    await file.writeAsString('verified model');
    addTearDown(() => file.delete());
    final adapter = FakeLocalModelAdapter();
    final runtime = LocalModelRuntime(adapter: adapter);

    await expectLater(
      runtime.installFromFile(file.path, expectedSha256: 'bad-checksum'),
      throwsA(isA<ModelIntegrityException>()),
    );
    expect(adapter.installed, isFalse);

    await runtime.installFromFile(
      file.path,
      expectedSha256:
          '6c736b3dfa943bf4e7c61df78d1dfcad9a3d8b56369f0559670497b19127e74d',
    );
    expect(runtime.status, LocalModelStatus.ready);
  });

  test(
    'validates FunctionGemma tool calls before returning a command',
    () async {
      final adapter = FakeLocalModelAdapter(
        installed: true,
        response: const RawModelResponse.tool(
          ModelToolCall('create_class', {'name': 'Factura'}),
        ),
      );
      final runtime = LocalModelRuntime(adapter: adapter);
      await runtime.start();

      final result = await runtime.infer('Crea Factura');

      expect(result.engine, AiEngine.functionGemma);
      expect(result.command?.arguments['name'], 'Factura');
    },
  );

  test('does not execute unsupported model tools', () async {
    final adapter = FakeLocalModelAdapter(
      installed: true,
      response: const RawModelResponse.tool(ModelToolCall('run_shell', {})),
    );
    final runtime = LocalModelRuntime(adapter: adapter);
    await runtime.start();

    await expectLater(
      runtime.infer('haz algo'),
      throwsA(isA<ToolValidationException>()),
    );
  });

  test('surfaces destructive calls as confirmation-required', () async {
    final adapter = FakeLocalModelAdapter(
      installed: true,
      response: const RawModelResponse.tool(
        ModelToolCall('delete_class', {'classId': 'class-1'}),
      ),
    );
    final runtime = LocalModelRuntime(adapter: adapter);
    await runtime.start();

    final result = await runtime.infer('elimina la clase');

    expect(result.requiresConfirmation, isTrue);
    expect(result.command?.type, LocalCommandType.deleteClass);
    expect(result.command?.arguments['classId'], 'class-1');
  });

  test('unloads the active model explicitly', () async {
    final adapter = FakeLocalModelAdapter(installed: true);
    final runtime = LocalModelRuntime(adapter: adapter);
    await runtime.start();

    await runtime.unload();

    expect(adapter.unloaded, isTrue);
    expect(runtime.status, LocalModelStatus.unavailable);
  });
}
