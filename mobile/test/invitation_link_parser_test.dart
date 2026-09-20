import 'package:flutter_test/flutter_test.dart';
import 'package:proyecto_software1_mobile/features/workspaces/invitation_link_service.dart';

void main() {
  test('extracts only ProyectoSoftware1 invitation links', () {
    expect(
      InvitationSecretParser.parse(
        Uri.parse('proyectosoftware1://invite?token=raw-token'),
      ),
      'raw-token',
    );
    expect(
      InvitationSecretParser.parse(
        Uri.parse('https://example.com/not-an-invite?token=secret'),
      ),
      isNull,
    );
    expect(
      InvitationSecretParser.parse(Uri.parse('proyectosoftware1://invite')),
      isNull,
    );
  });
}
