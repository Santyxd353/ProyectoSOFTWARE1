import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/app_controller.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/artifact_models.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';
import 'package:proyecto_software1_mobile/core/storage/local_store.dart';
import 'package:proyecto_software1_mobile/features/generation/artifact_hub_screen.dart';

class ArtifactApi extends ApiClient {
  ArtifactApi() : super(baseUrl: 'http://host/api');

  @override
  Future<List<RevisionSummaryModel>> listRevisions(
    String workspaceId, {
    String? diagramId,
  }) async => [];
}

void main() {
  Widget build(String role) {
    final controller =
        AppController(store: LocalStore(), apiClient: ArtifactApi())
          ..online = true
          ..activeWorkspace = WorkspaceModel(
            id: 'workspace-1',
            name: 'Ventas',
            role: role,
          )
          ..activeDiagram = const DiagramModel(
            id: 'diagram-1',
            name: 'Dominio',
            version: 2,
            data: {'classes': [], 'relations': []},
          );
    return MaterialApp(home: ArtifactHubScreen(controller: controller));
  }

  testWidgets('viewer can inspect and export but cannot mutate artifacts', (
    tester,
  ) async {
    await tester.pumpWidget(build('VIEWER'));
    expect(find.text('Generar Spring Boot'), findsNothing);

    await tester.tap(find.text('Intercambio'));
    await tester.pumpAndSettle();
    expect(find.text('Exportar XMI'), findsOneWidget);
    expect(find.text('Importar archivo'), findsNothing);
  });

  testWidgets('editor sees generation, restore and import capabilities', (
    tester,
  ) async {
    await tester.pumpWidget(build('EDITOR'));
    expect(find.text('Generar Spring Boot'), findsOneWidget);

    await tester.tap(find.text('Intercambio'));
    await tester.pumpAndSettle();
    expect(find.text('Importar archivo'), findsOneWidget);
  });

  test(
    'viewer controller rejects generation, restore and import mutations',
    () async {
      final controller =
          AppController(store: LocalStore(), apiClient: ArtifactApi())
            ..activeWorkspace = const WorkspaceModel(
              id: 'workspace-1',
              name: 'Lectura',
              role: 'VIEWER',
            )
            ..activeDiagram = const DiagramModel(
              id: 'diagram-1',
              name: 'Dominio',
              version: 2,
              data: {'classes': [], 'relations': []},
            );
      const revision = RevisionSummaryModel(
        id: 'revision-1',
        workspaceId: 'workspace-1',
        diagramId: 'diagram-1',
        modelVersion: 2,
        projectType: 'SPRING_BOOT',
        generator: 'spring-ejs@1',
        status: 'PUBLISHED',
        fileCount: 1,
        commentCount: 0,
        createdAt: '2026-09-20',
      );

      await expectLater(
        controller.generateProject(GeneratedProjectType.springBoot),
        throwsStateError,
      );
      await expectLater(
        controller.restoreCodeRevision(revision),
        throwsStateError,
      );
      await expectLater(
        controller.previewDiagramImport(
          name: 'Modelo',
          format: InterchangeFormat.xmi,
          content: '<xmi:XMI/>',
        ),
        throwsStateError,
      );
    },
  );
}
