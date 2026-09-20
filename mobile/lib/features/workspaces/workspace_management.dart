import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../../core/models/models.dart';
import '../settings/app_text.dart';

Future<void> showCreateWorkspaceDialog(
  BuildContext context,
  AppController controller,
) async {
  final name = TextEditingController();
  final description = TextEditingController();
  String text(String es, String en) => appText(controller.locale, es, en);
  await showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(text('Nuevo proyecto', 'New project')),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: name,
            autofocus: true,
            decoration: InputDecoration(
              labelText: text('Nombre', 'Name'),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: description,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: text('Descripción', 'Description'),
              border: const OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext),
          child: Text(text('Cancelar', 'Cancel')),
        ),
        FilledButton(
          onPressed: () async {
            if (name.text.trim().isEmpty) return;
            await controller.createWorkspace(name.text, description.text);
            if (dialogContext.mounted) Navigator.pop(dialogContext);
          },
          child: Text(text('Crear', 'Create')),
        ),
      ],
    ),
  );
}

Future<void> showCreateDiagramDialog(
  BuildContext context,
  AppController controller,
) async {
  final name = TextEditingController();
  String text(String es, String en) => appText(controller.locale, es, en);
  await showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(text('Nuevo diagrama', 'New diagram')),
      content: TextField(
        controller: name,
        autofocus: true,
        decoration: InputDecoration(
          labelText: text('Nombre', 'Name'),
          border: const OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext),
          child: Text(text('Cancelar', 'Cancel')),
        ),
        FilledButton(
          onPressed: () async {
            if (name.text.trim().isEmpty) return;
            await controller.createDiagram(name.text);
            if (dialogContext.mounted) Navigator.pop(dialogContext);
          },
          child: Text(text('Crear', 'Create')),
        ),
      ],
    ),
  );
}

class ProjectSettingsScreen extends StatefulWidget {
  const ProjectSettingsScreen({required this.controller, super.key});
  final AppController controller;

  @override
  State<ProjectSettingsScreen> createState() => _ProjectSettingsScreenState();
}

class _ProjectSettingsScreenState extends State<ProjectSettingsScreen> {
  late final TextEditingController name;
  late final TextEditingController description;

  @override
  void initState() {
    super.initState();
    final workspace = widget.controller.activeWorkspace!;
    name = TextEditingController(text: workspace.name);
    description = TextEditingController(text: workspace.description);
    widget.controller.loadWorkspaceMembers();
  }

  @override
  void dispose() {
    name.dispose();
    description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final workspace = controller.activeWorkspace!;
    String text(String es, String en) => appText(controller.locale, es, en);
    return Scaffold(
      appBar: AppBar(
        title: Text(text('Proyecto y miembros', 'Project and members')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: name,
            enabled: workspace.roleValue.canManageMembers,
            decoration: InputDecoration(
              labelText: text('Nombre', 'Name'),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: description,
            enabled: workspace.roleValue.canManageMembers,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: text('Descripción', 'Description'),
              border: const OutlineInputBorder(),
            ),
          ),
          if (workspace.roleValue.canManageMembers) ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                await controller.updateActiveWorkspace(
                  name: name.text,
                  description: description.text,
                );
                if (mounted) {
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(
                        text('Proyecto actualizado.', 'Project updated.'),
                      ),
                    ),
                  );
                }
              },
              icon: const Icon(Icons.save_outlined),
              label: Text(text('Guardar cambios', 'Save changes')),
            ),
          ],
          const SizedBox(height: 28),
          Text(
            text('Miembros', 'Members'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          if (controller.workspaceMembers == null)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(),
              ),
            )
          else
            ...controller.workspaceMembers!.members.map((member) {
              final editable =
                  workspace.roleValue.canManageMembers &&
                  member.role != WorkspaceRole.owner;
              return Card(
                child: ListTile(
                  leading: const CircleAvatar(
                    child: Icon(Icons.person_outline),
                  ),
                  title: Text(member.user.name),
                  subtitle: Text(member.user.email),
                  trailing: editable
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            DropdownButton<WorkspaceRole>(
                              value: member.role,
                              items: const [
                                DropdownMenuItem(
                                  value: WorkspaceRole.editor,
                                  child: Text('EDITOR'),
                                ),
                                DropdownMenuItem(
                                  value: WorkspaceRole.viewer,
                                  child: Text('VIEWER'),
                                ),
                              ],
                              onChanged: (role) {
                                if (role != null) {
                                  controller.updateMemberRole(member, role);
                                }
                              },
                            ),
                            IconButton(
                              tooltip: text('Quitar miembro', 'Remove member'),
                              onPressed: () => controller.removeMember(member),
                              icon: Icon(
                                Icons.person_remove_outlined,
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                          ],
                        )
                      : Chip(label: Text(member.role.wire)),
                ),
              );
            }),
          if (workspace.roleValue.canManageMembers) ...[
            const SizedBox(height: 28),
            Text(
              text('Invitaciones pendientes', 'Pending invitations'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (controller.pendingInvitations.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  text(
                    'No hay invitaciones pendientes.',
                    'There are no pending invitations.',
                  ),
                ),
              )
            else
              ...controller.pendingInvitations.map(
                (invitation) => Card(
                  child: ListTile(
                    leading: const Icon(Icons.mark_email_unread_outlined),
                    title: Text(
                      invitation.email ??
                          text(
                            'Enlace o código compartible',
                            'Shareable link or code',
                          ),
                    ),
                    subtitle: Text(
                      '${invitation.role.wire}${invitation.expiresAt == null ? '' : ' · ${invitation.expiresAt}'}',
                    ),
                  ),
                ),
              ),
          ],
          const SizedBox(height: 28),
          Text(
            text('Diagramas archivados', 'Archived diagrams'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          if (workspace.archivedDiagrams.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                text(
                  'No hay diagramas archivados.',
                  'There are no archived diagrams.',
                ),
              ),
            )
          else
            ...workspace.archivedDiagrams.map(
              (diagram) => Card(
                child: ListTile(
                  leading: const Icon(Icons.inventory_2_outlined),
                  title: Text(diagram.name),
                  trailing: workspace.roleValue.canEditDiagrams
                      ? IconButton(
                          tooltip: text('Restaurar', 'Restore'),
                          onPressed: () =>
                              controller.restoreDiagram(diagram.id),
                          icon: const Icon(Icons.restore),
                        )
                      : null,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
