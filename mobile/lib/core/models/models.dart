enum WorkspaceRole {
  owner,
  editor,
  viewer;

  factory WorkspaceRole.fromWire(String? value) =>
      switch (value?.toUpperCase()) {
        'OWNER' => WorkspaceRole.owner,
        'EDITOR' => WorkspaceRole.editor,
        _ => WorkspaceRole.viewer,
      };

  String get wire => name.toUpperCase();
  bool get canEditDiagrams => this != WorkspaceRole.viewer;
  bool get canManageMembers => this == WorkspaceRole.owner;
}

class UserProfile {
  const UserProfile({
    required this.id,
    required this.name,
    required this.email,
    this.avatar,
  });

  final String id;
  final String name;
  final String email;
  final String? avatar;

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
    id: json['id'] as String,
    name: json['name'] as String? ?? '',
    email: json['email'] as String? ?? '',
    avatar: json['avatar'] as String?,
  );
}

class WorkspaceMemberModel {
  const WorkspaceMemberModel({
    required this.id,
    required this.userId,
    required this.role,
    required this.user,
  });

  final String id;
  final String userId;
  final WorkspaceRole role;
  final UserProfile user;

  factory WorkspaceMemberModel.fromJson(Map<String, dynamic> json) =>
      WorkspaceMemberModel(
        id: json['id'] as String,
        userId: json['userId'] as String? ?? json['id'] as String,
        role: WorkspaceRole.fromWire(json['role'] as String?),
        user: UserProfile.fromJson(
          Map<String, dynamic>.from(json['user'] as Map),
        ),
      );
}

class WorkspaceMembersModel {
  const WorkspaceMembersModel({
    required this.workspaceId,
    required this.currentUserRole,
    required this.allowViewerComments,
    required this.members,
  });

  final String workspaceId;
  final WorkspaceRole currentUserRole;
  final bool allowViewerComments;
  final List<WorkspaceMemberModel> members;

  factory WorkspaceMembersModel.fromJson(Map<String, dynamic> json) =>
      WorkspaceMembersModel(
        workspaceId: json['workspaceId'] as String,
        currentUserRole: WorkspaceRole.fromWire(
          json['currentUserRole'] as String?,
        ),
        allowViewerComments: json['allowViewerComments'] as bool? ?? false,
        members: (json['members'] as List? ?? const [])
            .map(
              (item) => WorkspaceMemberModel.fromJson(
                Map<String, dynamic>.from(item as Map),
              ),
            )
            .toList(),
      );
}

class WorkspaceInvitationModel {
  const WorkspaceInvitationModel({
    required this.id,
    required this.workspaceId,
    required this.role,
    required this.status,
    this.email,
    this.expiresAt,
  });

  final String id;
  final String workspaceId;
  final String? email;
  final WorkspaceRole role;
  final String status;
  final String? expiresAt;

  factory WorkspaceInvitationModel.fromJson(Map<String, dynamic> json) =>
      WorkspaceInvitationModel(
        id: json['id'] as String,
        workspaceId: json['workspaceId'] as String,
        email: json['email'] as String?,
        role: WorkspaceRole.fromWire(json['role'] as String?),
        status: json['status'] as String? ?? 'PENDING',
        expiresAt: json['expiresAt'] as String?,
      );
}

class PortableInvitationModel {
  const PortableInvitationModel({
    required this.invitation,
    required this.token,
    required this.code,
    required this.url,
  });

  final WorkspaceInvitationModel invitation;
  final String token;
  final String code;
  final String url;

  factory PortableInvitationModel.fromJson(Map<String, dynamic> json) =>
      PortableInvitationModel(
        invitation: WorkspaceInvitationModel.fromJson(
          Map<String, dynamic>.from(json['invitation'] as Map),
        ),
        token: json['token'] as String,
        code: json['code'] as String,
        url: json['url'] as String,
      );
}

class ClaimedInvitationModel {
  const ClaimedInvitationModel({
    required this.workspaceId,
    required this.alreadyAccepted,
    required this.alreadyMember,
  });

  final String workspaceId;
  final bool alreadyAccepted;
  final bool alreadyMember;

  factory ClaimedInvitationModel.fromJson(Map<String, dynamic> json) =>
      ClaimedInvitationModel(
        workspaceId:
            (json['invitation'] as Map)['workspaceId'] as String? ?? '',
        alreadyAccepted: json['alreadyAccepted'] as bool? ?? false,
        alreadyMember: json['alreadyMember'] as bool? ?? false,
      );
}

class SyncConflict {
  const SyncConflict({
    required this.id,
    required this.diagramId,
    required this.baseVersion,
    required this.base,
    required this.local,
    required this.remote,
    required this.authorId,
    required this.serverSequence,
    required this.createdAt,
    this.deviceId,
    this.clientSequence,
  });

