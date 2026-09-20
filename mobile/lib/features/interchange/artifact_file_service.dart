import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/models/artifact_models.dart';

class PickedImportFile {
  const PickedImportFile({
    required this.name,
    required this.format,
    required this.content,
  });
  final String name;
  final InterchangeFormat format;
  final String content;
}

class ArtifactFileService {
  Future<PickedImportFile?> pickImport() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['xmi', 'json', 'zip'],
      withData: true,
    );
    final file = result?.files.single;
    final bytes = file?.bytes;
    if (file == null || bytes == null) return null;
    final extension = file.extension?.toLowerCase();
    final format = switch (extension) {
      'xmi' => InterchangeFormat.xmi,
      'json' => InterchangeFormat.json,
      'zip' => InterchangeFormat.zip,
      _ => throw const FormatException('Formato no compatible'),
    };
    return PickedImportFile(
      name: file.name.replaceFirst(RegExp(r'\.[^.]+$'), ''),
      format: format,
      content: format == InterchangeFormat.zip
          ? base64Encode(bytes)
          : utf8.decode(bytes),
    );
  }

  Future<void> share(DownloadedFile file) async {
    final directory = await getTemporaryDirectory();
    final safeName = file.filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final output = File('${directory.path}${Platform.pathSeparator}$safeName');
    await output.writeAsBytes(file.bytes, flush: true);
    await SharePlus.instance.share(
      ShareParams(files: [XFile(output.path, mimeType: file.contentType)]),
    );
  }

  Future<String?> save(DownloadedFile file) => FilePicker.saveFile(
    dialogTitle: 'Guardar ${file.filename}',
    fileName: file.filename,
    bytes: file.bytes,
  );
}
