import 'dart:math';

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../storage/local_store.dart';
import 'sync_queue.dart';

enum SyncStatus { synced, pending, conflict, reviewRequired }

class AppliedSyncOperation {
  const AppliedSyncOperation({required this.operation, required this.response});

  final SyncOperation operation;
  final Map<String, dynamic> response;
}

class SyncReport {
  const SyncReport({this.applied = const [], this.conflictId});

  final List<AppliedSyncOperation> applied;
  final String? conflictId;
}

class SyncCoordinator extends ChangeNotifier {
  SyncCoordinator({
    required this.store,
    required this.apply,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final LocalStore store;
  final Future<Map<String, dynamic>> Function(SyncOperation) apply;
  final DateTime Function() _clock;
  List<SyncOperation> _pending = [];
  SyncStatus _status = SyncStatus.synced;
  Future<SyncReport>? _syncInFlight;
  Future<void> _queueMutation = Future<void>.value();
  final Set<String> _inFlightOperationIds = {};

  List<SyncOperation> get pending => List.unmodifiable(_pending);
  SyncStatus get status => _status;

  Future<void> start() async {
    _pending = await store.readQueue();
    _status = _pending.isEmpty ? SyncStatus.synced : SyncStatus.pending;
    notifyListeners();
  }

  void seed(List<SyncOperation> operations) {
    _pending = List.of(operations);
    _status = _pending.isEmpty ? SyncStatus.synced : SyncStatus.pending;
    notifyListeners();
  }

  Future<void> enqueue(SyncOperation operation) async {
    await _mutateQueue((current) {
      if (current.any((item) => item.id == operation.id)) return current;
      final coalescibleIndex = current.indexWhere(
        (item) =>
            item.entityId == operation.entityId &&
            item.attemptCount == 0 &&
            item.nextAttemptAt == null &&
            !_inFlightOperationIds.contains(item.id),
      );
      if (coalescibleIndex >= 0) {
        final original = current[coalescibleIndex];
        current[coalescibleIndex] = original.copyWith(
          payload: operation.payload,
        );
      } else {
        current.add(operation);
      }
      return current;
    });
    _status = SyncStatus.pending;
    notifyListeners();
  }

  Future<SyncReport> syncNow() {
    final existing = _syncInFlight;
    if (existing != null) return existing;
    final current = _runSyncNow();
    _syncInFlight = current;
    return current.whenComplete(() {
      if (identical(_syncInFlight, current)) _syncInFlight = null;
    });
  }

  Future<SyncReport> _runSyncNow() async {
    final applied = <AppliedSyncOperation>[];
    String? conflictId;

    final operationIds = _pending.map((item) => item.id).toList();
    for (final operationId in operationIds) {
      _inFlightOperationIds.add(operationId);
      SyncOperation? operation;
      try {
        await _mutateQueue((current) {
          final index = current.indexWhere((item) => item.id == operationId);
          if (index < 0) return current;
          final queued = current[index];
          final retryAt = queued.nextAttemptAt;
          if (retryAt != null && retryAt.isAfter(_clock())) return current;
          operation = queued.copyWith(
            attemptCount: queued.attemptCount + 1,
            clearNextAttemptAt: true,
          );
          current[index] = operation!;
          return current;
        });
        final attempted = operation;
        if (attempted == null) continue;
        final response = await apply(attempted);
        if (response['status'] == 'CONFLICT') {
          conflictId = response['conflictId']?.toString();
          _status = SyncStatus.conflict;
          notifyListeners();
          break;
        }
        if (response['status'] != 'APPLIED' && response['status'] != 'DUPLICATE') {
          await _scheduleRetry(attempted);
          break;
        }

        await _mutateQueue(
          (current) =>
              current.where((item) => item.id != attempted.id).toList(),
        );
        applied.add(
          AppliedSyncOperation(operation: attempted, response: response),
        );
        _status = _pending.isEmpty ? SyncStatus.synced : SyncStatus.pending;
        notifyListeners();
      } on ApiException catch (exception) {
        if (exception.statusCode == 401 || exception.statusCode == 403) {
          _status = SyncStatus.reviewRequired;
          notifyListeners();
          break;
        }
        if (exception.statusCode == 409) {
          _status = SyncStatus.conflict;
          notifyListeners();
          break;
        }
        if (operation != null) await _scheduleRetry(operation!);
        break;
      } catch (_) {
        if (operation != null) await _scheduleRetry(operation!);
        break;
      } finally {
        _inFlightOperationIds.remove(operationId);
      }
    }

    if (_pending.isEmpty) _status = SyncStatus.synced;
    return SyncReport(applied: applied, conflictId: conflictId);
  }

  Future<void> discardConfirmedConflict(
    String deviceId,
    int clientSequence,
  ) async {
    await _mutateQueue(
      (current) => current
          .where(
            (item) =>
                item.deviceId != deviceId ||
                item.clientSequence != clientSequence,
          )
          .toList(),
    );
    _status = _pending.isEmpty ? SyncStatus.synced : SyncStatus.pending;
    notifyListeners();
  }

  Future<void> _scheduleRetry(SyncOperation operation) async {
    final attempts = operation.attemptCount;
    final seconds = min(300, pow(2, attempts).toInt());
    final updated = operation.copyWith(
      attemptCount: attempts,
      nextAttemptAt: _clock().add(Duration(seconds: seconds)),
    );
    await _mutateQueue(
      (current) => current
          .map((item) => item.id == operation.id ? updated : item)
          .toList(),
    );
    _status = SyncStatus.pending;
    notifyListeners();
  }

  Future<void> _mutateQueue(
    List<SyncOperation> Function(List<SyncOperation>) mutation,
  ) {
    final action = _queueMutation.then((_) async {
      final next = mutation(List<SyncOperation>.from(_pending));
      await store.saveQueue(next);
      _pending = next;
    });
    _queueMutation = action.catchError((Object _) {});
    return action;
  }
}
