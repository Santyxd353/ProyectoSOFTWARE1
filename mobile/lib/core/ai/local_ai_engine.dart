import 'local_model_runtime.dart';

export 'ai_types.dart';

class LocalAiResult {
  const LocalAiResult({
    required this.message,
    required this.engine,
    this.command,
    this.requiresCloud = false,
    this.requiresConfirmation = false,
  });

  final String message;
  final AiEngine engine;
  final LocalCommand? command;
  final bool requiresCloud;
  final bool requiresConfirmation;
}

/// Hybrid local assistant. It uses FunctionGemma when installed and clearly
/// identifies the limited deterministic parser used as an offline fallback.
class LocalAiEngine {
  LocalAiEngine({LocalModelRuntime? runtime})
    : runtime = runtime ?? LocalModelRuntime();

  final LocalModelRuntime runtime;

  Future<LocalAiResult> respondHybrid(
    String rawMessage, {
    String? diagramContext,
  }) async {
    final fallback = respond(rawMessage);
    if (fallback.requiresCloud || !runtime.ready) return fallback;
    try {
      final result = await runtime.infer(
        rawMessage,
        diagramContext: diagramContext,
      );
      return LocalAiResult(
        message: result.message,
        engine: result.engine,
        command: result.command,
        requiresConfirmation: result.requiresConfirmation,
      );
    } catch (_) {
      return const LocalAiResult(
        message:
            'FunctionGemma no pudo procesar esta instrucción. El diagrama no cambió; revisa el modelo local o intenta de nuevo.',
        engine: AiEngine.functionGemma,
      );
    }
  }

  LocalAiResult respond(String rawMessage) {
    final message = rawMessage.trim();
    final normalized = _normalize(message);

    if (_cloudScore(normalized) >= 2) {
      return const LocalAiResult(
        message:
            'Esta solicitud requiere la IA avanzada. La enviaré al proveedor en la nube cuando tengas conexión.',
        engine: AiEngine.cloud,
        requiresCloud: true,
      );
    }

    final classMatch = RegExp(
      r'(?:crea|crear|agrega|agregar|anade|añade)\s+(?:una\s+)?clase\s+([a-zA-ZÀ-ÿ_][a-zA-ZÀ-ÿ0-9_]*)',
      caseSensitive: false,
    ).firstMatch(message);
    if (classMatch != null) {
      final name = classMatch.group(1)!;
      return LocalAiResult(
        message: 'Preparé la clase $name en el diagrama local.',
        engine: AiEngine.fallback,
        command: LocalCommand(LocalCommandType.createClass, {'name': name}),
      );
    }

    final attributeMatch = RegExp(
      r'(?:agrega|agregar|anade|añade)\s+(?:el\s+)?atributo\s+([a-zA-ZÀ-ÿ_][a-zA-ZÀ-ÿ0-9_]*)\s+(?:a|en)\s+([a-zA-ZÀ-ÿ_][a-zA-ZÀ-ÿ0-9_]*)',
      caseSensitive: false,
    ).firstMatch(message);
    if (attributeMatch != null) {
      return LocalAiResult(
        message:
            'Preparé el atributo ${attributeMatch.group(1)} para ${attributeMatch.group(2)}.',
        engine: AiEngine.fallback,
        command: LocalCommand(LocalCommandType.addAttribute, {
          'name': attributeMatch.group(1)!,
          'className': attributeMatch.group(2)!,
        }),
      );
    }

    if (normalized.contains('lista') && normalized.contains('proyecto')) {
      return const LocalAiResult(
        message: 'Mostraré los proyectos guardados en este dispositivo.',
        engine: AiEngine.fallback,
        command: LocalCommand(LocalCommandType.listProjects, {}),
      );
    }

    return const LocalAiResult(
      message:
          'Sin internet puedo conversar, listar proyectos, crear clases y agregar atributos. También acepto dictado por voz.',
      engine: AiEngine.fallback,
    );
  }

  int _cloudScore(String text) {
    const weights = {
      'arquitectura': 2,
      'backend': 2,
      'spring boot': 2,
      'genera codigo': 2,
      'optimiza': 1,
      'completo': 1,
      'base de datos': 1,
    };
    return weights.entries
        .where((entry) => text.contains(entry.key))
        .fold(0, (score, entry) => score + entry.value);
  }

  String _normalize(String value) => value
      .toLowerCase()
      .replaceAll(RegExp(r'[áàä]'), 'a')
      .replaceAll(RegExp(r'[éèë]'), 'e')
      .replaceAll(RegExp(r'[íìï]'), 'i')
      .replaceAll(RegExp(r'[óòö]'), 'o')
      .replaceAll(RegExp(r'[úùü]'), 'u');
}
