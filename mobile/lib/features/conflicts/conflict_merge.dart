import '../../core/models/models.dart';

export '../../core/models/models.dart' show SyncConflict;

enum ConflictChoice { local, remote, merged }

class ConflictResolutionProposal {
  const ConflictResolutionProposal({
    required this.data,
    required this.metadata,
  });

  final Map<String, dynamic> data;
  final Map<String, dynamic> metadata;
}

class ConflictMerge {
  static ConflictResolutionProposal resolve(
    SyncConflict conflict,
    ConflictChoice choice, {
    Map<String, dynamic>? merged,
  }) {
    if (choice == ConflictChoice.merged && merged == null) {
      throw ArgumentError('A merged conflict requires an explicit payload');
    }
    final data = switch (choice) {
      ConflictChoice.local => conflict.local,
      ConflictChoice.remote => conflict.remote,
      ConflictChoice.merged => merged!,
    };
    return ConflictResolutionProposal(
      data: Map<String, dynamic>.from(data),
      metadata: {
        'conflictId': conflict.id,
        'diagramId': conflict.diagramId,
        'choice': choice.name,
        'authorId': conflict.authorId,
        'serverSequence': conflict.serverSequence,
        'baseVersion': conflict.baseVersion,
        'createdAt': conflict.createdAt,
      },
    );
  }
}
