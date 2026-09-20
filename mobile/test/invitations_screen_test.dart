import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/app_controller.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/models.dart';
import 'package:proyecto_software1_mobile/core/storage/local_store.dart';
import 'package:proyecto_software1_mobile/features/workspaces/invitations_screen.dart';

class InvitationApi extends ApiClient {
  InvitationApi() : super(baseUrl: 'http://host/api');
  String? claimed;
  bool created = false;

  @override
  Future<ClaimedInvitationModel> claimPortableInvitation(String secret) async {
    claimed = secret;
    return const ClaimedInvitationModel(
      workspaceId: 'workspace-1',
      alreadyAccepted: false,
      alreadyMember: false,
    );
  }

  @override
  Future<PortableInvitationModel> createPortableInvitation(
    String workspaceId, {
    required WorkspaceRole role,
    int expiresInHours = 168,
    String? email,
  }) async {
    created = true;
    return const PortableInvitationModel(
      invitation: WorkspaceInvitationModel(
        id: 'invite-1',
        workspaceId: 'workspace-1',
        role: WorkspaceRole.editor,
        status: 'PENDING',
      ),
      token: 'raw-token',
      code: 'ABCD1234',
      url: 'proyectosoftware1://invite?token=raw-token',
    );
  }

  @override
  Future<List<WorkspaceModel>> getWorkspaces() async => [];
}

class InvitationStore extends LocalStore {
  @override
  Future<void> saveJsonList(String key, List<dynamic> value) async {}
}

void main() {
  testWidgets('accepts a manual invitation code', (tester) async {
    final api = InvitationApi();
    final controller = AppController(store: InvitationStore(), apiClient: api)
      ..online = true;
    await tester.pumpWidget(
      MaterialApp(home: InvitationsScreen(controller: controller)),
    );

    await tester.enterText(
      find.byKey(const Key('invitation-secret')),
      'ABCD-1234',
    );
    await tester.tap(find.text('Aceptar invitación'));
    await tester.pumpAndSettle();

    expect(api.claimed, 'ABCD-1234');
    expect(find.textContaining('aceptada'), findsOneWidget);
  });

  testWidgets('owner creates a role-bound shareable link and code', (
    tester,
  ) async {
    final api = InvitationApi();
    final controller = AppController(store: InvitationStore(), apiClient: api)
      ..online = true
      ..activeWorkspace = const WorkspaceModel(
        id: 'workspace-1',
        name: 'Ventas',
        role: 'OWNER',
      );
    await tester.pumpWidget(
      MaterialApp(home: InvitationsScreen(controller: controller)),
    );

    await tester.tap(find.text('Crear enlace y código'));
    await tester.pumpAndSettle();

    expect(api.created, isTrue);
    expect(find.text('ABCD1234'), findsOneWidget);
    expect(find.textContaining('proyectosoftware1://invite'), findsOneWidget);
  });
}
