import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../ai/model_manager_screen.dart';
import 'app_text.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({required this.controller, super.key});
  final AppController controller;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController apiUrl;

  @override
  void initState() {
    super.initState();
    apiUrl = TextEditingController(text: widget.controller.api.baseUrl);
  }

  @override
  void dispose() {
    apiUrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    String text(String es, String en) => appText(controller.locale, es, en);
    return Scaffold(
      appBar: AppBar(title: Text(text('Configuración', 'Settings'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (controller.profile != null)
            Card(
              child: ListTile(
                minVerticalPadding: 16,
                leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                title: Text(controller.profile!.name),
                subtitle: Text(controller.profile!.email),
              ),
            ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: controller.locale,
            decoration: InputDecoration(
              labelText: text('Idioma', 'Language'),
              border: const OutlineInputBorder(),
              prefixIcon: const Icon(Icons.language_outlined),
            ),
            items: const [
              DropdownMenuItem(value: 'es', child: Text('Español')),
              DropdownMenuItem(value: 'en', child: Text('English')),
            ],
            onChanged: (value) {
              if (value != null) controller.setLocale(value);
            },
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: controller.themeMode,
            decoration: InputDecoration(
              labelText: text('Apariencia', 'Appearance'),
              border: const OutlineInputBorder(),
              prefixIcon: const Icon(Icons.contrast_outlined),
            ),
            items: [
              DropdownMenuItem(
                value: 'system',
                child: Text(text('Sistema', 'System')),
              ),
              DropdownMenuItem(
                value: 'light',
                child: Text(text('Claro', 'Light')),
              ),
              DropdownMenuItem(
                value: 'dark',
                child: Text(text('Oscuro', 'Dark')),
              ),
            ],
            onChanged: (value) {
              if (value != null) controller.setThemeMode(value);
            },
          ),
          const SizedBox(height: 24),
          Card(
            child: ListTile(
              leading: const Icon(Icons.memory_outlined),
              title: Text(text('IA sin conexión', 'Offline AI')),
              subtitle: Text(
                controller.localAi.runtime.ready
                    ? text(
                        'FunctionGemma está listo.',
                        'FunctionGemma is ready.',
                      )
                    : text(
                        'Instala el modelo local y verifica su integridad.',
                        'Install the local model and verify its integrity.',
                      ),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ModelManagerScreen(controller: controller),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: apiUrl,
            keyboardType: TextInputType.url,
            decoration: InputDecoration(
              labelText: text('URL de la API local', 'Local API URL'),
              helperText: text(
                'En un teléfono físico usa la IP local de tu PC.',
                'On a physical phone, use your PC local IP address.',
              ),
              border: const OutlineInputBorder(),
              prefixIcon: const Icon(Icons.settings_ethernet),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              await controller.setApiUrl(apiUrl.text);
              if (mounted) {
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(text('Servidor guardado.', 'Server saved.')),
                  ),
                );
              }
            },
            icon: const Icon(Icons.save_outlined),
            label: Text(text('Guardar servidor', 'Save server')),
          ),
        ],
      ),
    );
  }
}
