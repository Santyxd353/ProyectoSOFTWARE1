import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../settings/app_text.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({required this.controller, super.key});
  final AppController controller;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    String text(String es, String en) =>
        appText(widget.controller.locale, es, en);
    return Scaffold(
      appBar: AppBar(title: Text(text('Crear cuenta', 'Create account'))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            TextField(
              controller: name,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: text('Nombre', 'Name'),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              decoration: InputDecoration(
                labelText: text('Correo', 'Email'),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: password,
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(
                labelText: text('Contraseña', 'Password'),
                helperText: text(
                  'Mínimo 8 caracteres.',
                  'At least 8 characters.',
                ),
                border: const OutlineInputBorder(),
              ),
            ),
            if (widget.controller.error != null) ...[
              const SizedBox(height: 12),
              Text(
                widget.controller.error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: widget.controller.busy
                  ? null
                  : () async {
                      try {
                        await widget.controller.register(
                          name.text,
                          email.text,
                          password.text,
                        );
                        if (context.mounted) Navigator.pop(context);
                      } catch (_) {}
                    },
              child: widget.controller.busy
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(text('Crear cuenta', 'Create account')),
            ),
          ],
        ),
      ),
    );
  }
}
