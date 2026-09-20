import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../core/models/artifact_models.dart';
import '../interchange/artifact_file_service.dart';

class GenerationScreen extends StatefulWidget {
  const GenerationScreen({required this.controller, super.key});
  final AppController controller;

  @override
  State<GenerationScreen> createState() => _GenerationScreenState();
}

class _GenerationScreenState extends State<GenerationScreen> {
  final files = ArtifactFileService();
  GeneratedProjectResult? generated;
  bool busy = false;
  String? message;

  Future<void> generate(GeneratedProjectType type) async {
    setState(() => busy = true);
    try {
      final result = await widget.controller.generateProject(type);
      if (mounted) setState(() => generated = result);
    } catch (exception) {
      if (mounted) setState(() => message = exception.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canGenerate =
        widget.controller.activeWorkspace?.roleValue.canEditDiagrams ?? false;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Generación desde el diagrama',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        const Text(
          'Crea una revisión reproducible y conserva el código en el repositorio interno del proyecto.',
        ),
        if (canGenerate) ...[
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: busy
                ? null
                : () => generate(GeneratedProjectType.springBoot),
            icon: const Icon(Icons.dns_outlined),
            label: const Text('Generar Spring Boot'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy
                ? null
                : () => generate(GeneratedProjectType.flutter),
            icon: const Icon(Icons.phone_android_outlined),
            label: const Text('Generar Flutter'),
          ),
        ] else ...[
          const SizedBox(height: 16),
          const Text(
            'Tu rol permite revisar y descargar, pero no generar código.',
          ),
        ],
        if (busy) ...[
          const SizedBox(height: 20),
          const LinearProgressIndicator(),
        ],
        if (message != null) ...[const SizedBox(height: 16), Text(message!)],
        if (generated != null) ...[
          const SizedBox(height: 20),
          Card(
            child: ListTile(
              leading: const Icon(Icons.check_circle_outline),
              title: const Text('Código generado'),
              subtitle: Text('Revisión ${generated!.revisionId}'),
              trailing: IconButton(
                tooltip: 'Descargar y compartir',
                onPressed: () async {
                  final file = await widget.controller.api
                      .downloadGeneratedProject(generated!.generatedCodeId);
                  await files.share(file);
                },
                icon: const Icon(Icons.share_outlined),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
