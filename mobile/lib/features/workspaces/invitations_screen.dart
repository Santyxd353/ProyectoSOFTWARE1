import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../app_controller.dart';
import '../../core/models/models.dart';

class InvitationsScreen extends StatefulWidget {
  const InvitationsScreen({required this.controller, super.key});

  final AppController controller;

  @override
  State<InvitationsScreen> createState() => _InvitationsScreenState();
}

class _InvitationsScreenState extends State<InvitationsScreen> {
  final secret = TextEditingController();
  final email = TextEditingController();
  WorkspaceRole role = WorkspaceRole.editor;
  int expiryHours = 168;
  PortableInvitationModel? created;
  String? message;
  bool busy = false;

  @override
  void dispose() {
    secret.dispose();
    email.dispose();
    super.dispose();
  }

  Future<void> claim() async {
    if (secret.text.trim().isEmpty) return;
    setState(() => busy = true);
    try {
      final result = await widget.controller.claimPortableInvitation(
        secret.text,
      );
      if (mounted) {
        setState(() {
          message = result.alreadyAccepted
              ? 'La invitación ya estaba aceptada.'
              : 'Invitación aceptada correctamente.';
        });
      }
    } catch (exception) {
      if (mounted) setState(() => message = exception.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> create() async {
    setState(() => busy = true);
    try {
      final result = await widget.controller.createPortableInvitation(
        role: role,
        expiresInHours: expiryHours,
        email: email.text,
      );
      if (mounted) setState(() => created = result);
    } catch (exception) {
      if (mounted) setState(() => message = exception.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canManage =
        widget.controller.activeWorkspace?.roleValue.canManageMembers ?? false;
    return Scaffold(
      appBar: AppBar(title: const Text('Invitaciones')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Unirse a un proyecto',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('invitation-secret'),
            controller: secret,
            decoration: const InputDecoration(
              labelText: 'Código o enlace de invitación',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: busy ? null : claim,
            icon: const Icon(Icons.login),
            label: const Text('Aceptar invitación'),
          ),
          if (message != null) ...[const SizedBox(height: 12), Text(message!)],
          if (canManage) ...[
            const SizedBox(height: 32),
            Text(
              'Crear invitación',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<WorkspaceRole>(
              initialValue: role,
              decoration: const InputDecoration(
                labelText: 'Rol',
                border: OutlineInputBorder(),
              ),
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
              onChanged: (value) => setState(() => role = value!),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              initialValue: expiryHours,
              decoration: const InputDecoration(
                labelText: 'Vigencia',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 24, child: Text('24 horas')),
                DropdownMenuItem(value: 168, child: Text('7 días')),
                DropdownMenuItem(value: 720, child: Text('30 días')),
              ],
              onChanged: (value) => setState(() => expiryHours = value!),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Correo vinculado (opcional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: busy ? null : create,
              icon: const Icon(Icons.add_link),
              label: const Text('Crear enlace y código'),
            ),
          ],
          if (created != null) ...[
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Código',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    SelectableText(created!.code),
                    const SizedBox(height: 12),
                    const Text(
                      'Enlace',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    SelectableText(created!.url),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      children: [
                        OutlinedButton.icon(
                          onPressed: () => Clipboard.setData(
                            ClipboardData(
                              text: '${created!.url}\nCódigo: ${created!.code}',
                            ),
                          ),
                          icon: const Icon(Icons.copy_outlined),
                          label: const Text('Copiar'),
                        ),
                        FilledButton.icon(
                          onPressed: () => SharePlus.instance.share(
                            ShareParams(
                              text: '${created!.url}\nCódigo: ${created!.code}',
                            ),
                          ),
                          icon: const Icon(Icons.share_outlined),
                          label: const Text('Compartir'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
