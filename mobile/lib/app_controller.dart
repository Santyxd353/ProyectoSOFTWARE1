import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';

import 'core/ai/local_ai_engine.dart';
import 'core/api/api_client.dart';
import 'core/models/models.dart';
import 'core/storage/local_store.dart';
import 'core/sync/sync_coordinator.dart';
import 'core/sync/sync_queue.dart';

class AppController extends ChangeNotifier with WidgetsBindingObserver {
  AppController({
    LocalStore? store,
    LocalAiEngine? localAi,
    ApiClient? apiClient,
  }) : store = store ?? LocalStore(),
       localAi = localAi ?? LocalAiEngine(),
       api = apiClient ?? ApiClient(baseUrl: ''),
       _apiInjected = apiClient != null {
    syncCoordinator = SyncCoordinator(
      store: this.store,
      apply: (operation) => api.applyDiagramOperation(
        diagramId: operation.entityId,
        deviceId: operation.deviceId,
        clientSequence: operation.clientSequence,
        baseVersion: operation.baseVersion,
        baseData: operation.baseData,
        data: operation.payload,
      ),
    );
    syncCoordinator.addListener(_onSyncChanged);
  }

  final LocalStore store;
  final LocalAiEngine localAi;
  final ApiClient api;
  final bool _apiInjected;
  late final SyncCoordinator syncCoordinator;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  List<WorkspaceModel> workspaces = [];
  WorkspaceModel? activeWorkspace;
  DiagramModel? activeDiagram;
  UserProfile? profile;
  WorkspaceMembersModel? workspaceMembers;
  List<WorkspaceInvitationModel> pendingInvitations = [];
  List<SyncOperation> get pendingOperations => syncCoordinator.pending;
  set pendingOperations(List<SyncOperation> value) =>
      syncCoordinator.seed(value);
  SyncStatus get syncStatus => syncCoordinator.status;
  String locale = 'es';
  String themeMode = 'system';
  bool initialized = false;
  bool online = false;
  bool busy = false;
  String? error;
  String? _token;

  bool get signedIn => _token != null;

