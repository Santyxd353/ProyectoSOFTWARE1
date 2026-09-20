import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/app.dart';
import 'package:proyecto_software1_mobile/app_controller.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';
import 'package:proyecto_software1_mobile/core/storage/local_store.dart';
import 'package:proyecto_software1_mobile/features/auth/register_screen.dart';
import 'package:proyecto_software1_mobile/features/settings/settings_screen.dart';

class WidgetStore extends LocalStore {
  @override
  Future<void> saveLocale(String value) async {}
  @override
  Future<void> saveThemeMode(String value) async {}
}

void main() {
  AppController controllerFor(WorkspaceRole role) =>
      AppController(
          store: WidgetStore(),
          apiClient: ApiClient(baseUrl: 'http://local/api'),
        )
        ..online = true
        ..activeWorkspace = WorkspaceModel(
          id: 'w1',
          name: 'Ventas',
          role: role.wire,
        );

  testWidgets('viewer sees project content without diagram mutation controls', (
    tester,
  ) async {
    final controller = controllerFor(WorkspaceRole.viewer);
    await tester.pumpWidget(
      MaterialApp(home: WorkspaceScreen(controller: controller)),
    );

    expect(find.text('Ventas'), findsOneWidget);
    expect(find.byIcon(Icons.add_chart_outlined), findsNothing);
    expect(find.byIcon(Icons.manage_accounts_outlined), findsOneWidget);
  });

  testWidgets('owner sees the documented diagram creation control', (
    tester,
  ) async {
    final controller = controllerFor(WorkspaceRole.owner);
    await tester.pumpWidget(
      MaterialApp(home: WorkspaceScreen(controller: controller)),
    );

    expect(find.byIcon(Icons.add_chart_outlined), findsOneWidget);
  });

  testWidgets(
    'registration and settings expose account, language and theme controls',
    (tester) async {
      final controller = controllerFor(WorkspaceRole.owner);
      await tester.pumpWidget(
        MaterialApp(home: RegisterScreen(controller: controller)),
      );
      expect(find.text('Crear cuenta'), findsWidgets);
      expect(find.byType(TextField), findsNWidgets(3));

      await tester.pumpWidget(
        MaterialApp(home: SettingsScreen(controller: controller)),
      );
      expect(find.text('Idioma'), findsOneWidget);
      expect(find.text('Apariencia'), findsOneWidget);
      expect(find.text('URL de la API local'), findsOneWidget);
    },
  );
}
