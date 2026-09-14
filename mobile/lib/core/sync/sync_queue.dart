class SyncOperation {
  const SyncOperation({
    required this.id,
    required this.entityId,
    required this.baseVersion,
    required this.payload,
  });

  final String id;
  final String entityId;
  final int baseVersion;
  final Map<String, dynamic> payload;

  Map<String, dynamic> toJson() => {
    'id': id,
    'entityId': entityId,
    'baseVersion': baseVersion,
    'payload': payload,
  };

  factory SyncOperation.fromJson(Map<String, dynamic> json) => SyncOperation(
    id: json['id'] as String,
    entityId: json['entityId'] as String,
    baseVersion: json['baseVersion'] as int,
    payload: Map<String, dynamic>.from(json['payload'] as Map),
  );
}

class SyncQueue {
  final List<SyncOperation> _operations = [];

  List<SyncOperation> get pending => List.unmodifiable(_operations);

  void enqueue(SyncOperation operation) {
    if (_operations.every((item) => item.id != operation.id)) {
      _operations.add(operation);
    }
  }

  void markCompleted(String operationId) {
    _operations.removeWhere((item) => item.id == operationId);
  }
}

class ConflictResolution {
  const ConflictResolution({
    required this.merged,
    required this.conflictingKeys,
  });

  final Map<String, dynamic> merged;
  final List<String> conflictingKeys;
  bool get hasConflict => conflictingKeys.isNotEmpty;
}

class ConflictResolver {
  static ConflictResolution resolve({
    required Map<String, dynamic> base,
    required Map<String, dynamic> local,
    required Map<String, dynamic> remote,
  }) {
    final keys = {...base.keys, ...local.keys, ...remote.keys};
    final merged = <String, dynamic>{};
    final conflicts = <String>[];

    for (final key in keys) {
      final baseValue = base[key];
      final localValue = local[key];
      final remoteValue = remote[key];
      final localChanged = localValue != baseValue;
      final remoteChanged = remoteValue != baseValue;
      if (localChanged && remoteChanged && localValue != remoteValue) {
        conflicts.add(key);
        merged[key] = localValue;
      } else if (remoteChanged) {
        merged[key] = remoteValue;
      } else {
        merged[key] = localValue;
      }
    }
    return ConflictResolution(merged: merged, conflictingKeys: conflicts);
  }
}
