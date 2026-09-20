import 'dart:typed_data';

enum GeneratedProjectType {
  springBoot('spring-boot'),
  flutter('flutter');

  const GeneratedProjectType(this.endpoint);
  final String endpoint;
}

enum InterchangeFormat { xmi, json, zip }

class GeneratedProjectResult {
  const GeneratedProjectResult({
    required this.generatedCodeId,
    required this.revisionId,
    required this.message,
  });

  final String generatedCodeId;
  final String revisionId;
  final String message;

  factory GeneratedProjectResult.fromJson(Map<String, dynamic> json) =>
      GeneratedProjectResult(
        generatedCodeId: json['generatedCodeId'] as String,
        revisionId: json['revisionId'] as String,
        message: json['message'] as String? ?? '',
      );
}

class DownloadedFile {
  const DownloadedFile({
    required this.filename,
    required this.contentType,
    required this.bytes,
  });

  final String filename;
  final String contentType;
  final Uint8List bytes;
}

class RevisionSummaryModel {
  const RevisionSummaryModel({
    required this.id,
    required this.workspaceId,
    required this.diagramId,
    required this.modelVersion,
    required this.projectType,
    required this.generator,
    required this.status,
    required this.fileCount,
    required this.commentCount,
    required this.createdAt,
  });

  final String id;
  final String workspaceId;
  final String diagramId;
  final int modelVersion;
  final String projectType;
  final String generator;
  final String status;
  final int fileCount;
  final int commentCount;
  final String createdAt;

  factory RevisionSummaryModel.fromJson(Map<String, dynamic> json) =>
      RevisionSummaryModel(
        id: json['id'] as String,
        workspaceId: json['workspaceId'] as String,
        diagramId: json['diagramId'] as String,
        modelVersion: json['modelVersion'] as int? ?? 1,
        projectType: json['projectType'] as String? ?? '',
        generator: json['generator'] as String? ?? '',
        status: json['status'] as String? ?? '',
        fileCount: json['fileCount'] as int? ?? 0,
        commentCount: json['commentCount'] as int? ?? 0,
        createdAt: json['createdAt']?.toString() ?? '',
      );
}

class RevisionFileModel {
  const RevisionFileModel({
    required this.id,
    required this.revisionId,
    required this.path,
    required this.size,
    required this.mimeType,
    required this.isBinary,
    this.content,
  });

  final String id;
  final String revisionId;
  final String path;
  final int size;
  final String mimeType;
  final bool isBinary;
  final String? content;

  factory RevisionFileModel.fromJson(Map<String, dynamic> json) =>
      RevisionFileModel(
        id: json['id'] as String,
        revisionId: json['revisionId'] as String,
        path: json['path'] as String,
        size: json['size'] as int? ?? 0,
        mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
        isBinary: json['isBinary'] as bool? ?? false,
        content: json['content'] as String?,
      );
}

class RevisionFileDiffModel {
  const RevisionFileDiffModel({
    required this.path,
    required this.kind,
    this.patch,
  });
  final String path;
  final String kind;
  final String? patch;

  factory RevisionFileDiffModel.fromJson(Map<String, dynamic> json) =>
      RevisionFileDiffModel(
        path: json['path'] as String,
        kind: json['kind'] as String,
        patch: json['patch'] as String?,
      );
}

class RevisionComparisonModel {
  const RevisionComparisonModel({required this.files});
  final List<RevisionFileDiffModel> files;

  factory RevisionComparisonModel.fromJson(Map<String, dynamic> json) =>
      RevisionComparisonModel(
        files: (json['files'] as List? ?? const [])
            .map(
              (item) => RevisionFileDiffModel.fromJson(
                Map<String, dynamic>.from(item as Map),
              ),
            )
            .toList(),
      );
}

class ReviewCommentModel {
  const ReviewCommentModel({
    required this.id,
    required this.fileId,
    required this.body,
    required this.authorName,
    this.line,
  });
  final String id;
  final String fileId;
  final String body;
  final String authorName;
  final int? line;

  factory ReviewCommentModel.fromJson(Map<String, dynamic> json) =>
      ReviewCommentModel(
        id: json['id'] as String,
        fileId: json['fileId'] as String,
        body: json['body'] as String? ?? '',
        authorName: (json['author'] as Map?)?['name'] as String? ?? '',
        line: json['line'] as int?,
      );
}

class ImportPreviewModel {
  const ImportPreviewModel({
    required this.token,
    required this.name,
    required this.format,
    required this.acceptedClasses,
    required this.acceptedRelations,
    required this.warnings,
    required this.unsupported,
  });
  final String token;
  final String name;
  final String format;
  final int acceptedClasses;
  final int acceptedRelations;
  final List<String> warnings;
  final List<String> unsupported;

  factory ImportPreviewModel.fromJson(Map<String, dynamic> json) {
    final accepted = Map<String, dynamic>.from(
      json['accepted'] as Map? ?? const {},
    );
    return ImportPreviewModel(
      token: json['token'] as String,
      name: json['name'] as String? ?? '',
      format: json['format'] as String? ?? '',
      acceptedClasses: accepted['classes'] as int? ?? 0,
      acceptedRelations: accepted['relations'] as int? ?? 0,
      warnings: List<String>.from(json['warnings'] as List? ?? const []),
      unsupported: List<String>.from(json['unsupported'] as List? ?? const []),
    );
  }
}
