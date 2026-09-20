import 'package:flutter/material.dart';

import 'diagram_operations.dart';

class UmlCanvasController extends ChangeNotifier {
  UmlCanvasController(
    Map<String, dynamic> initialModel, {
    this.onChanged,
    String Function()? idFactory,
  }) : _model = initialModel,
       _idFactory =
           idFactory ??
           (() => 'mobile_${DateTime.now().microsecondsSinceEpoch}');

  Map<String, dynamic> _model;
  final ValueChanged<Map<String, dynamic>>? onChanged;
  final String Function() _idFactory;
  String? selectedClassId;
  String? selectedRelationId;

  Map<String, dynamic> get model => _model;

  void selectClass(String? id) {
    selectedClassId = id;
    selectedRelationId = null;
    notifyListeners();
  }

  void selectRelation(String? id) {
    selectedRelationId = id;
    selectedClassId = null;
    notifyListeners();
  }

  void createClass(String name, Offset position) {
    _commit(
      DiagramOperations.createClass(
        _model,
        id: _idFactory(),
        name: name,
        x: position.dx,
        y: position.dy,
      ),
    );
  }

  void moveSelected(Offset position) {
    final id = selectedClassId;
    if (id == null) return;
    _commit(
      DiagramOperations.moveClass(_model, id, x: position.dx, y: position.dy),
    );
  }

  void updateSelectedClass(String name) {
    final id = selectedClassId;
    if (id == null) return;
    _commit(DiagramOperations.updateClass(_model, id, name: name));
  }

  void replaceSelectedClassDetails(Map<String, dynamic> details) {
    final id = selectedClassId;
    if (id == null) return;
    _commit(DiagramOperations.replaceClassDetails(_model, id, details));
  }

  void deleteSelectedClass() {
    final id = selectedClassId;
    if (id == null) return;
    _commit(DiagramOperations.deleteClass(_model, id));
    selectedClassId = null;
  }

  void upsertAttribute({
    required String id,
    required String name,
    required String type,
    String? multiplicity,
    bool nullable = true,
    bool unique = false,
  }) {
    final classId = selectedClassId;
    if (classId == null) return;
    _commit(
      DiagramOperations.upsertAttribute(
        _model,
        classId,
        id: id,
        name: name,
        type: type,
        multiplicity: multiplicity,
        nullable: nullable,
        unique: unique,
      ),
    );
  }

  void upsertMethod({
    required String id,
    required String name,
    String returnType = 'void',
    String visibility = 'public',
  }) {
    final classId = selectedClassId;
    if (classId == null) return;
    _commit(
      DiagramOperations.upsertMethod(
        _model,
        classId,
        id: id,
        name: name,
        returnType: returnType,
        visibility: visibility,
      ),
    );
  }

  void createRelation({
    required String sourceClassId,
    required String targetClassId,
    required String type,
    String name = '',
    String sourceMultiplicity = '1',
    String targetMultiplicity = '1',
  }) {
    _commit(
      DiagramOperations.createRelation(
        _model,
        id: _idFactory(),
        sourceClassId: sourceClassId,
        targetClassId: targetClassId,
        type: type,
        name: name,
        sourceMultiplicity: sourceMultiplicity,
        targetMultiplicity: targetMultiplicity,
      ),
    );
  }

  void updateSelectedRelation({
    String? name,
    String? type,
    String? sourceMultiplicity,
    String? targetMultiplicity,
  }) {
    final id = selectedRelationId;
    if (id == null) return;
    _commit(
      DiagramOperations.updateRelation(
        _model,
        id,
        name: name,
        type: type,
        sourceMultiplicity: sourceMultiplicity,
        targetMultiplicity: targetMultiplicity,
      ),
    );
  }

  void deleteSelectedRelation() {
    final id = selectedRelationId;
    if (id == null) return;
    _commit(DiagramOperations.deleteRelation(_model, id));
    selectedRelationId = null;
  }

  void replaceModel(Map<String, dynamic> value) {
    _model = value;
    notifyListeners();
  }

  void _commit(Map<String, dynamic> value) {
    _model = value;
    onChanged?.call(value);
    notifyListeners();
  }
}
