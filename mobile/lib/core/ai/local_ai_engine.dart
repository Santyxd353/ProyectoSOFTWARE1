enum LocalCommandType {
  createClass,
  addAttribute,
  connectClasses,
  listProjects,
  summarizeDiagram,
}

class LocalCommand {
  const LocalCommand(this.type, this.arguments);

  final LocalCommandType type;
  final Map<String, String> arguments;
}

class LocalAiResult {
  const LocalAiResult({
    required this.message,
    this.command,
    this.requiresCloud = false,
  });

  final String message;
  final LocalCommand? command;
  final bool requiresCloud;
}

/// Compact on-device intent model. Its weighted vocabulary is bundled with the
/// application and needs neither a network call nor a downloaded model file.
class LocalAiEngine {
  LocalAiResult respond(String rawMessage) {
    final message = rawMessage.trim();
    final normalized = _normalize(message);

    if (_cloudScore(normalized) >= 2) {
      return const LocalAiResult(
        message: 'Esta solicitud requiere la IA avanzada. La enviaré a Claude cuando tengas conexión.',
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
        command: LocalCommand(LocalCommandType.createClass, {'name': name}),
      );
    }

    final attributeMatch = RegExp(
      r'(?:agrega|agregar|anade|añade)\s+(?:el\s+)?atributo\s+([a-zA-ZÀ-ÿ_][a-zA-ZÀ-ÿ0-9_]*)\s+(?:a|en)\s+([a-zA-ZÀ-ÿ_][a-zA-ZÀ-ÿ0-9_]*)',
      caseSensitive: false,
    ).firstMatch(message);
    if (attributeMatch != null) {
      return LocalAiResult(
        message: 'Preparé el atributo ${attributeMatch.group(1)} para ${attributeMatch.group(2)}.',
        command: LocalCommand(LocalCommandType.addAttribute, {
          'name': attributeMatch.group(1)!,
          'className': attributeMatch.group(2)!,
        }),
      );
    }

    if (normalized.contains('lista') && normalized.contains('proyecto')) {
      return const LocalAiResult(
        message: 'Mostraré los proyectos guardados en este dispositivo.',
        command: LocalCommand(LocalCommandType.listProjects, {}),
      );
    }

    return const LocalAiResult(
      message: 'Sin internet puedo conversar, listar proyectos, crear clases y agregar atributos. También acepto dictado por voz.',
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

  String _normalize(String value) => value.toLowerCase()
      .replaceAll(RegExp(r'[áàä]'), 'a')
      .replaceAll(RegExp(r'[éèë]'), 'e')
      .replaceAll(RegExp(r'[íìï]'), 'i')
      .replaceAll(RegExp(r'[óòö]'), 'o')
      .replaceAll(RegExp(r'[úùü]'), 'u');
}
