import 'package:flutter/material.dart';

import '../../app_controller.dart';
import '../interchange/interchange_screen.dart';
import '../repository/repository_screen.dart';
import 'generation_screen.dart';

class ArtifactHubScreen extends StatelessWidget {
  const ArtifactHubScreen({required this.controller, super.key});

  final AppController controller;

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Código y portabilidad'),
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Generación'),
            Tab(text: 'Repositorio'),
            Tab(text: 'Intercambio'),
          ],
        ),
      ),
      body: TabBarView(
        children: [
          GenerationScreen(controller: controller),
          RepositoryScreen(controller: controller),
          InterchangeScreen(controller: controller),
        ],
      ),
    ),
  );
}
