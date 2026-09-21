import 'package:flutter/material.dart';

class RelationForm extends StatefulWidget {
  const RelationForm({
    required this.classes,
    required this.onSave,
    this.initialRelation,
    super.key,
  });

  final List<Map<String, dynamic>> classes;
  final Map<String, dynamic>? initialRelation;
  final ValueChanged<Map<String, dynamic>> onSave;

  @override
  State<RelationForm> createState() => _RelationFormState();
}

class _RelationFormState extends State<RelationForm> {
  late String source;
  late String target;
  late String type;
  late final TextEditingController name;
  late final TextEditingController sourceMultiplicity;
  late final TextEditingController targetMultiplicity;

  @override
  void initState() {
    super.initState();
    final relation = widget.initialRelation;
    source =
        relation?['sourceClassId']?.toString() ??
        widget.classes.first['id'].toString();
    target =
        relation?['targetClassId']?.toString() ??
        widget.classes.last['id'].toString();
    type = relation?['type']?.toString() ?? 'ASSOCIATION';
    name = TextEditingController(text: relation?['name']?.toString() ?? '');
    sourceMultiplicity = TextEditingController(
      text: relation?['sourceMultiplicity']?.toString() ?? '1',
    );
    targetMultiplicity = TextEditingController(
      text: relation?['targetMultiplicity']?.toString() ?? '1',
    );
  }

  @override
  void dispose() {
    name.dispose();
    sourceMultiplicity.dispose();
    targetMultiplicity.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Relación UML',
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
        DropdownButtonFormField<String>(
          initialValue: source,
          decoration: const InputDecoration(
            labelText: 'Origen',
            border: OutlineInputBorder(),
          ),
          items: widget.classes
              .map(
                (item) => DropdownMenuItem(
                  value: item['id'].toString(),
                  child: Text(item['name'].toString()),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() => source = value ?? source),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: target,
          decoration: const InputDecoration(
            labelText: 'Destino',
            border: OutlineInputBorder(),
          ),
          items: widget.classes
              .map(
                (item) => DropdownMenuItem(
                  value: item['id'].toString(),
                  child: Text(item['name'].toString()),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() => target = value ?? target),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: type,
          decoration: const InputDecoration(
            labelText: 'Tipo',
            border: OutlineInputBorder(),
          ),
          items:
              const [
                    'ASSOCIATION',
                    'AGGREGATION',
                    'COMPOSITION',
                    'INHERITANCE',
                    'DEPENDENCY',
                  ]
                  .map(
                    (value) =>
                        DropdownMenuItem(value: value, child: Text(value)),
                  )
                  .toList(),
          onChanged: (value) => setState(() => type = value ?? type),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: name,
          decoration: const InputDecoration(
            labelText: 'Nombre',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: sourceMultiplicity,
                decoration: const InputDecoration(
                  labelText: 'Multiplicidad origen',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: targetMultiplicity,
                decoration: const InputDecoration(
                  labelText: 'Multiplicidad destino',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: () => widget.onSave({
            ...?widget.initialRelation,
            'sourceClassId': source,
            'targetClassId': target,
            'type': type,
            'name': name.text.trim(),
            'sourceMultiplicity': sourceMultiplicity.text.trim(),
            'targetMultiplicity': targetMultiplicity.text.trim(),
          }),
          icon: const Icon(Icons.save_outlined),
          label: const Text('Guardar relación'),
        ),
      ],
    ),
  );
}
