import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../sync/sync_queue.dart';

abstract class RealtimeTransport {
  void configure({required String url, required String token});
  void on(String event, void Function(dynamic) handler);
  void connect();
  void disconnect();
  Future<dynamic> emitWithAck(String event, Map<String, dynamic> data);
}

class SocketIoRealtimeTransport implements RealtimeTransport {
  io.Socket? _socket;
  final Map<String, void Function(dynamic)> _handlers = {};

  @override
  void configure({required String url, required String token}) {
    _socket?.dispose();
    _socket = io.io(
      url,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setAuth({'token': token})
          .build(),
    );
    for (final entry in _handlers.entries) {
      _socket!.on(entry.key, entry.value);
    }
  }

  @override
  void on(String event, void Function(dynamic) handler) {
    _handlers[event] = handler;
    _socket?.on(event, handler);
  }

  @override
  void connect() => _socket?.connect();

  @override
  void disconnect() => _socket?.disconnect();

  @override
  Future<dynamic> emitWithAck(String event, Map<String, dynamic> data) async {
    final socket = _socket;
    if (socket == null) {
      throw StateError('Realtime transport is not configured');
    }
    final completer = Completer<dynamic>();
    socket.emitWithAck(
      event,
      data,
      ack: (value) {
        if (!completer.isCompleted) {
          completer.complete(value);
        }
      },
    );
    return completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () =>
          throw TimeoutException('Realtime acknowledgement timed out'),
    );
  }
}

class CollaboratorPresence {
  const CollaboratorPresence({
    required this.userId,
    required this.name,
    required this.socketId,
  });

  final String userId;
  final String name;
  final String socketId;
}

class RealtimeClient extends ChangeNotifier {
  RealtimeClient({RealtimeTransport? transport, required this.onDurableEvent})
    : transport = transport ?? SocketIoRealtimeTransport() {
    _bindEvents();
  }

  final RealtimeTransport transport;
  final void Function(Map<String, dynamic>) onDurableEvent;
  final Map<String, CollaboratorPresence> _presence = {};
  String? _diagramId;
  bool connected = false;
  int lastSequence = 0;

  List<CollaboratorPresence> get presence =>
      List.unmodifiable(_presence.values);

  Future<void> connect({
    required String apiBaseUrl,
    required String token,
  }) async {
    connected = false;
    _presence.clear();
    final uri = Uri.parse(apiBaseUrl);
    final path = uri.path.replaceFirst(RegExp(r'/api/?$'), '/collaboration');
    transport.configure(
      url: uri.replace(path: path).toString(),
      token: token,
    );
    transport.connect();
  }

  Future<void> joinDiagram(String diagramId, {int afterSequence = 0}) async {
    if (_diagramId != diagramId) {
      lastSequence = afterSequence;
      _presence.clear();
    }
    _diagramId = diagramId;
    if (afterSequence > lastSequence) lastSequence = afterSequence;
    if (connected) await _joinCurrent();
  }

  Future<void> leaveDiagram() async {
    final diagramId = _diagramId;
    _diagramId = null;
    _presence.clear();
    if (diagramId != null && connected) {
      await transport.emitWithAck('leave_diagram', {'diagramId': diagramId});
    }
    notifyListeners();
  }

  Future<void> publishConfirmed(SyncOperation operation) async {
    if (!connected || _diagramId != operation.entityId) return;
    await transport.emitWithAck('diagram_change', {
      'diagramId': operation.entityId,
      'deviceId': operation.deviceId,
      'clientSequence': operation.clientSequence,
      'baseVersion': operation.baseVersion,
      'baseData': operation.baseData,
      'changes': {'type': 'full_update', 'data': operation.payload},
    });
  }

  void _bindEvents() {
    transport.on('connect', (_) {
      connected = true;
      notifyListeners();
      if (_diagramId != null) unawaited(_joinCurrent());
    });
    transport.on('disconnect', (_) {
      connected = false;
      _presence.clear();
      notifyListeners();
    });
    transport.on('user_joined', (data) {
      final map = Map<String, dynamic>.from(data as Map);
      final presence = CollaboratorPresence(
        userId: map['userId'] as String,
        name: map['userName'] as String? ?? 'Colaborador',
        socketId: map['socketId'] as String? ?? '',
      );
      _presence[presence.userId] = presence;
      notifyListeners();
    });
    transport.on('user_left', (data) {
      final map = Map<String, dynamic>.from(data as Map);
      _presence.remove(map['userId']);
      notifyListeners();
    });
    transport.on('diagram_change', (data) {
      _consumeDurable(Map<String, dynamic>.from(data as Map));
    });
  }

  Future<void> _joinCurrent() async {
    final diagramId = _diagramId;
    if (diagramId == null) return;
    final raw = await transport.emitWithAck('join_diagram', {
      'diagramId': diagramId,
      'afterSequence': lastSequence,
    });
    if (raw is! Map || raw['success'] != true) return;
    _presence.clear();
    for (final item in raw['presence'] as List? ?? const []) {
      final map = Map<String, dynamic>.from(item as Map);
      final collaborator = CollaboratorPresence(
        userId: map['userId'] as String,
        name: map['userName'] as String? ?? 'Colaborador',
        socketId: map['socketId'] as String? ?? '',
      );
      _presence[collaborator.userId] = collaborator;
    }
    for (final event in raw['events'] as List? ?? const []) {
      _consumeDurable(Map<String, dynamic>.from(event as Map));
    }
    notifyListeners();
  }

  void _consumeDurable(Map<String, dynamic> event) {
    final sequence =
        event['serverSequence'] as int? ?? event['sequence'] as int?;
    if (sequence != null) {
      if (sequence <= lastSequence) return;
      lastSequence = sequence;
    }
    onDurableEvent(event);
    notifyListeners();
  }

  @override
  void dispose() {
    transport.disconnect();
    super.dispose();
  }
}
