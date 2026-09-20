import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart';

import 'app_controller.dart';
import 'features/auth/register_screen.dart';
import 'features/settings/app_text.dart';
import 'features/settings/settings_screen.dart';
import 'features/workspaces/workspace_management.dart';

class ProyectoSoftwareApp extends StatefulWidget {
  const ProyectoSoftwareApp({super.key});
  @override
  State<ProyectoSoftwareApp> createState() => _ProyectoSoftwareAppState();
}

class _ProyectoSoftwareAppState extends State<ProyectoSoftwareApp> {
  final controller = AppController();

  @override
  void initState() {
    super.initState();
    controller.addListener(_refresh);
    controller.initialize();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    controller.removeListener(_refresh);
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF0F766E);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'ProyectoSoftware1',
      themeMode: switch (controller.themeMode) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      },
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: seed),
        scaffoldBackgroundColor: const Color(0xFFF7F8FA),
        useMaterial3: true,
        cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero),
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: seed,
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF0B1117),
        useMaterial3: true,
        cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero),
      ),
      home: !controller.initialized
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : controller.signedIn
          ? ProjectsScreen(controller: controller)
          : LoginScreen(controller: controller),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({required this.controller, super.key});
  final AppController controller;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();

  @override
  Widget build(BuildContext context) {
    String text(String es, String en) =>
        appText(widget.controller.locale, es, en);
    return Scaffold(
      appBar: AppBar(
        actions: [
          TextButton.icon(
            onPressed: () => widget.controller.setLocale(
              widget.controller.locale == 'es' ? 'en' : 'es',
            ),
            icon: const Icon(Icons.language_outlined),
            label: Text(widget.controller.locale == 'es' ? 'EN' : 'ES'),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                shape: RoundedRectangleBorder(
                  side: BorderSide(
                    color: Theme.of(context).colorScheme.outlineVariant,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Icon(
                        Icons.account_tree_outlined,
                        size: 42,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'ProyectoSoftware1',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        text(
                          'Modelado UML colaborativo',
                          'Collaborative UML modeling',
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      TextField(
                        controller: email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: InputDecoration(
                          labelText: text('Correo', 'Email'),
                          border: const OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: password,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        decoration: InputDecoration(
                          labelText: text('Contraseña', 'Password'),
                          border: const OutlineInputBorder(),
                        ),
                      ),
                      if (widget.controller.error != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          widget.controller.error!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: widget.controller.busy
                            ? null
                            : () async {
                                try {
                                  await widget.controller.login(
                                    email.text,
                                    password.text,
                                  );
                                } catch (_) {}
                              },
                        child: widget.controller.busy
                            ? const SizedBox.square(
                                dimension: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(text('Iniciar sesión', 'Sign in')),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                RegisterScreen(controller: widget.controller),
                          ),
                        ),
                        child: Text(text('Crear cuenta', 'Create account')),
                      ),
                      const SizedBox(height: 10),
                      TextButton.icon(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                SettingsScreen(controller: widget.controller),
                          ),
                        ),
                        icon: const Icon(Icons.lan_outlined),
                        label: Text(
                          text(
                            'Configurar servidor local',
                            'Configure local server',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ProjectsScreen extends StatelessWidget {
  const ProjectsScreen({required this.controller, super.key});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    String text(String es, String en) => appText(controller.locale, es, en);
    return Scaffold(
      appBar: AppBar(
        title: Text(text('Mis proyectos', 'My projects')),
        actions: [
          ConnectionBadge(
            online: controller.online,
            queued: controller.pendingOperations.length,
          ),
          IconButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => SettingsScreen(controller: controller),
              ),
            ),
            tooltip: text('Configuración', 'Settings'),
            icon: const Icon(Icons.settings_outlined),
          ),
          IconButton(
            onPressed: controller.logout,
            tooltip: text('Cerrar sesión', 'Sign out'),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: controller.refreshWorkspaces,
        child: controller.workspaces.isEmpty
            ? ListView(
                children: [
                  const SizedBox(height: 180),
                  const Icon(Icons.folder_off_outlined, size: 48),
                  const SizedBox(height: 12),
                  Center(
                    child: Text(
                      text('No hay proyectos guardados', 'No saved projects'),
                    ),
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: controller.workspaces.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final workspace = controller.workspaces[index];
                  return Card(
                    shape: RoundedRectangleBorder(
                      side: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant,
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      leading: CircleAvatar(
                        child: Text(
                          workspace.name.characters.first.toUpperCase(),
                        ),
                      ),
                      title: Text(
                        workspace.name,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        workspace.description.isEmpty
                            ? workspace.role
                            : '${workspace.description}\n${workspace.role}',
                        maxLines: 2,
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        final result = await controller.openWorkspace(
                          workspace.id,
                        );
                        if (context.mounted && result != null) {
                          await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) =>
                                  WorkspaceScreen(controller: controller),
                            ),
                          );
                        }
                      },
                    ),
                  );
                },
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: controller.online
            ? () => showCreateWorkspaceDialog(context, controller)
            : null,
        icon: const Icon(Icons.create_new_folder_outlined),
        label: Text(text('Nuevo proyecto', 'New project')),
      ),
    );
  }
}

class WorkspaceScreen extends StatelessWidget {
  const WorkspaceScreen({required this.controller, super.key});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final workspace = controller.activeWorkspace!;
    String text(String es, String en) => appText(controller.locale, es, en);
    return Scaffold(
      appBar: AppBar(
        title: Text(workspace.name),
        actions: [
          ConnectionBadge(
            online: controller.online,
            queued: controller.pendingOperations.length,
          ),
          IconButton(
            tooltip: text('Proyecto y miembros', 'Project and members'),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ProjectSettingsScreen(controller: controller),
              ),
            ),
            icon: const Icon(Icons.manage_accounts_outlined),
          ),
        ],
      ),
      body: workspace.diagrams.isEmpty
          ? Center(
              child: Text(
                text(
                  'Este proyecto no tiene diagramas activos',
                  'This project has no active diagrams',
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: workspace.diagrams.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final diagram = workspace.diagrams[index];
                return Card(
                  shape: RoundedRectangleBorder(
                    side: BorderSide(
                      color: Theme.of(context).colorScheme.outlineVariant,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ListTile(
                    leading: const Icon(Icons.schema_outlined),
                    title: Text(diagram.name),
                    subtitle: Text('Versión ${diagram.version}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (workspace.roleValue.canEditDiagrams)
                          IconButton(
                            tooltip: text('Archivar', 'Archive'),
                            onPressed: () async {
                              await controller.archiveDiagram(diagram.id);
                            },
                            icon: const Icon(Icons.archive_outlined),
                          ),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                    onTap: () async {
                      final opened = await controller.openDiagram(diagram.id);
                      if (context.mounted && opened != null) {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                DiagramScreen(controller: controller),
                          ),
                        );
                      }
                    },
                  ),
                );
              },
            ),
      floatingActionButton: workspace.roleValue.canEditDiagrams
          ? FloatingActionButton.extended(
              onPressed: controller.online
                  ? () => showCreateDiagramDialog(context, controller)
                  : null,
              icon: const Icon(Icons.add_chart_outlined),
              label: Text(text('Nuevo diagrama', 'New diagram')),
            )
          : null,
    );
  }
}

class DiagramScreen extends StatefulWidget {
  const DiagramScreen({required this.controller, super.key});
  final AppController controller;
  @override
  State<DiagramScreen> createState() => _DiagramScreenState();
}

class _DiagramScreenState extends State<DiagramScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(refresh);
  }

  void refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.controller.removeListener(refresh);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final diagram = widget.controller.activeDiagram!;
    final classes = diagram.data['classes'] as List? ?? const [];
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(diagram.name),
            Text(
              'v${diagram.version}',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
        actions: [
          ConnectionBadge(
            online: widget.controller.online,
            queued: widget.controller.pendingOperations.length,
          ),
        ],
      ),
      body: classes.isEmpty
          ? const Center(
              child: Text('No hay clases. Pídele a la IA que cree una.'),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: classes.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) => ClassCard(
                data: Map<String, dynamic>.from(classes[index] as Map),
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          builder: (_) => AiAssistantSheet(controller: widget.controller),
        ),
        icon: const Icon(Icons.auto_awesome),
        label: const Text('IA'),
      ),
    );
  }
}

class ClassCard extends StatelessWidget {
  const ClassCard({required this.data, super.key});
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) {
    final attributes = data['attributes'] as List? ?? const [];
    return Card(
      shape: RoundedRectangleBorder(
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.view_in_ar_outlined, size: 20),
                const SizedBox(width: 8),
                Text(
                  data['name']?.toString() ?? 'Clase',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            if (attributes.isEmpty)
              const Text('Sin atributos')
            else
              ...attributes.map((item) {
                final attribute = Map<String, dynamic>.from(item as Map);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '${attribute['name']}: ${attribute['type'] ?? 'String'}',
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class AiAssistantSheet extends StatefulWidget {
  const AiAssistantSheet({required this.controller, super.key});
  final AppController controller;
  @override
  State<AiAssistantSheet> createState() => _AiAssistantSheetState();
}

class _AiAssistantSheetState extends State<AiAssistantSheet> {
  final input = TextEditingController();
  final speech = SpeechToText();
  final tts = FlutterTts();
  final messages = <({bool user, String text})>[];
  Map<String, dynamic>? proposal;
  bool sending = false;
  bool listening = false;

  Future<void> send() async {
    final text = input.text.trim();
    if (text.isEmpty || sending) return;
    setState(() {
      messages.add((user: true, text: text));
      sending = true;
      input.clear();
    });
    try {
      final reply = await widget.controller.askAi(text);
      if (mounted) {
        setState(() {
          messages.add((user: false, text: reply.message));
          proposal = reply.proposedModel;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => messages.add((
            user: false,
            text: 'No pude completar la solicitud: $error',
          )),
        );
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> toggleListening() async {
    if (listening) {
      await speech.stop();
      setState(() => listening = false);
      return;
    }
    final available = await speech.initialize();
    if (!available) return;
    setState(() => listening = true);
    await speech.listen(
      onResult: (result) => setState(() => input.text = result.recognizedWords),
      listenOptions: SpeechListenOptions(
        localeId: 'es_BO',
        onDevice: true,
        listenMode: ListenMode.dictation,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: SizedBox(
      height: MediaQuery.sizeOf(context).height * .82,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 10),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Asistente IA',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                ),
                ConnectionBadge(
                  online: widget.controller.online,
                  queued: widget.controller.pendingOperations.length,
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final message = messages[index];
                return Align(
                  alignment: message.user
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    constraints: const BoxConstraints(maxWidth: 330),
                    decoration: BoxDecoration(
                      color: message.user
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(
                              context,
                            ).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            message.text,
                            style: TextStyle(
                              color: message.user
                                  ? Theme.of(context).colorScheme.onPrimary
                                  : null,
                            ),
                          ),
                        ),
                        if (!message.user)
                          IconButton(
                            onPressed: () async {
                              await tts.setLanguage('es-BO');
                              await tts.speak(message.text);
                            },
                            tooltip: 'Escuchar',
                            icon: const Icon(
                              Icons.volume_up_outlined,
                              size: 18,
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          if (proposal != null)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(
                  color: Theme.of(context).colorScheme.primary,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Claude generó una propuesta. Confirma antes de reemplazar el diagrama.',
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => setState(() => proposal = null),
                        child: const Text('Descartar'),
                      ),
                      FilledButton(
                        onPressed: () async {
                          await widget.controller.applyProposal(proposal!);
                          if (mounted) setState(() => proposal = null);
                        },
                        child: const Text('Aplicar'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              children: [
                IconButton.filledTonal(
                  onPressed: toggleListening,
                  tooltip: listening
                      ? 'Detener dictado'
                      : 'Dictar sin conexión',
                  icon: Icon(listening ? Icons.mic : Icons.mic_none),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: input,
                    onSubmitted: (_) => send(),
                    decoration: const InputDecoration(
                      hintText: 'Escribe o dicta una instrucción…',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: sending ? null : send,
                  icon: sending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class ConnectionBadge extends StatelessWidget {
  const ConnectionBadge({
    required this.online,
    required this.queued,
    super.key,
  });
  final bool online;
  final int queued;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 8),
    child: Chip(
      avatar: Icon(
        online ? Icons.cloud_done_outlined : Icons.cloud_off_outlined,
        size: 17,
      ),
      label: Text(
        online
            ? (queued == 0 ? 'En línea' : '$queued pendientes')
            : 'Sin conexión',
      ),
      visualDensity: VisualDensity.compact,
    ),
  );
}

Future<void> showApiDialog(
  BuildContext context,
  AppController controller,
) async {
  final input = TextEditingController(text: controller.api.baseUrl);
  await showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Servidor local'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'En un teléfono físico usa la IP local de tu PC, por ejemplo http://192.168.1.20:3002/api.',
          ),
          const SizedBox(height: 14),
          TextField(
            controller: input,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(
              labelText: 'URL de la API',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () async {
            await controller.setApiUrl(input.text);
            if (context.mounted) Navigator.pop(context);
          },
          child: const Text('Guardar'),
        ),
      ],
    ),
  );
}
