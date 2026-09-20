import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/features/diagrams/editor/uml_canvas_controller.dart';

void main() {
  test('controller selects and moves a class through tested operations', () {
    final controller = UmlCanvasController(const {
      'classes': [
        {
          'id': 'c1',
          'name': 'Cliente',
          'position': {'x': 0, 'y': 0},
          'attributes': [],
          'methods': [],
        },
      ],
      'relations': [],
    });

    controller.selectClass('c1');
    controller.moveSelected(const Offset(80, 120));

    expect(controller.selectedClassId, 'c1');
    expect((controller.model['classes'] as List).single['position'], {
      'x': 80.0,
      'y': 120.0,
    });
  });

  test('controller emits each immutable model change', () {
    final changes = <Map<String, dynamic>>[];
    final controller = UmlCanvasController(
      const {'classes': [], 'relations': []},
      onChanged: changes.add,
      idFactory: () => 'c1',
    );

    controller.createClass('Pedido', const Offset(20, 30));

    expect(changes, hasLength(1));
    expect((changes.single['classes'] as List).single['id'], 'c1');
  });
}
