import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/core/ai/function_catalog.dart';
import 'package:proyecto_software1_mobile/core/ai/local_ai_engine.dart';

void main() {
  final catalog = FunctionCatalog.standard();

  test('validates a supported diagram tool and maps it to a command', () {
    final call = catalog.validate(
      const ModelToolCall('create_class', {'name': 'Cliente'}),
    );

    expect(call.command.type, LocalCommandType.createClass);
    expect(call.command.arguments['name'], 'Cliente');
  });

  test('rejects unknown tools and malformed arguments', () {
    expect(
      () => catalog.validate(const ModelToolCall('run_shell', {})),
      throwsA(isA<ToolValidationException>()),
    );
    expect(
      () => catalog.validate(const ModelToolCall('create_class', {})),
      throwsA(isA<ToolValidationException>()),
    );
    expect(
      () => catalog.validate(const ModelToolCall('create_class', {'name': 12})),
      throwsA(isA<ToolValidationException>()),
    );
    expect(
      () => catalog.validate(
        const ModelToolCall('create_class', {
          'name': 'Cliente',
          'unexpected': true,
        }),
      ),
      throwsA(isA<ToolValidationException>()),
    );
  });

  test('requires explicit confirmation for destructive tools', () {
    const call = ModelToolCall('delete_class', {'classId': 'class-1'});

    expect(
      () => catalog.validate(call),
      throwsA(
        isA<ToolConfirmationRequired>().having(
          (error) => error.toolName,
          'toolName',
          'delete_class',
        ),
      ),
    );
    expect(
      catalog.validate(call, allowDestructive: true).command.type,
      LocalCommandType.deleteClass,
    );
  });
}
