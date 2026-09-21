import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/features/diagrams/editor/class_form.dart';
import 'package:proyecto_software1_mobile/features/diagrams/editor/relation_form.dart';

void main() {
  testWidgets('class sheet can be cancelled without creating a class', (
    tester,
  ) async {
    var saved = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => ClassForm(
                  initialClass: const {
                    'id': 'new',
                    'name': '',
                    'attributes': [],
                    'methods': [],
                  },
                  onSave: (_) => saved = true,
                ),
              ),
              child: const Text('Abrir clase'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Abrir clase'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Clase UML'), findsNothing);
    expect(saved, isFalse);
  });

  testWidgets('relation sheet can be cancelled without creating a relation', (
    tester,
  ) async {
    var saved = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => RelationForm(
                  classes: const [
                    {'id': 'a', 'name': 'A'},
                    {'id': 'b', 'name': 'B'},
                  ],
                  onSave: (_) => saved = true,
                ),
              ),
              child: const Text('Abrir relación'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Abrir relación'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Relación UML'), findsNothing);
    expect(saved, isFalse);
  });
}
