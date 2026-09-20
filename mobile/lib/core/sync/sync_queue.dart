class SyncOperation {
  const SyncOperation({
    required this.id,
    required this.entityId,
    this.deviceId = '',
    this.clientSequence = 0,
    required this.baseVersion,
    this.baseData = const {},
    required this.payload,
    this.attemptCount = 0,
    this.nextAttemptAt,
  });

  final String id;
  final String entityId;
  final String deviceId;
  final int clientSequence;
  final int baseVersion;
  final Map<String, dynamic> baseData;
  final Map<String, dynamic> payload;
  final int attemptCount;
  final DateTime? nextAttemptAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'entityId': entityId,
    'deviceId': deviceId,
    'clientSequence': clientSequence,
    'baseVersion': baseVersion,
    'baseData': baseData,
    'payload': payload,
    'attemptCount': attemptCount,
    if (nextAttemptAt != null)
      'nextAttemptAt': nextAttemptAt!.toIso8601String(),
  };

  factory SyncOperation.fromJson(Map<String, dynamic> json) => SyncOperation(
    id: json['id'] as String,
    entityId: json['entityId'] as String,
    deviceId: json['deviceId'] as String? ?? '',
    clientSequence: json['clientSequence'] as int? ?? 0,
    baseVersion: json['baseVersion'] as int,
    baseData: Map<String, dynamic>.from(json['baseData'] as Map? ?? const {}),
    payload: Map<String, dynamic>.from(json['payload'] as Map),
    attemptCount: json['attemptCount'] as int? ?? 0,
    nextAttemptAt: json['nextAttemptAt'] == null
        ? null
        : DateTime.parse(json['nextAttemptAt'] as String),
  );

  SyncOperation copyWith({
    String? id,
    String? entityId,
    String? deviceId,
    int? clientSequence,
    int? baseVersion,
    Map<String, dynamic>? baseData,
    Map<String, dynamic>? payload,
    int? attemptCount,
    DateTime? nextAttemptAt,
    bool clearNextAttemptAt = false,
  }) => SyncOperation(
    id: id ?? this.id,
    entityId: entityId ?? this.entityId,
    deviceId: deviceId ?? this.deviceId,
    clientSequence: clientSequence ?? this.clientSequence,
    baseVersion: baseVersion ?? this.baseVersion,
    baseData: baseData ?? this.baseData,
    payload: payload ?? this.payload,
    attemptCount: attemptCount ?? this.attemptCount,
    nextAttemptAt: clearNextAttemptAt
        ? null
        : nextAttemptAt ?? this.nextAttemptAt,
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
