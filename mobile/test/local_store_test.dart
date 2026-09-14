import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:proyecto_software1_mobile/core/storage/local_store.dart';
import 'package:proyecto_software1_mobile/core/sync/sync_queue.dart';

void main() {
  test('persists cached JSON and the offline synchronization queue', () async {
    SharedPreferences.setMockInitialValues({});
    final store = LocalStore();
    await store.saveJson('workspace:1', {'id': '1', 'name': 'Local'});
    await store.saveQueue([
      const SyncOperation(id: 'op-1', entityId: 'diagram-1', baseVersion: 4, payload: {'classes': []}),
    ]);

    expect(await store.readJson('workspace:1'), {'id': '1', 'name': 'Local'});
    expect((await store.readQueue()).single.id, 'op-1');
  });

  test('keeps one device identity and a monotonic client sequence', () async {
    SharedPreferences.setMockInitialValues({});
    final store = LocalStore();

    final firstIdentity = await store.readOrCreateDeviceId();
    final secondIdentity = await store.readOrCreateDeviceId();
    final firstSequence = await store.nextClientSequence();
    final secondSequence = await store.nextClientSequence();

    expect(firstIdentity, isNotEmpty);
    expect(secondIdentity, firstIdentity);
    expect(firstSequence, 1);
    expect(secondSequence, 2);
  });
}
