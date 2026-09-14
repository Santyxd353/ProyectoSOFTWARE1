import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import 'core/ai/local_ai_engine.dart';
import 'core/api/api_client.dart';
import 'core/models/models.dart';
import 'core/storage/local_store.dart';
import 'core/sync/sync_queue.dart';

class AppController extends ChangeNotifier {
  AppController({LocalStore? store, LocalAiEngine? localAi})
      : store = store ?? LocalStore(),
        localAi = localAi ?? LocalAiEngine();

  final LocalStore store;
  final LocalAiEngine localAi;
  late ApiClient api;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  List<WorkspaceModel> workspaces = [];
  WorkspaceModel? activeWorkspace;
  DiagramModel? activeDiagram;
  List<SyncOperation> pendingOperations = [];
  bool initialized = false;
  bool online = false;
  bool busy = false;
  String? error;
  String? _token;

  bool get signedIn => _token != null;

  Future<void> initialize() async {
    final apiUrl = await store.readApiUrl();
    api = ApiClient(baseUrl: apiUrl);
    _token = await store.readToken();
    api.token = _token;
    pendingOperations = await store.readQueue();
    workspaces = (await store.readJsonList('workspaces'))
        .map((item) => WorkspaceModel.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
    final current = await Connectivity().checkConnectivity();
    online = !current.contains(ConnectivityResult.none);
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((results) {
      final next = !results.contains(ConnectivityResult.none);
      if (next != online) {
        online = next;
        notifyListeners();
        if (online && signedIn) unawaited(syncPending());
      }
    });
    if (signedIn && online) await refreshWorkspaces(silent: true);
    initialized = true;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    await _run(() async {
      final response = await api.login(email, password);
      _token = response['token'] as String;
      api.token = _token;
      await store.saveToken(_token!);
      await refreshWorkspaces(silent: true);
    });
  }

  Future<void> logout() async {
    _token = null;
    api.token = null;
    await store.clearToken();
    activeWorkspace = null;
    activeDiagram = null;
    notifyListeners();
  }

  Future<void> setApiUrl(String value) async {
    final normalized = value.trim().replaceFirst(RegExp(r'/+$'), '');
    api.baseUrl = normalized;
    await store.saveApiUrl(normalized);
    notifyListeners();
  }

  Future<void> refreshWorkspaces({bool silent = false}) async {
    if (!online) return;
    if (!silent) busy = true;
    try {
      workspaces = await api.getWorkspaces();
      await store.saveJsonList('workspaces', workspaces.map((item) => item.toJson()).toList());
      error = null;
    } catch (exception) {
      error = exception.toString();
    } finally {
      if (!silent) busy = false;
      notifyListeners();
    }
  }

  Future<WorkspaceModel?> openWorkspace(String id) async {
    busy = true;
    notifyListeners();
    try {
      if (online) {
        activeWorkspace = await api.getWorkspace(id);
        await store.saveJson('workspace:$id', activeWorkspace!.toJson());
      } else {
        final cached = await store.readJson('workspace:$id');
        activeWorkspace = cached == null ? null : WorkspaceModel.fromJson(cached);
      }
      return activeWorkspace;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<DiagramModel?> openDiagram(String id) async {
    busy = true;
    notifyListeners();
    try {
      if (online) {
        activeDiagram = await api.getDiagram(id);
        await store.saveJson('diagram:$id', activeDiagram!.toJson());
      } else {
        final cached = await store.readJson('diagram:$id');
        activeDiagram = cached == null ? null : DiagramModel.fromJson(cached);
      }
      return activeDiagram;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<AiReply> askAi(String message) async {
    final local = localAi.respond(message);
    if (local.requiresCloud) {
      if (!online) {
        return const AiReply(message: 'Esta solicitud necesita conexión. La parte local sigue disponible.');
      }
      final response = await api.chat(activeDiagram!.id, message);
      return AiReply(
        message: response['response'] as String? ?? 'Propuesta generada.',
        proposedModel: response['model'] == null
            ? null
            : Map<String, dynamic>.from(response['model'] as Map),
      );
    }
    if (local.command != null) {
      await _applyLocalCommand(local.command!);
      return AiReply(message: local.message, localCommandApplied: true);
    }
    return AiReply(message: local.message);
  }

  Future<void> applyProposal(Map<String, dynamic> model) async {
    final data = {
      'classes': List<dynamic>.from(model['classes'] as List? ?? const []),
      'relations': List<dynamic>.from(model['relations'] as List? ?? const []),
      'metadata': {'source': 'claude-mobile', 'confirmedAt': DateTime.now().toIso8601String()},
    };
    await _saveDiagram(data);
  }

  Future<void> _applyLocalCommand(LocalCommand command) async {
    if (activeDiagram == null) return;
    final data = Map<String, dynamic>.from(activeDiagram!.data);
    final classes = (data['classes'] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    if (command.type == LocalCommandType.createClass) {
      final name = command.arguments['name']!;
      classes.add({
        'id': 'mobile_${DateTime.now().microsecondsSinceEpoch}',
        'name': name,
        'position': {'x': 80 + (classes.length % 2) * 260, 'y': 80 + (classes.length ~/ 2) * 200},
        'attributes': [
          {'id': 'id_${DateTime.now().microsecondsSinceEpoch}', 'name': 'id', 'type': 'Long', 'stereotype': 'id', 'nullable': false, 'unique': true},
        ],
        'methods': <dynamic>[],
      });
    } else if (command.type == LocalCommandType.addAttribute) {
      final className = command.arguments['className']!.toLowerCase();
      final target = classes.cast<Map<String, dynamic>?>().firstWhere(
        (item) => item!['name'].toString().toLowerCase() == className,
        orElse: () => null,
      );
      if (target != null) {
        final attributes = List<dynamic>.from(target['attributes'] as List? ?? const []);
        attributes.add({'id': 'attr_${DateTime.now().microsecondsSinceEpoch}', 'name': command.arguments['name'], 'type': 'String', 'nullable': true, 'unique': false});
        target['attributes'] = attributes;
      }
    }
    data['classes'] = classes;
    data['relations'] ??= <dynamic>[];
    await _saveDiagram(data);
  }

  Future<void> _saveDiagram(Map<String, dynamic> data) async {
    final diagram = activeDiagram!;
    activeDiagram = diagram.copyWith(data: data, version: diagram.version + 1);
    await store.saveJson('diagram:${diagram.id}', activeDiagram!.toJson());
    notifyListeners();
    if (online) {
      try {
        activeDiagram = await api.updateDiagram(diagram.id, data);
        await store.saveJson('diagram:${diagram.id}', activeDiagram!.toJson());
        notifyListeners();
        return;
      } catch (_) {}
    }
    pendingOperations.add(SyncOperation(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      entityId: diagram.id,
      baseVersion: diagram.version,
      payload: data,
    ));
    await store.saveQueue(pendingOperations);
    notifyListeners();
  }

  Future<void> syncPending() async {
    for (final operation in List<SyncOperation>.from(pendingOperations)) {
      try {
        await api.updateDiagram(operation.entityId, operation.payload);
        pendingOperations.removeWhere((item) => item.id == operation.id);
        await store.saveQueue(pendingOperations);
      } on ApiException catch (exception) {
        if (exception.statusCode == 409) {
          error = 'Conflicto pendiente en ${operation.entityId}. Revisa los cambios antes de continuar.';
          break;
        }
      }
    }
    notifyListeners();
  }

  Future<void> _run(Future<void> Function() action) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await action();
    } catch (exception) {
      error = exception.toString();
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    super.dispose();
  }
}
