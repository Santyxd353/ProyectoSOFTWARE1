import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/core/sync/sync_queue.dart';

void main() {
  test('keeps offline operations in durable execution order', () {
    final queue = SyncQueue();
    queue.enqueue(
      SyncOperation(
        id: '1',
        entityId: 'diagram-1',
        baseVersion: 2,
        payload: {'name': 'A'},
      ),
    );
    queue.enqueue(
      SyncOperation(
        id: '2',
        entityId: 'diagram-1',
        baseVersion: 3,
        payload: {'name': 'B'},
      ),
    );

    expect(queue.pending.map((item) => item.id), ['1', '2']);
    queue.markCompleted('1');
    expect(queue.pending.map((item) => item.id), ['2']);
  });

  test('merges independent local and remote changes', () {
    final result = ConflictResolver.resolve(
      base: {'name': 'Order', 'x': 10},
      local: {'name': 'Order', 'x': 20},
      remote: {'name': 'Purchase', 'x': 10},
    );

    expect(result.hasConflict, isFalse);
    expect(result.merged, {'name': 'Purchase', 'x': 20});
  });

  test('reports a conflict when both sides change the same field', () {
    final result = ConflictResolver.resolve(
      base: {'name': 'Order'},
      local: {'name': 'LocalOrder'},
      remote: {'name': 'RemoteOrder'},
    );

    expect(result.hasConflict, isTrue);
    expect(result.conflictingKeys, ['name']);
  });

  test(
    'round-trips the device sequence and base snapshot needed for retry',
    () {
      final operation = SyncOperation(
        id: 'op-1',
        entityId: 'diagram-1',
        deviceId: 'android-1',
        clientSequence: 17,
        baseVersion: 4,
        baseData: {'classes': []},
        attemptCount: 2,
        nextAttemptAt: DateTime.utc(2026, 9, 20, 12, 30),
        payload: {
          'classes': [
            {'id': 'class-1'},
          ],
        },
      );

      final restored = SyncOperation.fromJson(operation.toJson());

      expect(restored.deviceId, 'android-1');
      expect(restored.clientSequence, 17);
      expect(restored.baseData, {'classes': []});
      expect(restored.attemptCount, 2);
      expect(restored.nextAttemptAt, DateTime.utc(2026, 9, 20, 12, 30));
    },
  );
}
