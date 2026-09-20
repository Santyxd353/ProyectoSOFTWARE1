import 'dart:convert';

class DiagramOperations {
  static final RegExp _multiplicity = RegExp(r'^(?:\d+|\*|\d+\.\.(?:\d+|\*))$');

  static Map<String, dynamic> createClass(
    Map<String, dynamic> model, {
    required String id,
    required String name,
    required num x,
    required num y,
  }) {
    final next = _copy(model);
    final classes = _classes(next);
    if (_allIds(next).contains(id)) {
      throw const FormatException('Duplicate UML identifier');
    }
    if (name.trim().isEmpty) {
      throw const FormatException('Class name is required');
    }
    classes.add({
      'id': id,
      'name': name.trim(),
      'position': {'x': x.toDouble(), 'y': y.toDouble()},
      'attributes': <dynamic>[],
      'methods': <dynamic>[],
    });
    return next;
  }

  static Map<String, dynamic> moveClass(
    Map<String, dynamic> model,
    String classId, {
    required num x,
    required num y,
  }) {
    final next = _copy(model);
    final target = _class(next, classId);
    target['position'] = {'x': x.toDouble(), 'y': y.toDouble()};
    return next;
  }

  static Map<String, dynamic> updateClass(
    Map<String, dynamic> model,
    String classId, {
    required String name,
  }) {
    if (name.trim().isEmpty) {
      throw const FormatException('Class name is required');
    }
    final next = _copy(model);
    _class(next, classId)['name'] = name.trim();
    return next;
  }

