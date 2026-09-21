import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/artifact_models.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';
import 'package:proyecto_software1_mobile/core/storage/local_store.dart';
import 'package:proyecto_software1_mobile/core/sync/sync_coordinator.dart';
import 'package:proyecto_software1_mobile/core/sync/sync_queue.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:3002/api',
  );

  testWidgets('CU-25 reloads an offline edit after coordinator recreation', (
    tester,
  ) async {
    final store = LocalStore();
    await store.saveQueue(const []);
    final first = SyncCoordinator(store: store, apply: (_) async => {});
    await first.start();
    const operation = SyncOperation(
      id: 'android-integration:1',
      entityId: 'diagram-offline',
      deviceId: 'android-integration',
      clientSequence: 1,
      baseVersion: 1,
      baseData: {'classes': [], 'relations': []},
      payload: {
        'classes': [
          {'id': 'offline-class', 'name': 'OfflineClass'},
        ],
        'relations': [],
      },
    );
    await first.enqueue(operation);
    first.dispose();

    final restored = SyncCoordinator(
      store: LocalStore(),
      apply: (_) async => {'status': 'APPLIED', 'version': 2},
    );
    await restored.start();

    expect(restored.pending.single.id, operation.id);
    expect(restored.status, SyncStatus.pending);
    await store.saveQueue(const []);
    restored.dispose();
  });

  testWidgets(
    'CU-21..CU-25 complete Android API journey',
    (tester) async {
      final suffix = DateTime.now().microsecondsSinceEpoch;
      final owner = ApiClient(baseUrl: baseUrl);
      final editor = ApiClient(baseUrl: baseUrl);

      final ownerRegistration = await owner.register(
        'Owner Android',
        'owner.android.$suffix@example.com',
        'Parity123!',
      );
      final editorRegistration = await editor.register(
        'Editor Android',
        'editor.android.$suffix@example.com',
        'Parity123!',
      );
      owner.token = ownerRegistration['token'] as String;
      editor.token = editorRegistration['token'] as String;

      // CU-21: account, project and diagram lifecycle.
      expect((await owner.getProfile()).name, 'Owner Android');
      final workspace = await owner.createWorkspace(
        'Android parity $suffix',
        'Recorrido integral CU-21 a CU-25',
      );
      final diagram = await owner.createDiagram(workspace.id, 'Modelo móvil');
      final initialData = <String, dynamic>{
        'classes': [
          {
            'id': 'customer',
            'name': 'Customer',
            'position': {'x': 80, 'y': 80},
            'attributes': [
              {
                'id': 'customer-id',
                'name': 'id',
                'type': 'Long',
                'nullable': false,
                'unique': true,
              },
            ],
            'methods': <dynamic>[],
          },
        ],
        'relations': <dynamic>[],
      };
      final seeded = await owner.updateDiagram(diagram.id, initialData);
      expect(seeded.data['classes'], hasLength(1));

      // CU-23: role-bound portable URL/code invitation and idempotent claim.
      final invitation = await owner.createPortableInvitation(
        workspace.id,
        role: WorkspaceRole.editor,
      );
      expect(invitation.url, isNotEmpty);
      expect(invitation.code, isNotEmpty);
      final claimed = await editor.claimPortableInvitation(invitation.code);
      expect(claimed.workspaceId, workspace.id);
      final claimedAgain = await editor.claimPortableInvitation(
        invitation.code,
      );
      expect(
        claimedAgain.alreadyAccepted || claimedAgain.alreadyMember,
        isTrue,
      );
      expect((await editor.getWorkspace(workspace.id)).role, 'EDITOR');

      // CU-22/CU-25: a second authenticated device applies a versioned edit.
      final editorBase = await editor.getDiagram(diagram.id);
      final editorData = Map<String, dynamic>.from(editorBase.data);
      final classes = List<Map<String, dynamic>>.from(
        (editorData['classes'] as List).map(
          (item) => Map<String, dynamic>.from(item as Map),
        ),
      );
      classes.add({
        'id': 'order',
        'name': 'Order',
        'position': {'x': 360, 'y': 80},
        'attributes': <dynamic>[],
        'methods': <dynamic>[],
      });
      editorData['classes'] = classes;
      editorData['relations'] = [
        {
          'id': 'customer-orders',
          'source': 'customer',
          'target': 'order',
          'type': 'ASSOCIATION',
          'sourceMultiplicity': '1',
          'targetMultiplicity': '*',
        },
      ];
      final operation = await editor.applyDiagramOperation(
        diagramId: diagram.id,
        deviceId: 'integration-editor-$suffix',
        clientSequence: 1,
        baseVersion: editorBase.version,
        baseData: editorBase.data,
        data: editorData,
      );
      expect(operation['status'], anyOf('APPLIED', 'DUPLICATE'));
      final synchronized = await owner.getDiagram(diagram.id);
      expect(synchronized.data['classes'], hasLength(2));

      // CU-24: generation, repository tree, review and download.
      final spring = await owner.generateProject(
        diagram.id,
        GeneratedProjectType.springBoot,
      );
      final flutter = await owner.generateProject(
        diagram.id,
        GeneratedProjectType.flutter,
      );
      expect(spring.revisionId, isNotEmpty);
      expect(flutter.revisionId, isNotEmpty);
      final revisions = await owner.listRevisions(
        workspace.id,
        diagramId: diagram.id,
      );
      expect(revisions.length, greaterThanOrEqualTo(2));
      final tree = await editor.getRevisionTree(
        workspace.id,
        spring.revisionId,
      );
      expect(tree, isNotEmpty);
      await editor.createRevisionComment(
        workspace.id,
        spring.revisionId,
        fileId: tree.first.id,
        body: 'Revisión creada desde Android.',
      );
      final comparison = await owner.compareRevisions(
        workspace.id,
        spring.revisionId,
        flutter.revisionId,
      );
      expect(comparison.files, isNotEmpty);
      final archive = await owner.downloadGeneratedProject(
        spring.generatedCodeId,
      );
      expect(archive.contentType, contains('zip'));
      expect(archive.bytes, isNotEmpty);

      // CU-25: XMI leaves the device and returns through preview/confirm.
      final xmi = await owner.exportDiagram(diagram.id, InterchangeFormat.xmi);
      final preview = await owner.previewDiagramImport(
        workspaceId: workspace.id,
        name: 'Modelo móvil reimportado',
        format: InterchangeFormat.xmi,
        content: utf8.decode(xmi.bytes),
      );
      expect(preview.token, isNotEmpty);
      expect(preview.acceptedClasses, greaterThanOrEqualTo(2));
      final imported = await owner.confirmDiagramImport(preview.token);
      expect(imported.id, isNot(diagram.id));
    },
    timeout: const Timeout(Duration(minutes: 8)),
  );
}
