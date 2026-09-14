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
}