  Future<void> initialize() async {
    WidgetsBinding.instance.addObserver(this);
    final apiUrl = await store.readApiUrl();
    if (!_apiInjected) api.baseUrl = apiUrl;
    _token = await store.readToken();
    api.token = _token;
    locale = await store.readLocale();
    themeMode = await store.readThemeMode();
    await syncCoordinator.start();
    workspaces = (await store.readJsonList('workspaces'))
        .map(
          (item) =>
              WorkspaceModel.fromJson(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
    final current = await Connectivity().checkConnectivity();
    online = !current.contains(ConnectivityResult.none);
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((
      results,
    ) {
      final next = !results.contains(ConnectivityResult.none);
      if (next != online) {
        online = next;
        notifyListeners();
        if (online && signedIn) unawaited(syncPending());
      }
    });
    if (signedIn && online) {
      await Future.wait([
        refreshWorkspaces(silent: true),
        loadProfile(silent: true),
      ]);
    }
    initialized = true;
    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && online && signedIn) {
      unawaited(syncPending());
    }
  }

  Future<void> login(String email, String password) async {
    await _run(() async {
      final response = await api.login(email, password);
      _token = response['token'] as String;
      api.token = _token;
      await store.saveToken(_token!);
      await Future.wait([
        refreshWorkspaces(silent: true),
        loadProfile(silent: true),
      ]);
    });
  }

  Future<void> register(String name, String email, String password) async {
    await _run(() async {
      final response = await api.register(name, email, password);
      _token = response['token'] as String;
      api.token = _token;
      await store.saveToken(_token!);
      profile = UserProfile.fromJson(
        Map<String, dynamic>.from(response['user'] as Map),
      );
      await refreshWorkspaces(silent: true);
    });
  }

  Future<void> loadProfile({bool silent = false}) async {
    if (!online || !signedIn) return;
    if (!silent) busy = true;
    try {
      profile = await api.getProfile();
      error = null;
    } catch (exception) {
      error = exception.toString();
    } finally {
      if (!silent) busy = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _token = null;
    api.token = null;
    await store.clearToken();
    activeWorkspace = null;
    activeDiagram = null;
    profile = null;
    workspaceMembers = null;
    pendingInvitations = [];
    notifyListeners();
  }

  Future<void> setLocale(String value) async {
    if (value != 'es' && value != 'en') return;
    locale = value;
    await store.saveLocale(value);
    notifyListeners();
  }

  Future<void> setThemeMode(String value) async {
    if (!const {'system', 'light', 'dark'}.contains(value)) return;
    themeMode = value;
    await store.saveThemeMode(value);
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
      await store.saveJsonList(
        'workspaces',
        workspaces.map((item) => item.toJson()).toList(),
      );
      error = null;
    } catch (exception) {
      error = exception.toString();
    } finally {
      if (!silent) busy = false;
      notifyListeners();
    }
  }

  Future<WorkspaceModel> createWorkspace(
    String name,
    String description,
  ) async {
    if (!online) {
      throw StateError('Se necesita conexión para crear un proyecto.');
    }
    busy = true;
    error = null;
    notifyListeners();
    try {
      final workspace = await api.createWorkspace(name, description);
      workspaces = [
        workspace,
        ...workspaces.where((item) => item.id != workspace.id),
      ];
      await store.saveJsonList(
        'workspaces',
        workspaces.map((item) => item.toJson()).toList(),
      );
      return workspace;
    } catch (exception) {
      error = exception.toString();
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<WorkspaceModel> updateActiveWorkspace({
    required String name,
    required String description,
  }) async {
    final current = activeWorkspace;
    if (current == null) throw StateError('No hay un proyecto activo.');
    if (!current.roleValue.canManageMembers) {
      throw StateError('Solo el propietario puede editar el proyecto.');
    }
    final response = await api.updateWorkspace(
      current.id,
      name: name,
      description: description,
    );
    final updated = current.copyWith(
      name: response.name,
      description: response.description,
    );
    activeWorkspace = updated;
    workspaces = workspaces
        .map((item) => item.id == updated.id ? updated : item)
        .toList();
    await store.saveJson('workspace:${updated.id}', updated.toJson());
    notifyListeners();
    return updated;
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
        activeWorkspace = cached == null
            ? null
            : WorkspaceModel.fromJson(cached);
      }
      return activeWorkspace;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> loadWorkspaceMembers() async {
    final workspace = activeWorkspace;
    if (workspace == null || !online) return;
    final members = await api.getWorkspaceMembers(workspace.id);
    final invitations = workspace.roleValue.canManageMembers
        ? await api.getWorkspaceInvitations(workspace.id)
        : <WorkspaceInvitationModel>[];
    workspaceMembers = members;
    pendingInvitations = invitations;
    notifyListeners();
  }

  Future<void> updateMemberRole(
    WorkspaceMemberModel member,
    WorkspaceRole role,
  ) async {
    final workspace = activeWorkspace;
    if (workspace == null || !workspace.roleValue.canManageMembers) {
      throw StateError('Solo el propietario puede cambiar roles.');
    }
    final updated = await api.updateMemberRole(workspace.id, member.id, role);
    final current = workspaceMembers;
    if (current != null) {
      workspaceMembers = WorkspaceMembersModel(
        workspaceId: current.workspaceId,
        currentUserRole: current.currentUserRole,
        allowViewerComments: current.allowViewerComments,
        members: current.members
            .map((item) => item.id == updated.id ? updated : item)
            .toList(),
      );
    }
    notifyListeners();
  }

  Future<void> removeMember(WorkspaceMemberModel member) async {
    final workspace = activeWorkspace;
    if (workspace == null || !workspace.roleValue.canManageMembers) {
      throw StateError('Solo el propietario puede quitar miembros.');
    }
    await api.removeMember(workspace.id, member.id);
    final current = workspaceMembers;
    if (current != null) {
      workspaceMembers = WorkspaceMembersModel(
        workspaceId: current.workspaceId,
        currentUserRole: current.currentUserRole,
        allowViewerComments: current.allowViewerComments,
        members: current.members.where((item) => item.id != member.id).toList(),
      );
    }
    notifyListeners();
  }

  Future<DiagramModel> createDiagram(String name) async {
    final workspace = activeWorkspace;
    if (workspace == null) throw StateError('No hay un proyecto activo.');
    if (!workspace.roleValue.canEditDiagrams) {
      throw StateError('El rol VIEWER no puede crear diagramas.');
    }
    if (!online) {
      throw StateError('Se necesita conexión para crear el diagrama.');
    }
    final diagram = await api.createDiagram(workspace.id, name);
    activeWorkspace = workspace.copyWith(
      diagrams: [diagram, ...workspace.diagrams],
    );
    await store.saveJson(
      'workspace:${workspace.id}',
      activeWorkspace!.toJson(),
    );
    notifyListeners();
    return diagram;
  }

  Future<void> archiveDiagram(String diagramId) async {
    final workspace = activeWorkspace;
    if (workspace == null || !workspace.roleValue.canEditDiagrams) {
      throw StateError('El rol actual no puede archivar diagramas.');
    }
    final archived = await api.archiveDiagram(diagramId);
    activeWorkspace = workspace.copyWith(
      diagrams: workspace.diagrams
          .where((item) => item.id != diagramId)
          .toList(),
      archivedDiagrams: [
        archived,
        ...workspace.archivedDiagrams.where((item) => item.id != diagramId),
      ],
    );
    await store.saveJson(
      'workspace:${workspace.id}',
      activeWorkspace!.toJson(),
    );
    notifyListeners();
  }

  Future<void> restoreDiagram(String diagramId) async {
    final workspace = activeWorkspace;
    if (workspace == null || !workspace.roleValue.canEditDiagrams) {
      throw StateError('El rol actual no puede restaurar diagramas.');
    }
    final restored = await api.restoreDiagram(diagramId);
    activeWorkspace = workspace.copyWith(
      diagrams: [
        restored,
        ...workspace.diagrams.where((item) => item.id != diagramId),
      ],
      archivedDiagrams: workspace.archivedDiagrams
          .where((item) => item.id != diagramId)
          .toList(),
    );
    await store.saveJson(
      'workspace:${workspace.id}',
      activeWorkspace!.toJson(),
    );
    notifyListeners();
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
        return const AiReply(
          message:
              'Esta solicitud necesita conexión. La parte local sigue disponible.',
        );
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
      'metadata': {
        'source': 'claude-mobile',
        'confirmedAt': DateTime.now().toIso8601String(),
      },
    };
    await _saveDiagram(data);
  }

  Future<void> saveDiagramData(Map<String, dynamic> data) async {
    final workspace = activeWorkspace;
    if (workspace == null || !workspace.roleValue.canEditDiagrams) {
      throw StateError('El rol actual no puede editar diagramas.');
    }
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
        'position': {
          'x': 80 + (classes.length % 2) * 260,
          'y': 80 + (classes.length ~/ 2) * 200,
        },
        'attributes': [
          {
            'id': 'id_${DateTime.now().microsecondsSinceEpoch}',
            'name': 'id',
            'type': 'Long',
            'stereotype': 'id',
            'nullable': false,
            'unique': true,
          },
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
        final attributes = List<dynamic>.from(
          target['attributes'] as List? ?? const [],
        );
        attributes.add({
          'id': 'attr_${DateTime.now().microsecondsSinceEpoch}',
          'name': command.arguments['name'],
          'type': 'String',
          'nullable': true,
          'unique': false,
        });
        target['attributes'] = attributes;
      }
    }
    data['classes'] = classes;
    data['relations'] ??= <dynamic>[];
    await _saveDiagram(data);
  }

  Future<void> _saveDiagram(Map<String, dynamic> data) async {
    final diagram = activeDiagram!;
    final baseData = Map<String, dynamic>.from(diagram.data);
    final deviceId = await store.readOrCreateDeviceId();
    final clientSequence = await store.nextClientSequence();
    final operation = SyncOperation(
      id: '$deviceId:$clientSequence',
      entityId: diagram.id,
      deviceId: deviceId,
      clientSequence: clientSequence,
      baseVersion: diagram.version,
      baseData: baseData,
      payload: data,
    );
    await syncCoordinator.enqueue(operation);
    activeDiagram = diagram.copyWith(data: data, version: diagram.version + 1);
    await store.saveJson('diagram:${diagram.id}', activeDiagram!.toJson());
    notifyListeners();
    if (online) await syncPending();
  }

  Future<void> syncPending() async {
    final report = await syncCoordinator.syncNow();
    for (final applied in report.applied) {
      final diagram = activeDiagram;
      if (diagram != null && diagram.id == applied.operation.entityId) {
        activeDiagram = diagram.copyWith(
          version: applied.response['version'] as int? ?? diagram.version,
        );
        await store.saveJson('diagram:${diagram.id}', activeDiagram!.toJson());
      }
    }
    switch (syncCoordinator.status) {
      case SyncStatus.conflict:
        error = report.conflictId == null
            ? 'Conflicto pendiente. Revisa los cambios antes de continuar.'
            : 'Conflicto ${report.conflictId} pendiente. Revisa ambas variantes antes de continuar.';
      case SyncStatus.reviewRequired:
        error =
            'La sesión expiró. Inicia sesión para sincronizar sin perder tus cambios.';
      case SyncStatus.synced:
        error = null;
      case SyncStatus.pending:
        break;
    }
    notifyListeners();
  }

  void _onSyncChanged() => notifyListeners();

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
    WidgetsBinding.instance.removeObserver(this);
    _connectivitySubscription?.cancel();
    syncCoordinator.removeListener(_onSyncChanged);
    syncCoordinator.dispose();
    super.dispose();
  }
}