  static Map<String, dynamic> replaceClassDetails(
    Map<String, dynamic> model,
    String classId,
    Map<String, dynamic> details,
  ) {
    final name = details['name']?.toString().trim() ?? '';
    if (name.isEmpty) throw const FormatException('Class name is required');
    final next = _copy(model);
    final target = _class(next, classId);
    final attributes = (details['attributes'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final methods = (details['methods'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final memberIds = <String>{};
    for (final attribute in attributes) {
      final id = attribute['id']?.toString() ?? '';
      if (id.isEmpty || !memberIds.add(id)) {
        throw const FormatException('Duplicate UML identifier');
      }
      _validateMultiplicity(attribute['multiplicity']?.toString());
    }
    for (final method in methods) {
      final id = method['id']?.toString() ?? '';
      if (id.isEmpty || !memberIds.add(id)) {
        throw const FormatException('Duplicate UML identifier');
      }
    }
    target['name'] = name;
    target['attributes'] = attributes;
    target['methods'] = methods;
    return next;
  }

  static Map<String, dynamic> deleteClass(
    Map<String, dynamic> model,
    String classId,
  ) {
    final next = _copy(model);
    final classes = _classes(next);
    if (!classes.any((item) => item['id'] == classId)) {
      throw const FormatException('Class does not exist');
    }
    classes.removeWhere((item) => item['id'] == classId);
    _relations(next).removeWhere(
      (item) =>
          item['sourceClassId'] == classId || item['targetClassId'] == classId,
    );
    return next;
  }

  static Map<String, dynamic> upsertAttribute(
    Map<String, dynamic> model,
    String classId, {
    required String id,
    required String name,
    required String type,
    String? multiplicity,
    bool nullable = true,
    bool unique = false,
  }) {
    _validateMultiplicity(multiplicity);
    if (name.trim().isEmpty || type.trim().isEmpty) {
      throw const FormatException('Attribute name and type are required');
    }
    final next = _copy(model);
    final target = _class(next, classId);
    final attributes = _members(target, 'attributes');
    final value = <String, dynamic>{
      'id': id,
      'name': name.trim(),
      'type': type.trim(),
      if (multiplicity != null && multiplicity.isNotEmpty)
        'multiplicity': multiplicity,
      'nullable': nullable,
      'unique': unique,
    };
    final index = attributes.indexWhere((item) => item['id'] == id);
    if (index >= 0) {
      attributes[index] = value;
    } else {
      if (_allIds(next).contains(id)) {
        throw const FormatException('Duplicate UML identifier');
      }
      attributes.add(value);
    }
    return next;
  }

  static Map<String, dynamic> upsertMethod(
    Map<String, dynamic> model,
    String classId, {
    required String id,
    required String name,
    String returnType = 'void',
    String visibility = 'public',
    List<dynamic> parameters = const [],
  }) {
    if (name.trim().isEmpty) {
      throw const FormatException('Method name is required');
    }
    final next = _copy(model);
    final methods = _members(_class(next, classId), 'methods');
    final value = <String, dynamic>{
      'id': id,
      'name': name.trim(),
      'returnType': returnType.trim().isEmpty ? 'void' : returnType.trim(),
      'visibility': visibility,
      'parameters': parameters,
    };
    final index = methods.indexWhere((item) => item['id'] == id);
    if (index >= 0) {
      methods[index] = value;
    } else {
      if (_allIds(next).contains(id)) {
        throw const FormatException('Duplicate UML identifier');
      }
      methods.add(value);
    }
    return next;
  }

  static Map<String, dynamic> createRelation(
    Map<String, dynamic> model, {
    required String id,
    required String sourceClassId,
    required String targetClassId,
    required String type,
    String name = '',
    String sourceMultiplicity = '1',
    String targetMultiplicity = '1',
  }) {
    _validateMultiplicity(sourceMultiplicity);
    _validateMultiplicity(targetMultiplicity);
    final next = _copy(model);
    if (_allIds(next).contains(id)) {
      throw const FormatException('Duplicate UML identifier');
    }
    _class(next, sourceClassId);
    _class(next, targetClassId);
    _relations(next).add({
      'id': id,
      'sourceClassId': sourceClassId,
      'targetClassId': targetClassId,
      'type': type,
      'name': name.trim(),
      'sourceMultiplicity': sourceMultiplicity,
      'targetMultiplicity': targetMultiplicity,
    });
    return next;
  }

  static Map<String, dynamic> updateRelation(
    Map<String, dynamic> model,
    String relationId, {
    String? name,
    String? type,
    String? sourceMultiplicity,
    String? targetMultiplicity,
  }) {
    _validateMultiplicity(sourceMultiplicity);
    _validateMultiplicity(targetMultiplicity);
    final next = _copy(model);
    final relation = _relations(next).cast<Map<String, dynamic>?>().firstWhere(
      (item) => item?['id'] == relationId,
      orElse: () => null,
    );
    if (relation == null) {
      throw const FormatException('Relation does not exist');
    }
    if (name != null) relation['name'] = name.trim();
    if (type != null) relation['type'] = type;
    if (sourceMultiplicity != null) {
      relation['sourceMultiplicity'] = sourceMultiplicity;
    }
    if (targetMultiplicity != null) {
      relation['targetMultiplicity'] = targetMultiplicity;
    }
    return next;
  }

  static Map<String, dynamic> deleteRelation(
    Map<String, dynamic> model,
    String relationId,
  ) {
    final next = _copy(model);
    final relations = _relations(next);
    if (!relations.any((item) => item['id'] == relationId)) {
      throw const FormatException('Relation does not exist');
    }
    relations.removeWhere((item) => item['id'] == relationId);
    return next;
  }

  static Map<String, dynamic> _copy(Map<String, dynamic> model) {
    final copied = Map<String, dynamic>.from(
      jsonDecode(jsonEncode(model)) as Map,
    );
    copied.putIfAbsent('classes', () => <dynamic>[]);
    copied.putIfAbsent('relations', () => <dynamic>[]);
    return copied;
  }

  static List<Map<String, dynamic>> _classes(Map<String, dynamic> model) =>
      (model['classes'] as List).cast<Map<String, dynamic>>();

  static List<Map<String, dynamic>> _relations(Map<String, dynamic> model) =>
      (model['relations'] as List).cast<Map<String, dynamic>>();

  static Map<String, dynamic> _class(
    Map<String, dynamic> model,
    String classId,
  ) {
    final value = _classes(model).cast<Map<String, dynamic>?>().firstWhere(
      (item) => item?['id'] == classId,
      orElse: () => null,
    );
    if (value == null) throw const FormatException('Class does not exist');
    return value;
  }

  static List<Map<String, dynamic>> _members(
    Map<String, dynamic> target,
    String key,
  ) {
    target.putIfAbsent(key, () => <dynamic>[]);
    return (target[key] as List).cast<Map<String, dynamic>>();
  }

  static Set<String> _allIds(Map<String, dynamic> model) {
    final result = <String>{};
    for (final umlClass in _classes(model)) {
      result.add(umlClass['id'] as String);
      for (final key in ['attributes', 'methods']) {
        for (final member in (umlClass[key] as List? ?? const [])) {
          result.add((member as Map)['id'] as String);
        }
      }
    }
    for (final relation in _relations(model)) {
      result.add(relation['id'] as String);
    }
    return result;
  }

  static void _validateMultiplicity(String? value) {
    if (value == null || value.isEmpty) return;
    if (!_multiplicity.hasMatch(value)) {
      throw const FormatException('Invalid UML multiplicity');
    }
  }
}
