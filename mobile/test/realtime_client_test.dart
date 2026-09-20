import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/core/realtime/realtime_client.dart';

class FakeRealtimeTransport implements RealtimeTransport {
  String? url;
  String? token;
  bool connected = false;
  final handlers = <String, void Function(dynamic)>{};
  final emitted = <({String event, Map<String, dynamic> data})>[];
  final acknowledgements = <String, dynamic>{};

  @override
  void configure({required String url, required String token}) {
    this.url = url;
    this.token = token;
  }

  @override
  void connect() {
    connected = true;
    trigger('connect');
  }

  @override
  void disconnect() => connected = false;

  @override
  Future<dynamic> emitWithAck(String event, Map<String, dynamic> data) async {
    emitted.add((event: event, data: data));
    return acknowledgements[event];
  }

  @override
  void on(String event, void Function(dynamic) handler) =>
      handlers[event] = handler;

  void trigger(String event, [dynamic data]) => handlers[event]?.call(data);
}

void main() {
  test(
    'authenticates, replays missed events and rejoins after reconnect',
    () async {
      final transport = FakeRealtimeTransport();
      transport.acknowledgements['join_diagram'] = {
        'success': true,
        'events': [
          {
            'serverSequence': 6,
            'afterData': {'classes': []},
          },
        ],
      };
      final replayed = <Map<String, dynamic>>[];
      final client = RealtimeClient(
        transport: transport,
        onDurableEvent: replayed.add,
      );

      await client.connect(
        apiBaseUrl: 'http://localhost:3002/api',
        token: 'jwt-token',
      );
      await client.joinDiagram('diagram-1', afterSequence: 4);

      expect(transport.url, 'http://localhost:3002/collaboration');
      expect(transport.token, 'jwt-token');
      expect(replayed.single['serverSequence'], 6);
      expect(client.lastSequence, 6);

      transport.trigger('disconnect');
      transport.trigger('connect');
      await Future<void>.delayed(Duration.zero);
      expect(transport.emitted.last.data['afterSequence'], 6);

      await client.joinDiagram('diagram-2');
      expect(transport.emitted.last.data['afterSequence'], 0);
    },
  );

  test('tracks collaborator presence and remote durable changes', () async {
    final transport = FakeRealtimeTransport();
    transport.acknowledgements['join_diagram'] = {
      'success': true,
      'events': <dynamic>[],
      'presence': [
        {
          'userId': 'user-existing',
          'userName': 'Luis',
          'socketId': 'socket-existing',
        },
      ],
    };
    final received = <Map<String, dynamic>>[];
    final client = RealtimeClient(
      transport: transport,
      onDurableEvent: received.add,
    );
    await client.connect(apiBaseUrl: 'http://host/api', token: 'token');
    await client.joinDiagram('diagram-1');
    expect(client.presence.single.name, 'Luis');

    transport.trigger('user_joined', {
      'userId': 'user-2',
      'userName': 'Ana',
      'socketId': 'socket-2',
    });
    expect(
      client.presence.map((item) => item.name),
      containsAll(['Luis', 'Ana']),
    );

    transport.trigger('diagram_change', {
      'sequence': 7,
      'version': 5,
      'changes': {
        'type': 'full_update',
        'data': {'classes': []},
      },
    });
    expect(received.single['sequence'], 7);
    expect(client.lastSequence, 7);

    transport.trigger('user_left', {
      'userId': 'user-2',
      'socketId': 'socket-2',
    });
    expect(client.presence.single.name, 'Luis');
  });
}
