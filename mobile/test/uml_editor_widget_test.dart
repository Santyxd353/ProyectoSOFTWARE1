import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/features/diagrams/editor/class_form.dart';
import 'package:proyecto_software1_mobile/features/diagrams/editor/uml_canvas.dart';
import 'package:proyecto_software1_mobile/features/diagrams/editor/uml_canvas_controller.dart';

void main() {
  testWidgets(
    'canvas supports pan and zoom and exposes selectable UML classes',
    (tester) async {
      final controller = UmlCanvasController(const {
        'classes': [
          {
            'id': 'c1',
            'name': 'Cliente',
            'position': {'x': 80, 'y': 80},
            'attributes': [
              {'id': 'a1', 'name': 'correo', 'type': 'String'},
            ],
            'methods': [],
          },
        ],
        'relations': [],
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: UmlCanvas(controller: controller, editable: true),
          ),
        ),
      );

      expect(find.byType(InteractiveViewer), findsOneWidget);
      expect(find.text('Cliente'), findsOneWidget);
      expect(find.text('correo: String'), findsOneWidget);
      await tester.tap(find.text('Cliente'));
      await tester.pump();
      expect(controller.selectedClassId, 'c1');
    },
  );

  testWidgets('class form returns class, attribute and method values', (
    tester,
  ) async {
    Map<String, dynamic>? saved;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ClassForm(
            initialClass: const {
              'id': 'c1',
              'name': 'Cliente',
              'attributes': [],
              'methods': [],
            },
            onSave: (value) => saved = value,
          ),
        ),
      ),
    );

    await tester.enterText(find.byKey(const Key('class-name')), 'Usuario');
    await tester.tap(find.byKey(const Key('add-attribute')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('attribute-name')), 'correo');
    await tester.enterText(find.byKey(const Key('attribute-type')), 'String');
    await tester.tap(find.text('Aceptar'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('save-class')));
    await tester.tap(find.byKey(const Key('save-class')));

    expect(saved?['name'], 'Usuario');
    expect(saved?['attributes'], hasLength(1));
    expect((saved?['attributes'] as List).single['name'], 'correo');
  });
}
