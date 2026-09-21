import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_gemma/flutter_gemma.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import 'ai_types.dart';
import 'function_catalog.dart';

export 'ai_types.dart';

const functionGemmaModelUrl =
    'https://huggingface.co/sasha-denisov/function-gemma-270M-it/resolve/main/functiongemma-270M-it.task';
const functionGemmaSha256 =
    '1312345025986225edf8a9d3dfc49a2d7dc41dcf6a4420da5f348eff9d0f185a';
const functionGemmaModelSizeBytes = 284368375;

enum LocalModelStatus { unavailable, loading, ready, error }

class ModelIntegrityException implements Exception {
  const ModelIntegrityException(this.message);
  final String message;

  @override
  String toString() => 'ModelIntegrityException: $message';
}

class RawModelResponse {
  const RawModelResponse.text(this.text) : toolCall = null;
  const RawModelResponse.tool(this.toolCall) : text = null;

  final String? text;
  final ModelToolCall? toolCall;
}

abstract class LocalModelAdapter {
  Future<void> initialize();
  Future<bool> hasInstalledModel();
  Future<void> installFile(String path, void Function(double) onProgress);
  Future<RawModelResponse> infer(
    String prompt, {
    required List<ModelToolDefinition> tools,
  });
  Future<void> unload();
  Future<void> uninstall();
}

class FlutterGemmaAdapter implements LocalModelAdapter {
  InferenceModel? _model;

  @override
  Future<void> initialize() => FlutterGemma.initialize();

  @override
  Future<bool> hasInstalledModel() async =>
      (await FlutterGemma.listInstalledModels()).isNotEmpty;

  @override
  Future<void> installFile(
    String path,
    void Function(double) onProgress,
  ) async {
    await FlutterGemma.installModel(modelType: ModelType.functionGemma)
        .fromFile(path)
        .withProgress((progress) => onProgress(progress / 100))
        .install();
  }

  @override
  Future<RawModelResponse> infer(
    String prompt, {
    required List<ModelToolDefinition> tools,
  }) async {
    _model ??= await FlutterGemma.getActiveModel(
      maxTokens: 1024,
      preferredBackend: PreferredBackend.cpu,
    );
    final chat = await _model!.createChat(
      tools: tools
          .map(
            (definition) => Tool(
              name: definition.name,
              description: definition.description,
              parameters: definition.jsonSchema,
            ),
          )
          .toList(),
      supportsFunctionCalls: true,
    );
    await chat.addQueryChunk(Message.text(text: prompt, isUser: true));
    final response = await chat.generateChatResponse();
    if (response is FunctionCallResponse) {
      return RawModelResponse.tool(ModelToolCall(response.name, response.args));
    }
    if (response is TextResponse) return RawModelResponse.text(response.token);
    return const RawModelResponse.text(
      'El modelo local no devolvió una acción compatible.',
    );
  }

  @override
  Future<void> unload() async {
    await _model?.close();
    _model = null;
  }

  @override
  Future<void> uninstall() async {
    await unload();
    for (final modelId in await FlutterGemma.listInstalledModels()) {
      await FlutterGemma.uninstallModel(modelId);
    }
  }
}

class LocalInferenceResult {
  const LocalInferenceResult({
    required this.engine,
    required this.message,
    this.command,
    this.requiresConfirmation = false,
  });

  final AiEngine engine;
  final String message;
  final LocalCommand? command;
  final bool requiresConfirmation;
}

class LocalModelRuntime extends ChangeNotifier {
  LocalModelRuntime({LocalModelAdapter? adapter, FunctionCatalog? catalog})
    : adapter = adapter ?? FlutterGemmaAdapter(),
      catalog = catalog ?? FunctionCatalog.standard();

  final LocalModelAdapter adapter;
  final FunctionCatalog catalog;
  LocalModelStatus status = LocalModelStatus.unavailable;
  double progress = 0;
  String? error;

