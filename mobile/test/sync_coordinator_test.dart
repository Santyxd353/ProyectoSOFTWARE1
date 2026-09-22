import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/storage/local_store.dart';
import 'package:proyecto_software1_mobile/core/sync/sync_coordinator.dart';
import 'package:proyecto_software1_mobile/core/sync/sync_queue.dart';

class MemorySyncStore extends LocalStore {
  MemorySyncStore([List<SyncOperation> initial = const []])
    : saved = List.of(initial);
  List<SyncOperation> saved;
  @override
  Future<List<SyncOperation>> readQueue() async => List.of(saved);
  @override
  Future<void> saveQueue(List<SyncOperation> operations) async =>
      saved = List.of(operations);
}

const operation = SyncOperation(
  id: 'android-1:1',
  entityId: 'diagram-1',
  deviceId: 'android-1',
  clientSequence: 1,
  baseVersion: 1,
  baseData: {'classes': []},
  payload: {'classes': []},
);

void main() {
  test('reloads a persisted operation after process death', () async {
    final coordinator = SyncCoordinator(
      store: MemorySyncStore([operation]),
      apply: (_) async => {},
    );
    await coordinator.start();
    expect(coordinator.pending, [operation]);
    expect(coordinator.status, SyncStatus.pending);
  });

  test('persists before exposing an enqueued operation', () async {
    final store = MemorySyncStore();
    final coordinator = SyncCoordinator(store: store, apply: (_) async => {});
    await coordinator.start();
    await coordinator.enqueue(operation);
    expect(store.saved, [operation]);
    expect(coordinator.pending, [operation]);
  });

  test(
    'replays in order and deletes only confirmed applied operations',
    () async {
      final second = operation.copyWith(id: 'android-1:2', clientSequence: 2);
      final calls = <String>[];
      final store = MemorySyncStore([operation, second]);
      final coordinator = SyncCoordinator(
        store: store,
        apply: (item) async {
          calls.add(item.id);
          return {'status': 'APPLIED', 'version': item.clientSequence + 1};
        },
      );
      await coordinator.start();
      final report = await coordinator.syncNow();
      expect(calls, ['android-1:1', 'android-1:2']);
      expect(report.applied, hasLength(2));
      expect(store.saved, isEmpty);
      expect(coordinator.status, SyncStatus.synced);
    },
  );

  test('preserves work when authentication expires', () async {
    final store = MemorySyncStore([operation]);
    final coordinator = SyncCoordinator(
      store: store,
      apply: (_) async => throw const ApiException('Unauthorized', 401),
    );
    await coordinator.start();
    await coordinator.syncNow();
    expect(store.saved.single.id, operation.id);
    expect(store.saved.single.attemptCount, 1);
    expect(coordinator.status, SyncStatus.reviewRequired);
  });

  test('clears an operation already confirmed by the server after a lost acknowledgement', () async {
    final store = MemorySyncStore([operation]);
    final coordinator = SyncCoordinator(store: store, apply: (_) async => {
      'status': 'DUPLICATE', 'version': 2,
    });
    await coordinator.start();
    final report = await coordinator.syncNow();
    expect(report.applied, hasLength(1));
    expect(store.saved, isEmpty);
  });

  test('coalesces concurrent reconnect attempts into one server replay', () async {
    final reply = Completer<Map<String, dynamic>>();
    final store = MemorySyncStore([operation]);
    var calls = 0;
    final coordinator = SyncCoordinator(store: store, apply: (_) {
      calls++;
      return reply.future;
    });
    await coordinator.start();
    final first = coordinator.syncNow();
    final second = coordinator.syncNow();
    await Future<void>.delayed(Duration.zero);
    expect(calls, 1);
    reply.complete({'status': 'APPLIED', 'version': 2});
    await Future.wait([first, second]);
    expect(store.saved, isEmpty);
  });

  test('does not coalesce a new edit into an operation already in flight', () async {
    final reply = Completer<Map<String, dynamic>>();
    final store = MemorySyncStore([operation]);
    final coordinator = SyncCoordinator(
      store: store,
      apply: (_) => reply.future,
    );
    await coordinator.start();

    final syncing = coordinator.syncNow();
    await Future<void>.delayed(Duration.zero);
    final second = operation.copyWith(
      id: 'android-1:2',
      clientSequence: 2,
      payload: {'classes': [{'id': 'class-1', 'name': 'Latest'}]},
    );
    await coordinator.enqueue(second);
    reply.complete({'status': 'APPLIED', 'version': 2});
    await syncing;

    expect(store.saved, [second]);
    expect(coordinator.pending, [second]);
    expect(coordinator.status, SyncStatus.pending);
  });

  test('sends the latest coalesced payload for an operation waiting behind another', () async {
    final firstReply = Completer<Map<String, dynamic>>();
    final second = operation.copyWith(
      id: 'android-1:2',
      entityId: 'diagram-2',
      clientSequence: 2,
      payload: {'classes': [{'id': 'class-2', 'name': 'Initial'}]},
    );
    final sent = <SyncOperation>[];
    final store = MemorySyncStore([operation, second]);
    final coordinator = SyncCoordinator(
      store: store,
      apply: (item) async {
        sent.add(item);
        if (item.id == operation.id) return firstReply.future;
        return {'status': 'APPLIED', 'version': 3};
      },
    );
    await coordinator.start();

    final syncing = coordinator.syncNow();
    await Future<void>.delayed(Duration.zero);
    await coordinator.enqueue(
      second.copyWith(
        id: 'android-1:3',
        clientSequence: 3,
        payload: {'classes': [{'id': 'class-2', 'name': 'Latest'}]},
      ),
    );
    firstReply.complete({'status': 'APPLIED', 'version': 2});
    await syncing;

    expect(sent, hasLength(2));
    expect(sent.last.payload, {
      'classes': [{'id': 'class-2', 'name': 'Latest'}],
    });
    expect(store.saved, isEmpty);
  });

  test('backs off transient failures without deleting the operation', () async {
    final store = MemorySyncStore([operation]);
    final coordinator = SyncCoordinator(
      store: store,
      apply: (_) async => throw Exception('network down'),
      clock: () => DateTime.utc(2026, 9, 20),
    );
    await coordinator.start();
    await coordinator.syncNow();
    expect(store.saved.single.attemptCount, 1);
    expect(
      store.saved.single.nextAttemptAt,
      DateTime.utc(2026, 9, 20, 0, 0, 2),
    );
    expect(coordinator.status, SyncStatus.pending);
  });

  test('stops at a conflict and keeps it for explicit review', () async {
    final store = MemorySyncStore([operation]);
    final coordinator = SyncCoordinator(
      store: store,
      apply: (_) async => {'status': 'CONFLICT', 'conflictId': 'conflict-1'},
    );
    await coordinator.start();
    final report = await coordinator.syncNow();
    expect(report.conflictId, 'conflict-1');
    expect(store.saved.single.id, operation.id);
    expect(store.saved.single.attemptCount, 1);
    expect(coordinator.status, SyncStatus.conflict);
  });

  test('removes only the operation explicitly resolved by the user', () async {
    final second = operation.copyWith(id: 'android-1:2', clientSequence: 2);
    final store = MemorySyncStore([operation, second]);
    final coordinator = SyncCoordinator(store: store, apply: (_) async => {});
    await coordinator.start();

    await coordinator.discardConfirmedConflict('android-1', 1);

    expect(store.saved, [second]);
    expect(coordinator.pending, [second]);
  });
}
