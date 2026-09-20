import 'dart:async';

import 'package:app_links/app_links.dart';

class InvitationSecretParser {
  static String? parse(Uri uri) {
    if (uri.scheme != 'proyectosoftware1' || uri.host != 'invite') return null;
    final token = uri.queryParameters['token']?.trim();
    return token == null || token.isEmpty ? null : token;
  }
}

class InvitationLinkService {
  InvitationLinkService({AppLinks? appLinks})
    : _appLinks = appLinks ?? AppLinks();

  final AppLinks _appLinks;
  StreamSubscription<Uri>? _subscription;

  Future<void> start(Future<void> Function(String) onSecret) async {
    final initial = await _appLinks.getInitialLink();
    final secret = initial == null
        ? null
        : InvitationSecretParser.parse(initial);
    if (secret != null) await onSecret(secret);
    _subscription = _appLinks.uriLinkStream.listen((uri) {
      final incoming = InvitationSecretParser.parse(uri);
      if (incoming != null) unawaited(onSecret(incoming));
    });
  }

  Future<void> dispose() async => _subscription?.cancel();
}
