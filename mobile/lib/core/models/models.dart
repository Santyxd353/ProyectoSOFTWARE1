class WorkspaceModel {
  const WorkspaceModel({
    required this.id,
    required this.name,
    required this.role,
    this.description = '',
    this.diagrams = const [],
  });

  final String id;
  final String name;
  final String description;
  final String role;
  final List<DiagramModel> diagrams;

  factory WorkspaceModel.fromJson(Map<String, dynamic> json, {String? fallbackRole}) => WorkspaceModel(
    id: json['id'] as String,
    name: json['name'] as String? ?? 'Proyecto',
    description: json['description'] as String? ?? '',
    role: json['currentUserRole'] as String? ?? fallbackRole ?? 'VIEWER',
    diagrams: (json['diagrams'] as List? ?? const [])
        .map((item) => DiagramModel.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList(),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'currentUserRole': role,
    'diagrams': diagrams.map((item) => item.toJson()).toList(),
  };
}

class DiagramModel {
  const DiagramModel({
    required this.id,
    required this.name,
    required this.version,
    required this.data,
  });

  final String id;
  final String name;
  final int version;
  final Map<String, dynamic> data;

  factory DiagramModel.fromJson(Map<String, dynamic> json) => DiagramModel(
    id: json['id'] as String,
    name: json['name'] as String? ?? 'Diagrama',
    version: json['version'] as int? ?? 1,
    data: Map<String, dynamic>.from(json['data'] as Map? ?? const {
      'classes': <dynamic>[],
      'relations': <dynamic>[],
    }),
  );

  DiagramModel copyWith({Map<String, dynamic>? data, int? version}) => DiagramModel(
    id: id,
    name: name,
    version: version ?? this.version,
    data: data ?? this.data,
  );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'version': version, 'data': data};
}

class AiReply {
  const AiReply({required this.message, this.proposedModel, this.localCommandApplied = false});

  final String message;
  final Map<String, dynamic>? proposedModel;
  final bool localCommandApplied;
}