  final String id;
  final String diagramId;
  final int baseVersion;
  final Map<String, dynamic> base;
  final Map<String, dynamic> local;
  final Map<String, dynamic> remote;
  final String authorId;
  final int serverSequence;
  final String createdAt;
  final String? deviceId;
  final int? clientSequence;

  factory SyncConflict.fromJson(Map<String, dynamic> json) {
    final operation = Map<String, dynamic>.from(
      json['operation'] as Map? ?? const {},
    );
    return SyncConflict(
      id: json['id'] as String,
      diagramId: json['diagramId'] as String,
      baseVersion: json['baseVersion'] as int? ?? 1,
      base: Map<String, dynamic>.from(json['baseData'] as Map? ?? const {}),
      local: Map<String, dynamic>.from(json['localData'] as Map? ?? const {}),
      remote: Map<String, dynamic>.from(json['remoteData'] as Map? ?? const {}),
      authorId: operation['authorId'] as String? ?? '',
      serverSequence: operation['serverSequence'] as int? ?? 0,
      createdAt: operation['createdAt']?.toString() ?? '',
      deviceId: operation['deviceId'] as String?,
      clientSequence: operation['clientSequence'] as int?,
    );
  }
}

class WorkspaceModel {
  const WorkspaceModel({
    required this.id,
    required this.name,
    required this.role,
    this.description = '',
    this.diagrams = const [],
    this.archivedDiagrams = const [],
  });

  final String id;
  final String name;
  final String description;
  final String role;
  final List<DiagramModel> diagrams;
  final List<DiagramModel> archivedDiagrams;
  WorkspaceRole get roleValue => WorkspaceRole.fromWire(role);

  factory WorkspaceModel.fromJson(
    Map<String, dynamic> json, {
    String? fallbackRole,
  }) => WorkspaceModel(
    id: json['id'] as String,
    name: json['name'] as String? ?? 'Proyecto',
    description: json['description'] as String? ?? '',
    role: json['currentUserRole'] as String? ?? fallbackRole ?? 'VIEWER',
    diagrams: (json['diagrams'] as List? ?? const [])
        .map(
          (item) =>
              DiagramModel.fromJson(Map<String, dynamic>.from(item as Map)),
        )
        .toList(),
    archivedDiagrams: (json['archivedDiagrams'] as List? ?? const [])
        .map(
          (item) =>
              DiagramModel.fromJson(Map<String, dynamic>.from(item as Map)),
        )
        .toList(),
  );

  WorkspaceModel copyWith({
    String? name,
    String? description,
    List<DiagramModel>? diagrams,
    List<DiagramModel>? archivedDiagrams,
  }) => WorkspaceModel(
    id: id,
    name: name ?? this.name,
    description: description ?? this.description,
    role: role,
    diagrams: diagrams ?? this.diagrams,
    archivedDiagrams: archivedDiagrams ?? this.archivedDiagrams,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'currentUserRole': role,
    'diagrams': diagrams.map((item) => item.toJson()).toList(),
    'archivedDiagrams': archivedDiagrams.map((item) => item.toJson()).toList(),
  };
}

class DiagramModel {
  const DiagramModel({
    required this.id,
    required this.name,
    required this.version,
    required this.data,
    this.archivedAt,
  });

  final String id;
  final String name;
  final int version;
  final Map<String, dynamic> data;
  final String? archivedAt;
  bool get archived => archivedAt != null;

  factory DiagramModel.fromJson(Map<String, dynamic> json) => DiagramModel(
    id: json['id'] as String,
    name: json['name'] as String? ?? 'Diagrama',
    version: json['version'] as int? ?? 1,
    data: Map<String, dynamic>.from(
      json['data'] as Map? ??
          const {'classes': <dynamic>[], 'relations': <dynamic>[]},
    ),
    archivedAt: json['archivedAt'] as String?,
  );

  DiagramModel copyWith({
    Map<String, dynamic>? data,
    int? version,
    String? archivedAt,
    bool clearArchivedAt = false,
  }) => DiagramModel(
    id: id,
    name: name,
    version: version ?? this.version,
    data: data ?? this.data,
    archivedAt: clearArchivedAt ? null : archivedAt ?? this.archivedAt,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'version': version,
    'data': data,
    'archivedAt': archivedAt,
  };
}

class AiReply {
  const AiReply({
    required this.message,
    this.proposedModel,
    this.localCommandApplied = false,
  });

  final String message;
  final Map<String, dynamic>? proposedModel;
  final bool localCommandApplied;
}
