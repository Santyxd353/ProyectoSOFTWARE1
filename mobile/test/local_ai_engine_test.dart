import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/core/ai/local_ai_engine.dart';

void main() {
  final engine = LocalAiEngine();

  test('answers basic conversational help completely offline', () {
    final result = engine.respond('¿Qué puedes hacer sin internet?');

    expect(result.requiresCloud, isFalse);
    expect(result.message.toLowerCase(), contains('clase'));
  });

  test('extracts a local create-class command', () {
    final result = engine.respond('Crea una clase Cliente');

    expect(result.requiresCloud, isFalse);
    expect(result.command?.type, LocalCommandType.createClass);
    expect(result.command?.arguments['name'], 'Cliente');
  });

  test('routes complex architecture generation to cloud AI', () {
    final result = engine.respond('Diseña toda la arquitectura y genera el backend Spring Boot');

    expect(result.requiresCloud, isTrue);
    expect(result.command, isNull);
  });
}
