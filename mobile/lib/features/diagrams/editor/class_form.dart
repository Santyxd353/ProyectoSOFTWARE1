import 'package:flutter/material.dart';

class ClassForm extends StatefulWidget {
  const ClassForm({
    required this.initialClass,
    required this.onSave,
    super.key,
  });

  final Map<String, dynamic> initialClass;
  final ValueChanged<Map<String, dynamic>> onSave;

  @override
  State<ClassForm> createState() => _ClassFormState();
}

class _ClassFormState extends State<ClassForm> {
  late final TextEditingController name;
  late List<Map<String, dynamic>> attributes;
  late List<Map<String, dynamic>> methods;

  @override
  void initState() {
    super.initState();
    name = TextEditingController(
      text: widget.initialClass['name']?.toString() ?? '',
    );
    attributes = (widget.initialClass['attributes'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    methods = (widget.initialClass['methods'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  Future<void> addAttribute() async {
    final attributeName = TextEditingController();
    final attributeType = TextEditingController(text: 'String');
    final multiplicity = TextEditingController(text: '0..1');
    final value = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Atributo'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                key: const Key('attribute-name'),
                controller: attributeName,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Nombre',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                key: const Key('attribute-type'),
                controller: attributeType,
                decoration: const InputDecoration(
                  labelText: 'Tipo',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: multiplicity,
                decoration: const InputDecoration(
                  labelText: 'Multiplicidad',
                  helperText: '1, 0..1, 1..* o 0..*',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              if (attributeName.text.trim().isEmpty ||
                  attributeType.text.trim().isEmpty) {
                return;
              }
              Navigator.pop(context, {
                'id': 'attr_${DateTime.now().microsecondsSinceEpoch}',
                'name': attributeName.text.trim(),
                'type': attributeType.text.trim(),
                'multiplicity': multiplicity.text.trim(),
                'nullable': true,
                'unique': false,
              });
            },
            child: const Text('Aceptar'),
          ),
        ],
      ),
    );
    if (value != null && mounted) setState(() => attributes.add(value));
    await Future<void>.delayed(kThemeAnimationDuration);
    attributeName.dispose();
    attributeType.dispose();
    multiplicity.dispose();
  }

  Future<void> addMethod() async {
    final methodName = TextEditingController();
    final returnType = TextEditingController(text: 'void');
    final value = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Método'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: methodName,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Nombre',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: returnType,
                decoration: const InputDecoration(
                  labelText: 'Retorno',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              if (methodName.text.trim().isEmpty) return;
              Navigator.pop(context, {
                'id': 'method_${DateTime.now().microsecondsSinceEpoch}',
                'name': methodName.text.trim(),
                'returnType': returnType.text.trim().isEmpty
                    ? 'void'
                    : returnType.text.trim(),
                'visibility': 'public',
                'parameters': <dynamic>[],
              });
            },
            child: const Text('Aceptar'),
          ),
        ],
      ),
    );
    if (value != null && mounted) setState(() => methods.add(value));
    await Future<void>.delayed(kThemeAnimationDuration);
    methodName.dispose();
    returnType.dispose();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: ListView(
      padding: EdgeInsets.fromLTRB(
        16,
        20,
        16,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Clase UML',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        TextField(
          key: const Key('class-name'),
          controller: name,
          decoration: const InputDecoration(
            labelText: 'Nombre de clase',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: Text(
                'Atributos',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton.filledTonal(
              key: const Key('add-attribute'),
              onPressed: addAttribute,
              tooltip: 'Agregar atributo',
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        ...attributes.map(
          (attribute) => ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('${attribute['name']}: ${attribute['type']}'),
            subtitle: Text(attribute['multiplicity']?.toString() ?? ''),
            trailing: IconButton(
              onPressed: () => setState(() => attributes.remove(attribute)),
              tooltip: 'Quitar atributo',
              icon: const Icon(Icons.close),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Text(
                'Métodos',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton.filledTonal(
              onPressed: addMethod,
              tooltip: 'Agregar método',
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        ...methods.map(
          (method) => ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              '${method['name']}(): ${method['returnType'] ?? 'void'}',
            ),
            trailing: IconButton(
              onPressed: () => setState(() => methods.remove(method)),
              tooltip: 'Quitar método',
              icon: const Icon(Icons.close),
            ),
          ),
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          key: const Key('save-class'),
          onPressed: () {
            if (name.text.trim().isEmpty) return;
            widget.onSave({
              ...widget.initialClass,
              'name': name.text.trim(),
              'attributes': attributes,
              'methods': methods,
            });
          },
          icon: const Icon(Icons.save_outlined),
          label: const Text('Guardar clase'),
        ),
      ],
    ),
  );
}