  bool get ready => status == LocalModelStatus.ready;

  Future<void> start() async {
    try {
      await adapter.initialize();
      status = await adapter.hasInstalledModel()
          ? LocalModelStatus.ready
          : LocalModelStatus.unavailable;
      error = null;
    } catch (exception) {
      status = LocalModelStatus.error;
      error = exception.toString();
    }
    notifyListeners();
  }

  Future<void> installFromFile(
    String path, {
    required String expectedSha256,
  }) async {
    status = LocalModelStatus.loading;
    progress = 0;
    error = null;
    notifyListeners();
    try {
      final digest = await sha256.bind(File(path).openRead()).first;
      if (digest.toString().toLowerCase() != expectedSha256.toLowerCase()) {
        throw const ModelIntegrityException(
          'La firma SHA-256 del modelo no coincide; no se instaló el archivo.',
        );
      }
      await adapter.installFile(path, (value) {
        progress = value.clamp(0, 1);
        notifyListeners();
      });
      progress = 1;
      status = LocalModelStatus.ready;
      notifyListeners();
    } catch (exception) {
      status = LocalModelStatus.error;
      error = exception.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> downloadOfficialModel() async {
    status = LocalModelStatus.loading;
    progress = 0;
    error = null;
    notifyListeners();
    final directory = await getTemporaryDirectory();
    final target = File('${directory.path}/functiongemma-270M-it.task');
    final client = http.Client();
    try {
      final response = await client.send(
        http.Request('GET', Uri.parse(functionGemmaModelUrl)),
      );
      if (response.statusCode != HttpStatus.ok) {
        throw HttpException(
          'No se pudo descargar el modelo (${response.statusCode}).',
        );
      }
      final total = response.contentLength ?? functionGemmaModelSizeBytes;
      var received = 0;
      final sink = target.openWrite();
      try {
        await for (final chunk in response.stream) {
          sink.add(chunk);
          received += chunk.length;
          progress = total > 0 ? (received / total).clamp(0, .92) : 0;
          notifyListeners();
        }
      } finally {
        await sink.close();
      }
      await installFromFile(target.path, expectedSha256: functionGemmaSha256);
    } catch (exception) {
      status = LocalModelStatus.error;
      error = exception.toString();
      notifyListeners();
      rethrow;
    } finally {
      client.close();
      if (await target.exists()) await target.delete();
    }
  }

  Future<LocalInferenceResult> infer(
    String prompt, {
    String? diagramContext,
  }) async {
    if (!ready) throw StateError('FunctionGemma no está instalado o cargado.');
    final contextualPrompt = diagramContext == null || diagramContext.isEmpty
        ? prompt
        : '$prompt\nContexto UML actual: $diagramContext';
    final response = await adapter.infer(
      contextualPrompt,
      tools: catalog.definitions,
    );
    if (response.toolCall != null) {
      try {
        final validated = catalog.validate(response.toolCall!);
        return LocalInferenceResult(
          engine: AiEngine.functionGemma,
          message: 'FunctionGemma preparó una acción local validada.',
          command: validated.command,
        );
      } on ToolConfirmationRequired catch (exception) {
        final reviewed = catalog.validate(
          response.toolCall!,
          allowDestructive: true,
        );
        return LocalInferenceResult(
          engine: AiEngine.functionGemma,
          message: exception.message,
          command: reviewed.command,
          requiresConfirmation: true,
        );
      }
    }
    return LocalInferenceResult(
      engine: AiEngine.functionGemma,
      message: response.text ?? 'Respuesta local vacía.',
    );
  }

  Future<void> unload() async {
    await adapter.unload();
    status = LocalModelStatus.unavailable;
    notifyListeners();
  }

  Future<void> uninstall() async {
    await adapter.uninstall();
    status = LocalModelStatus.unavailable;
    progress = 0;
    notifyListeners();
  }
}
