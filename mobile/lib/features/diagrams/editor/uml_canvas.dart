import 'package:flutter/material.dart';

import 'uml_canvas_controller.dart';

class UmlCanvas extends StatelessWidget {
  const UmlCanvas({
    required this.controller,
    required this.editable,
    super.key,
  });

  final UmlCanvasController controller;
  final bool editable;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final classes = (controller.model['classes'] as List? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      return InteractiveViewer(
        constrained: false,
        minScale: .35,
        maxScale: 2.5,
        boundaryMargin: const EdgeInsets.all(240),
        child: SizedBox(
          width: 1800,
          height: 1200,
          child: Stack(
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter: _RelationPainter(
                    controller.model,
                    Theme.of(context).colorScheme,
                  ),
                ),
              ),
              for (final umlClass in classes)
                _ClassNode(
                  controller: controller,
                  umlClass: umlClass,
                  editable: editable,
                ),
            ],
          ),
        ),
      );
    },
  );
}

class _ClassNode extends StatelessWidget {
  const _ClassNode({
    required this.controller,
    required this.umlClass,
    required this.editable,
  });

  final UmlCanvasController controller;
  final Map<String, dynamic> umlClass;
  final bool editable;

  @override
  Widget build(BuildContext context) {
    final position = Map<String, dynamic>.from(
      umlClass['position'] as Map? ?? const {},
    );
    final id = umlClass['id'].toString();
    final attributes = (umlClass['attributes'] as List? ?? const [])
        .cast<Map>();
    final methods = (umlClass['methods'] as List? ?? const []).cast<Map>();
    final selected = controller.selectedClassId == id;
    return Positioned(
      left: (position['x'] as num? ?? 0).toDouble(),
      top: (position['y'] as num? ?? 0).toDouble(),
      width: 230,
      child: GestureDetector(
        onTap: () => controller.selectClass(id),
        onPanStart: editable ? (_) => controller.selectClass(id) : null,
        onPanUpdate: editable
            ? (details) {
                final current = Map<String, dynamic>.from(
                  ((controller.model['classes'] as List).cast<Map>().firstWhere(
                        (item) => item['id'] == id,
                      )['position']
                      as Map),
                );
                controller.moveSelected(
                  Offset(
                    (current['x'] as num).toDouble() + details.delta.dx,
                    (current['y'] as num).toDouble() + details.delta.dy,
                  ),
                );
              }
            : null,
        child: Card(
          elevation: selected ? 3 : 0,
          shape: RoundedRectangleBorder(
            side: BorderSide(
              color: selected
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.outlineVariant,
              width: selected ? 2 : 1,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(11),
                  ),
                ),
                child: Text(
                  umlClass['name']?.toString() ?? 'Clase',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              if (attributes.isNotEmpty) ...[
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final attribute in attributes)
                        Text(
                          '${attribute['name']}: ${attribute['type'] ?? 'String'}',
                        ),
                    ],
                  ),
                ),
              ],
              if (methods.isNotEmpty) ...[
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final method in methods)
                        Text(
                          '${method['name']}(): ${method['returnType'] ?? 'void'}',
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RelationPainter extends CustomPainter {
  _RelationPainter(this.model, this.colors);

  final Map<String, dynamic> model;
  final ColorScheme colors;

  @override
  void paint(Canvas canvas, Size size) {
    final classes = <String, Map<String, dynamic>>{
      for (final item in (model['classes'] as List? ?? const []))
        (item as Map)['id'].toString(): Map<String, dynamic>.from(item),
    };
    final paint = Paint()
      ..color = colors.onSurfaceVariant
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    for (final raw in (model['relations'] as List? ?? const [])) {
      final relation = Map<String, dynamic>.from(raw as Map);
      final source = classes[relation['sourceClassId']];
      final target = classes[relation['targetClassId']];
      if (source == null || target == null) continue;
      final sourcePosition = Map<String, dynamic>.from(
        source['position'] as Map? ?? const {},
      );
      final targetPosition = Map<String, dynamic>.from(
        target['position'] as Map? ?? const {},
      );
      final start = Offset(
        (sourcePosition['x'] as num? ?? 0).toDouble() + 115,
        (sourcePosition['y'] as num? ?? 0).toDouble() + 48,
      );
      final end = Offset(
        (targetPosition['x'] as num? ?? 0).toDouble() + 115,
        (targetPosition['y'] as num? ?? 0).toDouble() + 48,
      );
      canvas.drawLine(start, end, paint);
      final label = relation['name']?.toString() ?? '';
      if (label.isNotEmpty) {
        final painter = TextPainter(
          text: TextSpan(
            text: label,
            style: TextStyle(
              color: colors.onSurface,
              fontSize: 12,
              backgroundColor: colors.surface,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        painter.paint(
          canvas,
          Offset((start.dx + end.dx) / 2, (start.dy + end.dy) / 2),
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _RelationPainter oldDelegate) =>
      oldDelegate.model != model || oldDelegate.colors != colors;
}
