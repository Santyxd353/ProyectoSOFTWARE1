import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../core/models/artifact_models.dart';
import '../interchange/artifact_file_service.dart';

class RepositoryScreen extends StatefulWidget {
  const RepositoryScreen({required this.controller, super.key});
  final AppController controller;

  @override
  State<RepositoryScreen> createState() => _RepositoryScreenState();
}

class _RepositoryScreenState extends State<RepositoryScreen> {
  final files = ArtifactFileService();
  List<RevisionSummaryModel> revisions = [];
  List<RevisionFileModel> tree = [];
  RevisionSummaryModel? selected;
  RevisionComparisonModel? comparison;
  bool busy = true;
  String? error;

  @override
  void initState() {
    super.initState();
    loadRevisions();
  }

  Future<void> loadRevisions() async {
    final workspace = widget.controller.activeWorkspace!;
    final diagram = widget.controller.activeDiagram!;
    try {
      revisions = await widget.controller.api.listRevisions(
        workspace.id,
        diagramId: diagram.id,
      );
      selected = revisions.isEmpty ? null : revisions.first;
      if (selected != null) await loadTree(selected!);
    } catch (exception) {
      error = exception.toString();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> loadTree(RevisionSummaryModel revision) async {
    selected = revision;
    tree = await widget.controller.api.getRevisionTree(
      revision.workspaceId,
      revision.id,
    );
    if (mounted) setState(() {});
  }

  Future<void> openFile(RevisionFileModel file) async {
    final revision = selected!;
    final content = await widget.controller.api.readRevisionFile(
      revision.workspaceId,
      revision.id,
      file.id,
    );
    final comments = await widget.controller.api.listRevisionComments(
      revision.workspaceId,
      revision.id,
      fileId: file.id,
    );
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _FileReviewSheet(
        controller: widget.controller,
        revision: revision,
        file: content,
        initialComments: comments,
      ),
    );
  }

  Future<void> compareLatest() async {
    if (revisions.length < 2) return;
    comparison = await widget.controller.api.compareRevisions(
      revisions.first.workspaceId,
      revisions[1].id,
      revisions.first.id,
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final canMutate =
        widget.controller.activeWorkspace!.roleValue.canEditDiagrams;
    if (busy) return const Center(child: CircularProgressIndicator());
    if (error != null) return Center(child: Text(error!));
    if (revisions.isEmpty) {
      return const Center(child: Text('Todavía no hay revisiones publicadas.'));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        DropdownButtonFormField<RevisionSummaryModel>(
          initialValue: selected,
          decoration: const InputDecoration(
            labelText: 'Revisión',
            border: OutlineInputBorder(),
          ),
          items: revisions
              .map(
                (item) => DropdownMenuItem(
                  value: item,
                  child: Text('${item.projectType} · v${item.modelVersion}'),
                ),
              )
              .toList(),
          onChanged: (value) {
            if (value != null) loadTree(value);
          },
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: revisions.length > 1 ? compareLatest : null,
              icon: const Icon(Icons.difference_outlined),
              label: const Text('Comparar últimas'),
            ),
            OutlinedButton.icon(
              onPressed: () async {
                final file = await widget.controller.api.downloadRevision(
                  selected!.workspaceId,
                  selected!.id,
                );
                await files.save(file);
              },
              icon: const Icon(Icons.download_outlined),
              label: const Text('Descargar ZIP'),
            ),
            if (canMutate)
              FilledButton.icon(
                onPressed: () async {
                  await widget.controller.restoreCodeRevision(selected!);
                  await loadRevisions();
                },
                icon: const Icon(Icons.restore),
                label: const Text('Restaurar revisión'),
              ),
          ],
        ),
        if (comparison != null) ...[
          const SizedBox(height: 16),
          ...comparison!.files.map(
            (item) => ListTile(
              leading: const Icon(Icons.compare_arrows),
              title: Text(item.path),
              subtitle: Text(item.kind),
            ),
          ),
        ],
        const SizedBox(height: 20),
        Text('Archivos', style: Theme.of(context).textTheme.titleLarge),
        ...tree.map(
          (file) => ListTile(
            leading: Icon(file.isBinary ? Icons.insert_drive_file : Icons.code),
            title: Text(file.path),
            subtitle: Text('${file.size} bytes'),
            onTap: file.isBinary ? null : () => openFile(file),
          ),
        ),
      ],
    );
  }
}

class _FileReviewSheet extends StatefulWidget {
  const _FileReviewSheet({
    required this.controller,
    required this.revision,
    required this.file,
    required this.initialComments,
  });
  final AppController controller;
  final RevisionSummaryModel revision;
  final RevisionFileModel file;
  final List<ReviewCommentModel> initialComments;

  @override
  State<_FileReviewSheet> createState() => _FileReviewSheetState();
}

class _FileReviewSheetState extends State<_FileReviewSheet> {
  final input = TextEditingController();
  late final List<ReviewCommentModel> comments = [...widget.initialComments];

  @override
  Widget build(BuildContext context) {
    final members = widget.controller.workspaceMembers;
    final canComment =
        widget.controller.activeWorkspace!.roleValue.canEditDiagrams ||
        (members?.allowViewerComments ?? false);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(
              widget.file.path,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView(
                children: [
                  SelectableText(widget.file.content ?? ''),
                  const Divider(height: 28),
                  ...comments.map(
                    (item) => ListTile(
                      title: Text(item.body),
                      subtitle: Text(item.authorName),
                    ),
                  ),
                ],
              ),
            ),
            if (canComment)
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: input,
                      decoration: const InputDecoration(
                        labelText: 'Comentario',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  IconButton.filled(
                    onPressed: () async {
                      if (input.text.trim().isEmpty) return;
                      final created = await widget.controller.api
                          .createRevisionComment(
                            widget.revision.workspaceId,
                            widget.revision.id,
                            fileId: widget.file.id,
                            body: input.text,
                          );
                      setState(() => comments.add(created));
                      input.clear();
                    },
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
