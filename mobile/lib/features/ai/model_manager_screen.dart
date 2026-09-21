import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../core/ai/local_model_runtime.dart';
import '../settings/app_text.dart';

class ModelManagerScreen extends StatefulWidget {
  const ModelManagerScreen({required this.controller, super.key});

  final AppController controller;

  @override
  State<ModelManagerScreen> createState() => _ModelManagerScreenState();
}

class _ModelManagerScreenState extends State<ModelManagerScreen> {
  bool working = false;

  LocalModelRuntime get runtime => widget.controller.localAi.runtime;

  Future<void> _run(Future<void> Function() action) async {
    if (working) return;
    setState(() => working = true);
    try {
      await action();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo completar la operación: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => working = false);
    }
  }

  Future<void> _importModel() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['task'],
    );
    final path = result?.files.single.path;
    if (path == null) return;
    if (!mounted) return;
    final checksum = TextEditingController(text: functionGemmaSha256);
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Verificar modelo local'),
        content: TextField(
          controller: checksum,
          minLines: 2,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'SHA-256 esperado',
            helperText:
                'Se verificará antes de instalar. El valor inicial corresponde al modelo oficial.',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Verificar e instalar'),
          ),
        ],
      ),
    );
    if (accepted == true && checksum.text.trim().isNotEmpty) {
      await _run(
        () =>
            runtime.installFromFile(path, expectedSha256: checksum.text.trim()),
      );
    }
    checksum.dispose();
  }

  @override
  Widget build(BuildContext context) {
    String text(String es, String en) =>
        appText(widget.controller.locale, es, en);
    return Scaffold(
      appBar: AppBar(title: Text(text('IA en el dispositivo', 'On-device AI'))),
      body: AnimatedBuilder(
        animation: runtime,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          runtime.ready ? Icons.memory : Icons.memory_outlined,
                          color: runtime.ready
                              ? Theme.of(context).colorScheme.primary
                              : null,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'FunctionGemma 270M',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        _StatusChip(status: runtime.status),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      text(
                        'Modelo de 284 MB para interpretar instrucciones y proponer acciones UML sin enviar el contenido a Internet.',
                        '284 MB model for interpreting instructions and proposing UML actions without sending content to the Internet.',
                      ),
                    ),
                    if (runtime.status == LocalModelStatus.loading) ...[
                      const SizedBox(height: 16),
                      LinearProgressIndicator(value: runtime.progress),
                      const SizedBox(height: 6),
                      Text('${(runtime.progress * 100).round()} %'),
                    ],
                    if (runtime.error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        runtime.error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: working || runtime.ready
                  ? null
                  : () => _run(runtime.downloadOfficialModel),
              icon: const Icon(Icons.download_outlined),
              label: Text(
                text('Descargar modelo oficial', 'Download official model'),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: working ? null : _importModel,
              icon: const Icon(Icons.file_open_outlined),
              label: Text(text('Importar archivo .task', 'Import .task file')),
            ),
            if (runtime.ready) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: working ? null : () => _run(runtime.uninstall),
                icon: const Icon(Icons.delete_outline),
                label: Text(text('Quitar modelo local', 'Remove local model')),
              ),
            ],
            const SizedBox(height: 20),
            Text(
              text('Integridad y privacidad', 'Integrity and privacy'),
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            SelectableText(
              'SHA-256\n$functionGemmaSha256',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            Text(
              text(
                'Las acciones se validan contra un catálogo cerrado. Eliminar elementos siempre exige confirmación explícita.',
                'Actions are checked against a closed catalog. Deleting elements always requires explicit confirmation.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final LocalModelStatus status;

  @override
  Widget build(BuildContext context) {
    final label = switch (status) {
      LocalModelStatus.ready => 'Listo',
      LocalModelStatus.loading => 'Cargando',
      LocalModelStatus.error => 'Error',
      LocalModelStatus.unavailable => 'No instalado',
    };
    return Chip(label: Text(label), visualDensity: VisualDensity.compact);
  }
}
