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
    if (_pending.any((item) => item.id == operation.id)) return;
    final next = [..._pending, operation];
    await store.saveQueue(next);
    _pending = next;
    _status = SyncStatus.pending;
    notifyListeners();
  }

  Future<SyncReport> syncNow() async {
    final applied = <AppliedSyncOperation>[];
    String? conflictId;

    for (final operation in List<SyncOperation>.from(_pending)) {
      final retryAt = operation.nextAttemptAt;
      if (retryAt != null && retryAt.isAfter(_clock())) continue;

      try {
        final response = await apply(operation);
        if (response['status'] == 'CONFLICT') {
          conflictId = response['conflictId']?.toString();
          _status = SyncStatus.conflict;
          notifyListeners();
          break;
        }
        if (response['status'] != 'APPLIED') {
          await _scheduleRetry(operation);
          break;
        }

        final next = _pending.where((item) => item.id != operation.id).toList();
        await store.saveQueue(next);
        _pending = next;
        applied.add(
          AppliedSyncOperation(operation: operation, response: response),
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
        await _scheduleRetry(operation);
        break;
      } catch (_) {
        await _scheduleRetry(operation);
        break;
      }
    }

    if (_pending.isEmpty) _status = SyncStatus.synced;
    return SyncReport(applied: applied, conflictId: conflictId);
  }

  Future<void> discardConfirmedConflict(
    String deviceId,
    int clientSequence,
  ) async {
    final next = _pending
        .where(
          (item) =>
              item.deviceId != deviceId ||
              item.clientSequence != clientSequence,
        )
        .toList();
    await store.saveQueue(next);
    _pending = next;
    _status = _pending.isEmpty ? SyncStatus.synced : SyncStatus.pending;
    notifyListeners();
  }

  Future<void> _scheduleRetry(SyncOperation operation) async {
    final attempts = operation.attemptCount + 1;
    final seconds = min(300, pow(2, attempts).toInt());
    final updated = operation.copyWith(
      attemptCount: attempts,
      nextAttemptAt: _clock().add(Duration(seconds: seconds)),
    );
    final next = _pending
        .map((item) => item.id == operation.id ? updated : item)
        .toList();
    await store.saveQueue(next);
    _pending = next;
    _status = SyncStatus.pending;
    notifyListeners();
  }
}
