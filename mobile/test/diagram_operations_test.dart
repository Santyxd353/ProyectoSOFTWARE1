import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/features/diagrams/editor/diagram_operations.dart';

const empty = <String, dynamic>{
  'classes': <dynamic>[],
  'relations': <dynamic>[],
};

void main() {
  test('creates, moves, and updates a class without mutating the input', () {
    final created = DiagramOperations.createClass(
      empty,
      id: 'c1',
      name: 'Cliente',
      x: 40,
      y: 80,
    );
    final moved = DiagramOperations.moveClass(created, 'c1', x: 120, y: 160);
    final renamed = DiagramOperations.updateClass(moved, 'c1', name: 'Usuario');

    expect((empty['classes'] as List), isEmpty);
    expect((renamed['classes'] as List).single['id'], 'c1');
    expect((renamed['classes'] as List).single['name'], 'Usuario');
    expect((renamed['classes'] as List).single['position'], {
      'x': 120.0,
      'y': 160.0,
    });
  });

  test('upserts attributes and methods with stable ids', () {
    final model = DiagramOperations.createClass(
      empty,
      id: 'c1',
      name: 'Cliente',
      x: 0,
      y: 0,
    );
    final withAttribute = DiagramOperations.upsertAttribute(
      model,
      'c1',
      id: 'a1',
      name: 'correo',
      type: 'String',
      multiplicity: '0..1',
      nullable: true,
      unique: true,
    );
    final withMethod = DiagramOperations.upsertMethod(
      withAttribute,
      'c1',
      id: 'm1',
      name: 'validar',
      returnType: 'bool',
      visibility: 'public',
    );

    final target = (withMethod['classes'] as List).single as Map;
    expect((target['attributes'] as List).single['id'], 'a1');
    expect((target['attributes'] as List).single['multiplicity'], '0..1');
    expect((target['methods'] as List).single['id'], 'm1');
  });

  test('creates and updates a valid relation with multiplicities', () {
    var model = DiagramOperations.createClass(
      empty,
      id: 'c1',
      name: 'Pedido',
      x: 0,
      y: 0,
    );
    model = DiagramOperations.createClass(
      model,
      id: 'c2',
      name: 'Detalle',
      x: 200,
      y: 0,
    );
    model = DiagramOperations.createRelation(
      model,
      id: 'r1',
      sourceClassId: 'c1',
      targetClassId: 'c2',
      type: 'COMPOSITION',
      name: 'contiene',
      sourceMultiplicity: '1',
      targetMultiplicity: '1..*',
    );
    model = DiagramOperations.updateRelation(
      model,
      'r1',
      name: 'incluye',
      targetMultiplicity: '0..*',
    );

    final relation = (model['relations'] as List).single as Map;
    expect(relation['id'], 'r1');
    expect(relation['name'], 'incluye');
    expect(relation['sourceMultiplicity'], '1');
    expect(relation['targetMultiplicity'], '0..*');
  });

  test(
    'deleting a class removes attached relations and explicit deletes work',
    () {
      var model = DiagramOperations.createClass(
        empty,
        id: 'c1',
        name: 'A',
        x: 0,
        y: 0,
      );
      model = DiagramOperations.createClass(
        model,
        id: 'c2',
        name: 'B',
        x: 0,
        y: 0,
      );
      model = DiagramOperations.createRelation(
        model,
        id: 'r1',
        sourceClassId: 'c1',
        targetClassId: 'c2',
        type: 'ASSOCIATION',
      );
      model = DiagramOperations.deleteRelation(model, 'r1');
      expect(model['relations'], isEmpty);

      model = DiagramOperations.createRelation(
        model,
        id: 'r2',
        sourceClassId: 'c1',
        targetClassId: 'c2',
        type: 'ASSOCIATION',
      );
      model = DiagramOperations.deleteClass(model, 'c1');
      expect(model['classes'], hasLength(1));
      expect(model['relations'], isEmpty);
    },
  );

  test(
    'rejects duplicate ids, invalid references and invalid multiplicities',
    () {
      final model = DiagramOperations.createClass(
        empty,
        id: 'c1',
        name: 'A',
        x: 0,
        y: 0,
      );
      expect(
        () => DiagramOperations.createClass(
          model,
          id: 'c1',
          name: 'B',
          x: 0,
          y: 0,
        ),
        throwsFormatException,
      );
      expect(
        () => DiagramOperations.createRelation(
          model,
          id: 'r1',
          sourceClassId: 'c1',
          targetClassId: 'missing',
          type: 'ASSOCIATION',
        ),
        throwsFormatException,
      );
      expect(
        () => DiagramOperations.upsertAttribute(
          model,
          'c1',
          id: 'a1',
          name: 'items',
          type: 'Item',
          multiplicity: 'many',
        ),
        throwsFormatException,
      );
    },
  );
}
