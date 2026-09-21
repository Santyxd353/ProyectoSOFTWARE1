enum AiEngine { functionGemma, fallback, cloud }

enum LocalCommandType {
  createClass,
  addAttribute,
  connectClasses,
  deleteClass,
  listProjects,
  summarizeDiagram,
}

class LocalCommand {
  const LocalCommand(this.type, this.arguments);

  final LocalCommandType type;
  final Map<String, String> arguments;
}
