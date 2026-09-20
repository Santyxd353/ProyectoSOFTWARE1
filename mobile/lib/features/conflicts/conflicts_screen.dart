import 'dart:convert';

import 'package:flutter/material.dart';

import '../../app_controller.dart';
import 'conflict_merge.dart';

class ConflictsScreen extends StatefulWidget {
  const ConflictsScreen({required this.controller, super.key});

  final AppController controller;

  @override
  State<ConflictsScreen> createState() => _ConflictsScreenState();
}

class _ConflictsScreenState extends State<ConflictsScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
    widget.controller.loadConflicts();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.controller.removeListener(_refresh);
    super.dispose();
  }

  Future<void> resolve(
    SyncConflict conflict,
    ConflictChoice choice, {
    Map<String, dynamic>? merged,
  }) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.controller.resolveConflict(conflict, choice, merged: merged);
      if (mounted) {
        messenger.showSnackBar(
          const SnackBar(content: Text('Conflicto resuelto.')),
        );
      }
    } catch (exception) {
      if (mounted) {
        messenger.showSnackBar(SnackBar(content: Text(exception.toString())));
      }
    }
  }

  Future<void> mergeManually(SyncConflict conflict) async {
    final input = TextEditingController(
      text: const JsonEncoder.withIndent('  ').convert(conflict.local),
    );
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Combinar variantes'),
        content: SizedBox(
          width: 520,
          child: TextField(
            controller: input,
            minLines: 12,
            maxLines: 20,
            decoration: const InputDecoration(
              helperText: 'Edita el JSON final antes de confirmar.',
              border: OutlineInputBorder(),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              try {
                Navigator.pop(
                  context,
                  Map<String, dynamic>.from(jsonDecode(input.text) as Map),
                );
              } catch (_) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('El JSON no es válido.')),
                );
              }
            },
            child: const Text('Usar combinación'),
          ),
        ],
      ),
    );
    input.dispose();
    if (result != null) {
      await resolve(conflict, ConflictChoice.merged, merged: result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final conflicts = widget.controller.conflicts;
    final canResolve =
        widget.controller.activeWorkspace?.roleValue.canEditDiagrams ?? false;
    return Scaffold(
      appBar: AppBar(title: const Text('Conflictos de sincronización')),
      body: conflicts.isEmpty
          ? const Center(child: Text('No hay conflictos pendientes.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: conflicts.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final conflict = conflicts[index];
                return Card(
                  child: ExpansionTile(
                    leading: const Icon(Icons.merge_type),
                    title: Text('Versión base ${conflict.baseVersion}'),
                    subtitle: Text(
                      'Autor: ${conflict.authorId.isEmpty ? 'desconocido' : conflict.authorId} · secuencia ${conflict.serverSequence}',
                    ),
                    childrenPadding: const EdgeInsets.all(16),
                    children: [
                      _Variant(title: 'Base', data: conflict.base),
                      _Variant(title: 'Local', data: conflict.local),
                      _Variant(title: 'Remota', data: conflict.remote),
                      if (canResolve)
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            OutlinedButton(
                              onPressed: () =>
                                  resolve(conflict, ConflictChoice.local),
                              child: const Text('Usar local'),
                            ),
                            OutlinedButton(
                              onPressed: () =>
                                  resolve(conflict, ConflictChoice.remote),
                              child: const Text('Usar remota'),
                            ),
                            FilledButton(
                              onPressed: () => mergeManually(conflict),
                              child: const Text('Combinar manualmente'),
                            ),
                          ],
                        ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

class _Variant extends StatelessWidget {
  const _Variant({required this.title, required this.data});

  final String title;
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Align(
      alignment: Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          SelectableText(const JsonEncoder.withIndent('  ').convert(data)),
        ],
      ),
    ),
  );
}
