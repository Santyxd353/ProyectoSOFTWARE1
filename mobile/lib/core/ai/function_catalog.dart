import 'ai_types.dart';

class ModelToolCall {
  const ModelToolCall(this.name, this.arguments);

  final String name;
  final Map<String, dynamic> arguments;
}

class ModelToolDefinition {
  const ModelToolDefinition({
    required this.name,
    required this.description,
    required this.properties,
    this.required = const [],
    this.destructive = false,
  });

  final String name;
  final String description;
  final Map<String, String> properties;
  final List<String> required;
  final bool destructive;

  Map<String, dynamic> get jsonSchema => {
    'type': 'object',
    'properties': {
      for (final property in properties.entries)
        property.key: {'type': property.value},
    },
    'required': required,
    'additionalProperties': false,
  };
}

class ValidatedToolCall {
  const ValidatedToolCall(this.definition, this.command);

  final ModelToolDefinition definition;
  final LocalCommand command;
}

class ToolValidationException implements Exception {
  const ToolValidationException(this.message);
  final String message;

  @override
  String toString() => 'ToolValidationException: $message';
}

class ToolConfirmationRequired extends ToolValidationException {
  const ToolConfirmationRequired(this.toolName)
    : super('La operación $toolName requiere confirmación explícita.');

  final String toolName;
}

class FunctionCatalog {
  FunctionCatalog(this.definitions);

  factory FunctionCatalog.standard() => FunctionCatalog(const [
    ModelToolDefinition(
      name: 'create_class',
      description: 'Crea una clase UML nueva.',
      properties: {'name': 'string'},
      required: ['name'],
    ),
    ModelToolDefinition(
      name: 'add_attribute',
      description: 'Agrega un atributo a una clase UML existente.',
      properties: {'className': 'string', 'name': 'string', 'type': 'string'},
      required: ['className', 'name'],
    ),
    ModelToolDefinition(
      name: 'connect_classes',
      description: 'Conecta dos clases UML con una relación.',
      properties: {
        'source': 'string',
        'target': 'string',
        'type': 'string',
        'sourceMultiplicity': 'string',
        'targetMultiplicity': 'string',
      },
      required: ['source', 'target'],
    ),
    ModelToolDefinition(
      name: 'list_projects',
      description: 'Lista los proyectos disponibles en el dispositivo.',
      properties: {},
    ),
    ModelToolDefinition(
      name: 'summarize_diagram',
      description: 'Resume las clases y relaciones del diagrama actual.',
      properties: {},
    ),
    ModelToolDefinition(
      name: 'delete_class',
      description: 'Elimina una clase UML. Es una operación destructiva.',
      properties: {'classId': 'string'},
      required: ['classId'],
      destructive: true,
    ),
  ]);

  final List<ModelToolDefinition> definitions;

  ValidatedToolCall validate(
    ModelToolCall call, {
    bool allowDestructive = false,
  }) {
    final definition = definitions.cast<ModelToolDefinition?>().firstWhere(
      (item) => item!.name == call.name,
      orElse: () => null,
    );
    if (definition == null) {
      throw ToolValidationException('Herramienta no permitida: ${call.name}.');
    }
    for (final key in call.arguments.keys) {
      if (!definition.properties.containsKey(key)) {
        throw ToolValidationException('Argumento no permitido: $key.');
      }
    }
    for (final required in definition.required) {
      if (!call.arguments.containsKey(required)) {
        throw ToolValidationException('Falta el argumento $required.');
      }
    }
    for (final entry in call.arguments.entries) {
      if (definition.properties[entry.key] == 'string' &&
          (entry.value is! String || (entry.value as String).trim().isEmpty)) {
        throw ToolValidationException('${entry.key} debe ser texto no vacío.');
      }
    }
    if (definition.destructive && !allowDestructive) {
      throw ToolConfirmationRequired(definition.name);
    }
    return ValidatedToolCall(definition, _toCommand(call));
  }

  LocalCommand _toCommand(ModelToolCall call) {
    final arguments = call.arguments.map(
      (key, value) => MapEntry(key, value.toString()),
    );
    final type = switch (call.name) {
      'create_class' => LocalCommandType.createClass,
      'add_attribute' => LocalCommandType.addAttribute,
      'connect_classes' => LocalCommandType.connectClasses,
      'delete_class' => LocalCommandType.deleteClass,
      'list_projects' => LocalCommandType.listProjects,
      'summarize_diagram' => LocalCommandType.summarizeDiagram,
      _ => throw ToolValidationException('Herramienta no permitida.'),
    };
    return LocalCommand(type, arguments);
  }
}
