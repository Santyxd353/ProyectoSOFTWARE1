'use client';

import React from 'react';
import { EdgeProps, getSmoothStepPath, EdgeLabelRenderer, BaseEdge, Handle, Position } from 'reactflow';

interface UMLRelationshipData {
  label?: string;
  type?: 'ASSOCIATION' | 'AGGREGATION' | 'COMPOSITION' | 'INHERITANCE' | 'DEPENDENCY' | 'REALIZATION' | 'ManyToMany';
  multiplicity?: {
    source?: string;
    target?: string;
  };
  intermediateTable?: {
    name: string;
    attributes?: string[];
  };
}

export default function UMLRelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  markerStart,
  selected
}: EdgeProps<UMLRelationshipData>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8, // Esquinas redondeadas sutiles
  });

  // Calcular offset para alejar multiplicidades de los nodos
  const offsetDistance = 35; // Distancia en píxeles desde el nodo

  // Calcular dirección del source al target
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Normalizar y aplicar offset
  const sourceOffsetX = (dx / length) * offsetDistance;
  const sourceOffsetY = (dy / length) * offsetDistance;
  const targetOffsetX = -(dx / length) * offsetDistance;
  const targetOffsetY = -(dy / length) * offsetDistance;

  // Posiciones ajustadas de las multiplicidades
  const sourceMultiplicityX = sourceX + sourceOffsetX;
  const sourceMultiplicityY = sourceY + sourceOffsetY;
  const targetMultiplicityX = targetX + targetOffsetX;
  const targetMultiplicityY = targetY + targetOffsetY;

  // Detectar relación muchos a muchos
  const isManyToMany = () => {
    const source = data?.multiplicity?.source || '';
    const target = data?.multiplicity?.target || '';

    // Formatos: *, 0..*, 1..*, *..*, etc.
    const isSourceMany = source.includes('*') || source === '*';
    const isTargetMany = target.includes('*') || target === '*';

    return isSourceMany && isTargetMany;
  };

  const getEdgeStyle = () => {
    const baseStyle = {
      strokeWidth: selected ? 3 : 2,
      stroke: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
      ...style
    };

    // Líneas discontinuas para relaciones muchos a muchos
    if (isManyToMany()) {
      return {
        ...baseStyle,
        strokeDasharray: '8,4',
      };
    }

    switch (data?.type) {
      case 'DEPENDENCY':
      case 'REALIZATION':
        return {
          ...baseStyle,
          strokeDasharray: '5,5',
        };
      case 'INHERITANCE':
        return {
          ...baseStyle,
        };
      case 'COMPOSITION':
        return {
          ...baseStyle,
        };
      case 'AGGREGATION':
        return {
          ...baseStyle,
        };
      default: // ASSOCIATION
        return {
          ...baseStyle,
        };
    }
  };

  const getMarkerEnd = () => {
    switch (data?.type) {
      case 'INHERITANCE':
        return 'url(#inheritance-arrow)';
      case 'COMPOSITION':
        return 'url(#composition-diamond)';
      case 'AGGREGATION':
        return 'url(#aggregation-diamond)';
      case 'DEPENDENCY':
      case 'REALIZATION':
        return 'url(#dependency-arrow)';
      default:
        // En UML de clases, las relaciones normales NO tienen flecha
        // La dirección se indica con la multiplicidad
        return undefined;
    }
  };

  return (
    <>
      {/* SVG Markers Definition */}
      <defs>
        {/* Inheritance Arrow (Empty Triangle) */}
        <marker
          id="inheritance-arrow"
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0,0 0,12 10,6"
            fill="hsl(var(--card))"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
          />
        </marker>

        {/* Composition Diamond (Filled) */}
        <marker
          id="composition-diamond"
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0,6 4,2 8,6 4,10"
            fill="hsl(var(--muted-foreground))"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1"
          />
        </marker>

        {/* Aggregation Diamond (Empty) */}
        <marker
          id="aggregation-diamond"
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0,6 4,2 8,6 4,10"
            fill="hsl(var(--card))"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
          />
        </marker>

        {/* Dependency Arrow (Open) */}
        <marker
          id="dependency-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,10 L8,5 z"
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
          />
        </marker>

        {/* Association Arrow (Simple) */}
        <marker
          id="association-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,8 L6,4 z"
            fill="hsl(var(--muted-foreground))"
            stroke="hsl(var(--muted-foreground))"
          />
        </marker>
      </defs>

      <BaseEdge
        path={edgePath}
        style={getEdgeStyle()}
        markerEnd={getMarkerEnd()}
      />

      <EdgeLabelRenderer>
        {/* Tabla Intermedia para relaciones N:N - Centro */}
        {/* NOTA: Ya no mostramos la tabla aquí porque ahora se crean como nodos reales */}
        {false && isManyToMany() && data?.intermediateTable ? (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              className={`bg-gray-50 border-2 rounded shadow-md relative ${
                selected ? 'border-gray-600' : 'border-gray-400'
              }`}
              style={{ minWidth: '120px' }}
            >
              {/* Header con <<entity>> */}
              <div className="bg-gray-200 px-2 py-0.5 border-b border-gray-400 text-center">
                <div className="text-[9px] text-gray-600">&lt;&lt;entity&gt;&gt;</div>
                <div className="font-bold text-xs text-gray-800">{data?.intermediateTable?.name}</div>
              </div>
              {/* Atributos */}
              <div className="px-2 py-1">
                {(data?.intermediateTable?.attributes?.length ?? 0) > 0 ? (
                  data!.intermediateTable!.attributes!.map((attr, idx) => (
                    <div key={idx} className="text-[9px] text-gray-700">
                      + {attr}
                    </div>
                  ))
                ) : (
                  <>
                    <div className="text-[9px] text-gray-700">+ id: Long</div>
                    <div className="text-[9px] text-gray-600 italic">+ [foreign keys]</div>
                  </>
                )}
              </div>
              <div className="px-2 py-0.5 border-t border-gray-300 text-center">
                <div className="text-[8px] text-gray-500 italic">Sin métodos</div>
              </div>

              {/* Handles para la tabla intermedia - Igual que las clases normales */}
              {/* RIGHT */}
              <Handle type="source" position={Position.Right} id={`${id}-inter-right-1`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ right: -4, top: '30%' }} />
              <Handle type="target" position={Position.Right} id={`${id}-inter-right-1-in`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ right: -4, top: '30%' }} />
              <Handle type="source" position={Position.Right} id={`${id}-inter-right-2`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ right: -4, top: '70%' }} />
              <Handle type="target" position={Position.Right} id={`${id}-inter-right-2-in`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ right: -4, top: '70%' }} />

              {/* LEFT */}
              <Handle type="source" position={Position.Left} id={`${id}-inter-left-1`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ left: -4, top: '30%' }} />
              <Handle type="target" position={Position.Left} id={`${id}-inter-left-1-in`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ left: -4, top: '30%' }} />
              <Handle type="source" position={Position.Left} id={`${id}-inter-left-2`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ left: -4, top: '70%' }} />
              <Handle type="target" position={Position.Left} id={`${id}-inter-left-2-in`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ left: -4, top: '70%' }} />

              {/* BOTTOM */}
              <Handle type="source" position={Position.Bottom} id={`${id}-inter-bottom-1`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ bottom: -4, left: '30%' }} />
              <Handle type="target" position={Position.Bottom} id={`${id}-inter-bottom-1-in`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ bottom: -4, left: '30%' }} />
              <Handle type="source" position={Position.Bottom} id={`${id}-inter-bottom-2`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ bottom: -4, left: '70%' }} />
              <Handle type="target" position={Position.Bottom} id={`${id}-inter-bottom-2-in`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ bottom: -4, left: '70%' }} />

              {/* TOP */}
              <Handle type="source" position={Position.Top} id={`${id}-inter-top-1`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ top: -4, left: '30%' }} />
              <Handle type="target" position={Position.Top} id={`${id}-inter-top-1-in`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ top: -4, left: '30%' }} />
              <Handle type="source" position={Position.Top} id={`${id}-inter-top-2`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ top: -4, left: '70%' }} />
              <Handle type="target" position={Position.Top} id={`${id}-inter-top-2-in`} className="w-2 h-2 border border-gray-400 bg-gray-600 rounded-full" style={{ top: -4, left: '70%' }} />
            </div>
          </div>
        ) : (
          /* Relationship Label - Centro (para relaciones no N:N) */
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 11,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {data?.label && (
              <div
                className={`px-2 py-1 rounded shadow-sm border text-xs font-medium cursor-pointer hover:shadow transition-all ${
                  selected
                    ? 'bg-gray-600 text-white border-gray-700 shadow-md'
                    : 'bg-card text-foreground border-border hover:border-primary/60'
                }`}
                title="Doble clic para editar, Delete para eliminar"
              >
                {data.label}
                {selected && data.type && (
                  <div className="text-xs text-gray-200 mt-0.5">
                    {data.type}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Multiplicidad en extremo origen (source) - ALEJADA DEL NODO */}
        {data?.multiplicity?.source && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${sourceMultiplicityX}px,${sourceMultiplicityY}px)`,
              fontSize: 11,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <div className="bg-card px-1.5 py-0.5 rounded text-xs text-foreground font-semibold border border-border shadow-sm">
              {data.multiplicity.source}
            </div>
          </div>
        )}

        {/* Multiplicidad en extremo destino (target) - ALEJADA DEL NODO */}
        {data?.multiplicity?.target && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${targetMultiplicityX}px,${targetMultiplicityY}px)`,
              fontSize: 11,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <div className="bg-card px-1.5 py-0.5 rounded text-xs text-foreground font-semibold border border-border shadow-sm">
              {data.multiplicity.target}
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
