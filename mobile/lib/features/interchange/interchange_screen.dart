import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../core/models/artifact_models.dart';
import 'artifact_file_service.dart';

class InterchangeScreen extends StatefulWidget {
  const InterchangeScreen({required this.controller, super.key});
  final AppController controller;

  @override
  State<InterchangeScreen> createState() => _InterchangeScreenState();
}

class _InterchangeScreenState extends State<InterchangeScreen> {
  final files = ArtifactFileService();
  ImportPreviewModel? preview;
  bool busy = false;
  String? message;

  Future<void> export(InterchangeFormat format) async {
    setState(() => busy = true);
    try {
      final file = await widget.controller.api.exportDiagram(
        widget.controller.activeDiagram!.id,
        format,
      );
      await files.save(file);
    } catch (exception) {
      if (mounted) setState(() => message = exception.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> import() async {
    final picked = await files.pickImport();
    if (picked == null) return;
    setState(() => busy = true);
    try {
      final result = await widget.controller.previewDiagramImport(
        name: picked.name,
        format: picked.format,
        content: picked.content,
      );
      if (mounted) setState(() => preview = result);
    } catch (exception) {
      if (mounted) setState(() => message = exception.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canImport =
        widget.controller.activeWorkspace!.roleValue.canEditDiagrams;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Exportar diagrama',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            OutlinedButton(
              onPressed: busy ? null : () => export(InterchangeFormat.xmi),
              child: const Text('Exportar XMI'),
            ),
            OutlinedButton(
              onPressed: busy ? null : () => export(InterchangeFormat.json),
              child: const Text('Exportar JSON'),
            ),
            OutlinedButton(
              onPressed: busy ? null : () => export(InterchangeFormat.zip),
              child: const Text('Exportar ZIP'),
            ),
          ],
        ),
        if (canImport) ...[
          const SizedBox(height: 28),
          Text(
            'Importar modelo',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          const Text(
            'Selecciona XMI 2.5.1, JSON canónico o un ZIP compatible. Primero se mostrará una vista previa.',
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: busy ? null : import,
            icon: const Icon(Icons.file_open_outlined),
            label: const Text('Importar archivo'),
          ),
        ],
        if (busy) ...[
          const SizedBox(height: 16),
          const LinearProgressIndicator(),
        ],
        if (message != null) ...[const SizedBox(height: 12), Text(message!)],
        if (preview != null) ...[
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    preview!.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    '${preview!.acceptedClasses} clases · ${preview!.acceptedRelations} relaciones',
                  ),
                  ...preview!.warnings.map(
                    (item) => Text('Advertencia: $item'),
                  ),
                  ...preview!.unsupported.map(
                    (item) => Text('No compatible: $item'),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () async {
                      await widget.controller.confirmDiagramImport(preview!);
                      if (mounted) {
                        setState(() {
                          message = 'Diagrama importado correctamente.';
                          preview = null;
                        });
                      }
                    },
                    child: const Text('Confirmar importación'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}
