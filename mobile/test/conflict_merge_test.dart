import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/features/conflicts/conflict_merge.dart';

const conflict = SyncConflict(
  id: 'conflict-1',
  diagramId: 'diagram-1',
  baseVersion: 2,
  base: {'name': 'Original', 'classes': []},
  local: {'name': 'Local', 'classes': []},
  remote: {'name': 'Remoto', 'classes': []},
  authorId: 'user-2',
  serverSequence: 9,
  createdAt: '2026-09-20T12:00:00Z',
);

void main() {
  test('offers local, remote and merged variants without losing metadata', () {
    final local = ConflictMerge.resolve(conflict, ConflictChoice.local);
    final remote = ConflictMerge.resolve(conflict, ConflictChoice.remote);
    final merged = ConflictMerge.resolve(
      conflict,
      ConflictChoice.merged,
      merged: const {'name': 'Combinado', 'classes': []},
    );

    expect(local.data['name'], 'Local');
    expect(remote.data['name'], 'Remoto');
    expect(merged.data['name'], 'Combinado');
    for (final result in [local, remote, merged]) {
      expect(result.metadata['conflictId'], 'conflict-1');
      expect(result.metadata['authorId'], 'user-2');
      expect(result.metadata['serverSequence'], 9);
      expect(result.metadata['baseVersion'], 2);
    }
  });

  test('requires an explicit payload for a merged resolution', () {
    expect(
      () => ConflictMerge.resolve(conflict, ConflictChoice.merged),
      throwsArgumentError,
    );
  });
}
