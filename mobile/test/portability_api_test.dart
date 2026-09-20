import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:proyecto_software1_mobile/core/api/api_client.dart';
import 'package:proyecto_software1_mobile/core/models/artifact_models.dart';

void main() {
  test(
    'covers generation, repository and interchange REST contracts',
    () async {
      final requests = <http.Request>[];
      final client = MockClient((request) async {
        requests.add(request);
        final path = request.url.path;
        if (path.contains('/code-generation/spring-boot/')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'generatedCodeId': 'generated-1',
              'revisionId': 'revision-1',
              'message': 'ok',
            }),
            201,
          );
        }
        if (path.endsWith('/revisions') && request.method == 'GET') {
          return http.Response(jsonEncode([revisionJson]), 200);
        }
        if (path.endsWith('/tree')) {
          return http.Response(jsonEncode([fileJson]), 200);
        }
        if (path.contains('/files/')) {
          return http.Response(
            jsonEncode({...fileJson, 'content': 'class App {}'}),
            200,
          );
        }
        if (path.endsWith('/comments') && request.method == 'GET') {
          return http.Response(jsonEncode([commentJson]), 200);
        }
        if (path.endsWith('/comments')) {
          return http.Response(jsonEncode(commentJson), 201);
        }
        if (path.endsWith('/compare')) {
          return http.Response(
            jsonEncode({
              'baseRevisionId': 'revision-1',
              'targetRevisionId': 'revision-2',
              'files': [
                {
                  'path': 'lib/app.dart',
                  'kind': 'MODIFIED',
                  'patch': '@@ -1 +1 @@',
                },
              ],
            }),
            200,
          );
        }
        if (path.endsWith('/restore')) {
          return http.Response(
            jsonEncode({...revisionJson, 'id': 'revision-3'}),
            201,
          );
        }
        if (path.endsWith('/import/preview')) {
          return http.Response(
            jsonEncode({
              'token': 'preview-token',
              'name': 'Importado',
              'format': 'xmi',
              'accepted': {'classes': 2, 'relations': 1},
              'warnings': ['Aviso'],
              'unsupported': ['Signal'],
            }),
            201,
          );
        }
        if (path.endsWith('/import/confirm')) {
          return http.Response(
            jsonEncode({
              'id': 'diagram-imported',
              'name': 'Importado',
              'version': 1,
              'data': {'classes': [], 'relations': []},
            }),
            201,
          );
        }
        if (path.contains('/export/') ||
            path.contains('/download/') ||
            path.endsWith('/download')) {
          return http.Response.bytes(
            Uint8List.fromList([1, 2, 3]),
            200,
            headers: {
              'content-type': 'application/zip',
              'content-disposition': 'attachment; filename="artifact.zip"',
            },
          );
        }
        return http.Response('{}', 200);
      });
      final api = ApiClient(baseUrl: 'http://host/api', client: client);

      final generated = await api.generateProject(
        'diagram-1',
        GeneratedProjectType.springBoot,
      );
      final revisions = await api.listRevisions(
        'workspace-1',
        diagramId: 'diagram-1',
      );
      final tree = await api.getRevisionTree('workspace-1', 'revision-1');
      final file = await api.readRevisionFile(
        'workspace-1',
        'revision-1',
        'file-1',
      );
      final comments = await api.listRevisionComments(
        'workspace-1',
        'revision-1',
      );
      final comment = await api.createRevisionComment(
        'workspace-1',
        'revision-1',
        fileId: 'file-1',
        line: 4,
        body: 'Revisar',
      );
      final comparison = await api.compareRevisions(
        'workspace-1',
        'revision-1',
        'revision-2',
      );
      final restored = await api.restoreRevision('workspace-1', 'revision-1');
      final generatedZip = await api.downloadGeneratedProject('generated-1');
      final revisionZip = await api.downloadRevision(
        'workspace-1',
        'revision-1',
      );
      final exported = await api.exportDiagram(
        'diagram-1',
        InterchangeFormat.zip,
      );
      final preview = await api.previewDiagramImport(
        workspaceId: 'workspace-1',
        name: 'Importado',
        format: InterchangeFormat.xmi,
        content: '<xmi:XMI/>',
      );
      final imported = await api.confirmDiagramImport(preview.token);

      expect(generated.revisionId, 'revision-1');
      expect(revisions.single.fileCount, 1);
      expect(tree.single.path, 'lib/app.dart');
      expect(file.content, 'class App {}');
      expect(comments.single.authorName, 'Ana');
      expect(comment.line, 4);
      expect(comparison.files.single.kind, 'MODIFIED');
      expect(restored.id, 'revision-3');
      expect(generatedZip.filename, 'artifact.zip');
      expect(revisionZip.contentType, 'application/zip');
      expect(exported.bytes, [1, 2, 3]);
      expect(preview.acceptedClasses, 2);
      expect(imported.id, 'diagram-imported');
      expect(
        requests.any(
          (item) => item.url.queryParameters['diagramId'] == 'diagram-1',
        ),
        isTrue,
      );
    },
  );
}

const revisionJson = {
  'id': 'revision-1',
  'workspaceId': 'workspace-1',
  'diagramId': 'diagram-1',
  'modelVersion': 3,
  'authorId': 'user-1',
  'projectType': 'SPRING_BOOT',
  'generator': 'spring-ejs@1',
  'status': 'PUBLISHED',
  'parentRevisionId': null,
  'restoredFromId': null,
  'manifest': {'fileCount': 1},
  'createdAt': '2026-09-20T12:00:00Z',
  'publishedAt': '2026-09-20T12:00:01Z',
  'fileCount': 1,
  'commentCount': 0,
};

const fileJson = {
  'id': 'file-1',
  'revisionId': 'revision-1',
  'path': 'lib/app.dart',
  'checksum': 'abc',
  'size': 12,
  'mimeType': 'text/plain',
  'isBinary': false,
  'createdAt': '2026-09-20T12:00:00Z',
};

const commentJson = {
  'id': 'comment-1',
  'revisionId': 'revision-1',
  'fileId': 'file-1',
  'authorId': 'user-2',
  'line': 4,
  'body': 'Revisar',
  'createdAt': '2026-09-20T12:00:00Z',
  'updatedAt': '2026-09-20T12:00:00Z',
  'author': {'id': 'user-2', 'name': 'Ana'},
};
