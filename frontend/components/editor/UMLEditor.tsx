'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  ReactFlowInstance,
  updateEdge,
  OnEdgeUpdateFunc,
} from 'reactflow';
import 'reactflow/dist/style.css';

import UMLClassNode from './UMLClassNode';
import UMLToolbar from './UMLToolbar';
import ClassEditor from './ClassEditor';
import RelationshipEditor from './RelationshipEditor';
import UMLSidebar from './UMLSidebar';
import UMLRelationshipEdge from './UMLRelationshipEdge';
import AIChatInterface from '../chat/AIChatInterface';
import { UMLClass, UMLRelation, Diagram } from '@/types/uml';
import { useSocket } from '@/hooks/useSocket';
import { useI18n } from '@/components/i18n/I18nProvider';
import {
  createOperationEnvelope,
  getLastServerSequence,
  getOrCreateDeviceId,
  nextClientSequence,
  rememberServerSequence,
} from '@/lib/durable-collaboration';

const nodeTypes = {
  umlClass: UMLClassNode,
};

const edgeTypes = {
  umlRelationship: UMLRelationshipEdge,
};

interface UMLEditorProps {
  diagram: Diagram;
  workspaceId: string;
  userId: string;
  userName: string;
  onSave: (data: any) => void;
}

export default function UMLEditor({ diagram, workspaceId, userId, userName, onSave }: UMLEditorProps) {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isEditingClass, setIsEditingClass] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);
  const [isEditingRelationship, setIsEditingRelationship] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { t } = useI18n();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const confirmedVersionRef = useRef(diagram.version);
  const confirmedDataRef = useRef<Record<string, unknown>>(
    (diagram.data || { classes: [], relations: [] }) as Record<string, unknown>,
  );
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef<Record<string, unknown> | null>(null);
  const submitSaveRef = useRef<
    ((data: Record<string, unknown>) => void) | null
  >(null);

  // WebSocket connection for real-time collaboration
  const { socket, isConnected, emit } = useSocket(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001');

  const submitDurableSave = useCallback((data: Record<string, unknown>) => {
    if (!socket || !isConnected) {
      onSave(data);
      return;
    }
    if (saveInFlightRef.current) {
      queuedSaveRef.current = data;
      return;
    }
    saveInFlightRef.current = true;
    const envelope = createOperationEnvelope({
      diagramId: diagram.id,
      deviceId: getOrCreateDeviceId(localStorage),
      clientSequence: nextClientSequence(localStorage),
      baseVersion: confirmedVersionRef.current,
      baseData: confirmedDataRef.current,
      data,
    });
    socket.emit('diagram_change', envelope, (acknowledgement: any) => {
      saveInFlightRef.current = false;
      if (acknowledgement?.success) {
        confirmedVersionRef.current = acknowledgement.version;
        confirmedDataRef.current = data;
        rememberServerSequence(
          localStorage,
          diagram.id,
          acknowledgement.sequence,
        );
        setSyncError(null);
        const queued = queuedSaveRef.current;
        queuedSaveRef.current = null;
        if (queued) submitSaveRef.current?.(queued);
        return;
      }
      setSyncError(
        acknowledgement?.conflictId
          ? `Conflicto ${acknowledgement.conflictId}: el cambio quedó pendiente de resolución.`
          : acknowledgement?.error || 'No se pudo confirmar el cambio colaborativo.',
      );
    });
  }, [diagram.id, isConnected, onSave, socket]);
  submitSaveRef.current = submitDurableSave;

  // Handle save - defined early to be used by other functions
  const handleSave = useCallback(() => {
    const diagramData = {
      classes: nodes.map((node) => ({
        ...node.data,
        position: node.position, // Include position
      } as UMLClass)),
      relations: edges.map((edge) => ({
        id: edge.id,
        sourceClassId: edge.source,
        targetClassId: edge.target,
        type: edge.data?.type || 'ASSOCIATION',
        name: edge.data?.label || '',
        multiplicity: edge.data?.multiplicity ?
          `${edge.data.multiplicity.source || ''}:${edge.data.multiplicity.target || ''}` :
          undefined,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
        intermediateTable: edge.data?.intermediateTable || undefined, // AÑADIDO: Guardar tabla intermedia
      } as UMLRelation)),
      metadata: {
        lastModified: new Date().toISOString(),
        modifiedBy: userId,
      },
    };

    // Log intermediate tables being saved
    const intermediateTables = nodes.filter(n => n.data?.isIntermediateTable);
    if (intermediateTables.length > 0) {
      console.log('📦 Guardando tablas intermedias como nodos:', intermediateTables.map(n => n.data.name));
    }

    console.log('💾 Guardando diagrama:', {
      classes: diagramData.classes.length,
      relations: diagramData.relations.length,
      intermediateTables: intermediateTables.length
    });

    submitDurableSave(diagramData);
  }, [nodes, edges, submitDurableSave, userId]);

  // Función para detectar y crear tabla intermedia para relaciones N:N
  const createIntermediateTable = useCallback((edge: Edge, sourceNode: Node, targetNode: Node) => {
    const multiplicity = edge.data?.multiplicity;

    // Detectar si es muchos a muchos
    const isSourceMany = multiplicity?.source?.includes('*') || multiplicity?.source === '*';
    const isTargetMany = multiplicity?.target?.includes('*') || multiplicity?.target === '*';

    if (!isSourceMany || !isTargetMany) {
      return null;
    }

    console.log('🔄 Detectada relación N:N, creando tabla intermedia...');

    // Nombre de la tabla intermedia
    const sourceClassName = sourceNode.data.name.toLowerCase();
    const targetClassName = targetNode.data.name.toLowerCase();
    const intermediateTableName = `${sourceClassName}_${targetClassName}`;

    // Posición en el medio entre las dos clases
    const intermediatePosition = {
      x: (sourceNode.position.x + targetNode.position.x) / 2,
      y: (sourceNode.position.y + targetNode.position.y) / 2 + 50,
    };

    // Crear la clase intermedia
    const intermediateClass: UMLClass = {
      id: `class-${Date.now()}-intermediate`,
      name: intermediateTableName,
      position: intermediatePosition,
      attributes: [
        {
          id: `attr-${Date.now()}-1`,
          name: 'id',
          type: 'Long',
          stereotype: 'id',
          nullable: false,
          unique: true,
        },
        {
          id: `attr-${Date.now()}-2`,
          name: `${sourceClassName}_id`,
          type: 'Long',
          stereotype: 'fk',
          nullable: false,
          unique: false,
        },
        {
          id: `attr-${Date.now()}-3`,
          name: `${targetClassName}_id`,
          type: 'Long',
          stereotype: 'fk',
          nullable: false,
          unique: false,
        },
      ],
      methods: [],
      stereotypes: ['entity'],
    };

    const intermediateNode: Node = {
      id: intermediateClass.id,
      type: 'umlClass',
      position: intermediatePosition,
      data: intermediateClass,
    };

    // Crear las dos relaciones: source -> intermediate y intermediate -> target
    const edgeToIntermediate: Edge = {
      id: `edge-${Date.now()}-1`,
      source: sourceNode.id,
      target: intermediateNode.id,
      type: 'umlRelationship',
      data: {
        label: `has ${intermediateTableName}`,
        type: 'ASSOCIATION',
        multiplicity: {
          source: '1',
          target: '*',
        },
      },
    };

    const edgeFromIntermediate: Edge = {
      id: `edge-${Date.now()}-2`,
      source: intermediateNode.id,
      target: targetNode.id,
      type: 'umlRelationship',
      data: {
        label: `references ${targetClassName}`,
        type: 'ASSOCIATION',
        multiplicity: {
          source: '*',
          target: '1',
        },
      },
    };

    return {
      intermediateNode,
      newEdges: [edgeToIntermediate, edgeFromIntermediate],
    };
  }, []);

  // Handle Delete key to remove selected nodes and edges
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Supr') {
        // Evitar eliminar si estamos editando en un modal
        if (isEditingClass || isEditingRelationship) return;

        // Eliminar edge seleccionado
        if (selectedEdge) {
          console.log('🗑️ Eliminando relación:', selectedEdge.id);
          setEdges((eds) => {
            const updatedEdges = eds.filter((e) => e.id !== selectedEdge.id);

            // Broadcast change
            if (socket && isConnected) {
              emit('diagram_preview', {
                diagramId: diagram.id,
                changes: {
                  type: 'edges',
                  edges: updatedEdges,
                },
              });
            }

            // Save changes
            setTimeout(() => handleSave(), 100);

            return updatedEdges;
          });

          setSelectedEdge(null);
        }
        // Eliminar nodo seleccionado
        else if (selectedNode) {
          console.log('🗑️ Eliminando clase:', selectedNode.id);

          // Primero eliminar todas las relaciones conectadas al nodo
          setEdges((eds) => {
            const updatedEdges = eds.filter(
              (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
            );
            console.log(`🗑️ Eliminadas ${eds.length - updatedEdges.length} relaciones conectadas`);
            return updatedEdges;
          });

          // Luego eliminar el nodo
          setNodes((nds) => {
            const updatedNodes = nds.filter((n) => n.id !== selectedNode.id);

            // Broadcast change
            if (socket && isConnected) {
              emit('diagram_preview', {
                diagramId: diagram.id,
                changes: {
                  type: 'full_update',
                  nodes: updatedNodes,
                  edges: edges.filter(
                    (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
                  ),
                },
              });
            }

            // Save changes
            setTimeout(() => handleSave(), 100);

            return updatedNodes;
          });

          setSelectedNode(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, selectedEdge, isEditingClass, isEditingRelationship, setNodes, setEdges, socket, isConnected, emit, diagram.id, userId, handleSave, edges]);

  // Handle edge click to select
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: any) => {
    setSelectedEdge(edge);
    setSelectedNode(null); // Deselect node when selecting edge
  }, []);

  // Wrapper for onNodesChange to detect position changes and sync
  const onNodesChange = useCallback((changes: any) => {
    onNodesChangeBase(changes);

    // Check if any change is a position change
    const hasPositionChange = changes.some((change: any) =>
      change.type === 'position' && change.dragging === false
    );

    if (hasPositionChange) {
      console.log('📍 Posiciones actualizadas, guardando...');

      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save to avoid too many requests
      saveTimeoutRef.current = setTimeout(() => {
        // Get updated nodes after state change
        setNodes((currentNodes) => {
          // Broadcast position changes to collaborators
          if (socket && isConnected) {
            emit('diagram_preview', {
              diagramId: diagram.id,
              changes: {
                type: 'nodes',
                nodes: currentNodes,
              },
            });
            console.log('📡 Posiciones enviadas a colaboradores');
          }

          // Save to database
          handleSave();

          return currentNodes;
        });
      }, 1500); // Increased to 1.5 seconds to reduce server load
    }
  }, [onNodesChangeBase, socket, isConnected, emit, diagram.id, userId, setNodes, handleSave]);

  // Initialize diagram data ONLY ONCE on mount
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Solo inicializar una vez cuando el componente se monta
    if (!isInitialized && diagram.data) {
      console.log('🔄 Inicializando diagrama desde BD');

      const initialNodes: Node[] = [];
      const intermediateTableNodes: Node[] = [];

      if (diagram.data.classes) {
        const classNodes = diagram.data.classes.map((umlClass) => ({
          id: umlClass.id,
          type: 'umlClass',
          position: umlClass.position,
          data: umlClass,
        }));
        initialNodes.push(...classNodes);
        console.log('✅ Cargadas', classNodes.length, 'clases desde BD');
      }

      if (diagram.data.relations) {
        const initialEdges: Edge[] = diagram.data.relations.flatMap((relation) => {
          // Parsear multiplicity: puede ser string "1:*" o objeto {source: "1", target: "*"}
          let multiplicityObj;
          if (relation.multiplicity) {
            if (typeof relation.multiplicity === 'string') {
              // Es un string, necesitamos parsearlo
              const parts = relation.multiplicity.split(':');
              multiplicityObj = {
                source: parts[0] || '',
                target: parts[1] || ''
              };
            } else {
              // Ya es un objeto, usarlo directamente
              multiplicityObj = relation.multiplicity;
            }
          }

          // Detectar si es muchos a muchos con tabla intermedia
          const isSourceMany = multiplicityObj?.source?.includes('*');
          const isTargetMany = multiplicityObj?.target?.includes('*');
          const isManyToMany = isSourceMany && isTargetMany;

          // Si es N:N con tabla intermedia, crear nodo para la tabla intermedia
          if (isManyToMany && relation.intermediateTable) {
            const sourceNode = initialNodes.find(n => n.id === relation.sourceClassId);
            const targetNode = initialNodes.find(n => n.id === relation.targetClassId);

            if (sourceNode && targetNode) {
              // Calcular posición en el medio
              const intermediatePosition = {
                x: (sourceNode.position.x + targetNode.position.x) / 2,
                y: (sourceNode.position.y + targetNode.position.y) / 2 + 80,
              };

              // Crear nodo para tabla intermedia
              const intermediateNodeId = relation.intermediateTable.id || `node_${relation.intermediateTable.name}`;

              // Verificar si ya existe el nodo
              const existingNode = intermediateTableNodes.find(n => n.id === intermediateNodeId);
              if (!existingNode) {
                const intermediateNode: Node = {
                  id: intermediateNodeId,
                  type: 'umlClass',
                  position: intermediatePosition,
                  data: {
                    id: intermediateNodeId,
                    name: relation.intermediateTable.name,
                    position: intermediatePosition,
                    attributes: relation.intermediateTable.attributes?.map((attrStr: string, idx: number) => {
                      // Parse "name: Type [STEREOTYPE]" format
                      const match = attrStr.match(/^([^:]+):\s*([^\[]+)(?:\s*\[([^\]]+)\])?/);
                      if (match) {
                        return {
                          id: `${intermediateNodeId}_attr_${idx}`,
                          name: match[1].trim(),
                          type: match[2].trim(),
                          stereotype: match[3] ? match[3].trim().toLowerCase() : undefined,
                          nullable: true,
                          unique: false,
                        };
                      }
                      return null;
                    }).filter(Boolean) || [],
                    methods: [],
                    stereotypes: ['entity'],
                    isIntermediateTable: true,
                  },
                };

                intermediateTableNodes.push(intermediateNode);
                console.log(`📦 Creado nodo para tabla intermedia desde BD: ${intermediateNode.data.name}`);
              }

              // Crear DOS edges: source -> intermediate y intermediate -> target
              const edge1: Edge = {
                id: `${relation.id}_to_intermediate`,
                source: relation.sourceClassId,
                target: intermediateNodeId,
                sourceHandle: null,
                targetHandle: null,
                type: 'umlRelationship',
                data: {
                  label: '',
                  type: 'ASSOCIATION' as any,
                  multiplicity: {
                    source: '1',
                    target: '0..*'
                  }
                }
              };

              const edge2: Edge = {
                id: `${relation.id}_from_intermediate`,
                source: intermediateNodeId,
                target: relation.targetClassId,
                sourceHandle: null,
                targetHandle: null,
                type: 'umlRelationship',
                data: {
                  label: relation.name || '',
                  type: 'ASSOCIATION' as any,
                  multiplicity: {
                    source: '0..*',
                    target: '1'
                  }
                }
              };

              console.log(`🔗 Creados 2 edges desde BD para tabla intermedia: ${relation.sourceClassId} -> ${intermediateNodeId} -> ${relation.targetClassId}`);
              return [edge1, edge2];
            }
          }

          // Relación normal (no N:N con tabla intermedia)
          return [{
            id: relation.id,
            source: relation.sourceClassId,
            target: relation.targetClassId,
            sourceHandle: relation.sourceHandle || null,
            targetHandle: relation.targetHandle || null,
            type: 'umlRelationship',
            data: {
              label: relation.name,
              type: relation.type as any,
              multiplicity: multiplicityObj,
              intermediateTable: relation.intermediateTable,
            }
          }];
        });

        setNodes([...initialNodes, ...intermediateTableNodes]);
        setEdges(initialEdges);
        console.log('✅ Cargados', initialNodes.length + intermediateTableNodes.length, 'nodos totales desde BD');
        console.log('✅ Cargados', initialEdges.length, 'edges desde BD');
        initialEdges.forEach(e => {
          console.log(`   Edge ${e.id}: ${e.source} -> ${e.target}`);
          console.log(`      Label: ${e.data?.label}, Type: ${e.data?.type}`);
          console.log(`      Multiplicidad:`, e.data?.multiplicity);
          console.log(`      Tabla intermedia:`, e.data?.intermediateTable);
        });
      } else {
        // Si no hay relaciones, solo cargar los nodos de clases
        setNodes(initialNodes);
      }

      setIsInitialized(true);
    }
  }, [diagram.id, isInitialized]); // Solo depende del ID del diagrama

  // Join collaboration room when component mounts
  useEffect(() => {
    if (socket && isConnected) {
      socket.emit(
        'join_diagram',
        {
          diagramId: diagram.id,
          afterSequence: getLastServerSequence(localStorage, diagram.id),
        },
        (acknowledgement: any) => {
          const events = acknowledgement?.events || [];
          if (events.length === 0) return;
          const latest = events[events.length - 1];
          rememberServerSequence(
            localStorage,
            diagram.id,
            latest.serverSequence,
          );
          window.location.reload();
        },
      );

      const handleRemoteChange = (data: any) => {
        console.log('📥 Recibido cambio de diagrama:', data);
        // Apply changes from other users
        if (data.userId !== userId) {
          if (data.changes.type === 'full_update' && data.changes.data) {
            confirmedDataRef.current = data.changes.data;
            if (Number.isInteger(data.version)) {
              confirmedVersionRef.current = data.version;
            }
            if (Number.isInteger(data.sequence)) {
              rememberServerSequence(localStorage, diagram.id, data.sequence);
            }
            return;
          }
          if (data.changes.type === 'nodes') {
            console.log('🔄 Actualizando solo nodos');
            setNodes(data.changes.nodes);
          } else if (data.changes.type === 'edges') {
            console.log('🔄 Actualizando solo edges');
            setEdges(data.changes.edges);
          } else if (data.changes.type === 'full_update') {
            console.log('🔄 Actualización completa de diagrama');
            setNodes(data.changes.nodes);
            setEdges(data.changes.edges);
          }
        } else {
          console.log('⏭️ Ignorando mi propio cambio');
        }
      };
      socket.on('diagram_change', handleRemoteChange);
      socket.on('diagram_preview', handleRemoteChange);

      socket.on('user_joined', (data) => {
        console.log('User joined:', data.userName);
      });

      socket.on('user_left', (data) => {
        console.log('User left:', data.userId);
      });
    }

    return () => {
      if (socket) {
        emit('leave_diagram', { diagramId: diagram.id });
        socket.off('diagram_change');
        socket.off('diagram_preview');
        socket.off('user_joined');
        socket.off('user_left');
      }
    };
  }, [socket, isConnected, diagram.id, userId, userName, emit, setNodes, setEdges]);

  // Handle connection creation
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: 'umlRelationship',
        data: {
          label: 'association',
          type: 'ASSOCIATION',
        }
      };

      setEdges((eds) => {
        const updatedEdges = addEdge(newEdge, eds);

        // Broadcast change to other users
        if (socket && isConnected) {
          emit('diagram_preview', {
            diagramId: diagram.id,
            changes: {
              type: 'edges',
              edges: updatedEdges,
            },
          });
        }

        return updatedEdges;
      });
    },
    [setEdges, socket, isConnected, emit, diagram.id, userId]
  );

  // Handle edge reconnection (moving connection points)
  const onEdgeUpdate: OnEdgeUpdateFunc = useCallback(
    (oldEdge, newConnection) => {
      console.log('🔄 Reconectando edge:', {
        edgeId: oldEdge.id,
        oldSource: oldEdge.source,
        oldTarget: oldEdge.target,
        oldSourceHandle: oldEdge.sourceHandle,
        oldTargetHandle: oldEdge.targetHandle,
        newSource: newConnection.source,
        newTarget: newConnection.target,
        newSourceHandle: newConnection.sourceHandle,
        newTargetHandle: newConnection.targetHandle,
      });

      setEdges((eds) => {
        const updatedEdges = updateEdge(oldEdge, newConnection, eds);

        // Broadcast change to other users
        if (socket && isConnected) {
          emit('diagram_preview', {
            diagramId: diagram.id,
            changes: {
              type: 'edges',
              edges: updatedEdges,
            },
          });
        }

        // Auto-save after reconnection
        setTimeout(() => handleSave(), 300);

        return updatedEdges;
      });
    },
    [setEdges, socket, isConnected, emit, diagram.id, userId, handleSave]
  );

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // Handle node double click to edit
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setIsEditingClass(true);
  }, []);

  // Handle adding new class
  const onAddClass = useCallback((position: { x: number; y: number }) => {
    const newClass: UMLClass = {
      id: `class-${Date.now()}`,
      name: 'NewClass',
      position,
      attributes: [
        {
          id: `attr-${Date.now()}`,
          name: 'id',
          type: 'Long',
          stereotype: 'id',
          nullable: false,
          unique: true,
        },
      ],
      methods: [],
    };

    const newNode: Node = {
      id: newClass.id,
      type: 'umlClass',
      position,
      data: newClass,
    };

    setNodes((nds) => {
      const updatedNodes = nds.concat(newNode);

      // Broadcast change to other users
      if (socket && isConnected) {
        emit('diagram_preview', {
          diagramId: diagram.id,
          changes: {
            type: 'nodes',
            nodes: updatedNodes,
          },
        });
      }

      return updatedNodes;
    });

    setSelectedNode(newNode);
    setIsEditingClass(true);
  }, [setNodes, socket, isConnected, emit, diagram.id, userId]);

  // Handle canvas double-click to add class
  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (reactFlowInstance && reactFlowWrapper.current) {
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = reactFlowInstance.project({
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        });
        onAddClass(position);
      }
    },
    [reactFlowInstance, onAddClass]
  );

  // Handle class update
  const onUpdateClass = useCallback((updatedClass: UMLClass) => {
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === updatedClass.id) {
          return {
            ...node,
            data: updatedClass,
          };
        }
        return node;
      });

      // Broadcast change to other users
      if (socket && isConnected) {
        emit('diagram_preview', {
          diagramId: diagram.id,
          changes: {
            type: 'nodes',
            nodes: updatedNodes,
          },
        });
      }

      return updatedNodes;
    });
    setIsEditingClass(false);
    setSelectedNode(null);
  }, [setNodes, socket, isConnected, emit, diagram.id, userId]);

  // Handle edge double click to edit relationship
  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: any) => {
    setSelectedEdge(edge);
    setIsEditingRelationship(true);
  }, []);

  // Handle relationship update
  const onUpdateRelationship = useCallback((updatedRelationship: any) => {
    // Buscar el edge original
    const originalEdge = edges.find(e => e.id === updatedRelationship.id);
    if (!originalEdge) return;

    // Verificar si es una relación muchos a muchos
    const isSourceMany = updatedRelationship.multiplicity?.source?.includes('*') || updatedRelationship.multiplicity?.source === '*';
    const isTargetMany = updatedRelationship.multiplicity?.target?.includes('*') || updatedRelationship.multiplicity?.target === '*';
    const isManyToMany = isSourceMany && isTargetMany;

    // Actualizar la relación
    setEdges((eds) => {
      const updatedEdges = eds.map((edge) => {
        if (edge.id === updatedRelationship.id) {
          const newEdgeData: any = {
            label: updatedRelationship.label,
            type: isManyToMany ? 'ManyToMany' : updatedRelationship.type,
            multiplicity: updatedRelationship.multiplicity,
          };

          // Si es N:N, agregar información de tabla intermedia
          if (isManyToMany) {
            const sourceNode = nodes.find(n => n.id === originalEdge.source);
            const targetNode = nodes.find(n => n.id === originalEdge.target);

            if (sourceNode && targetNode) {
              const sourceClassName = sourceNode.data.name.toLowerCase();
              const targetClassName = targetNode.data.name.toLowerCase();
              const intermediateTableName = `${sourceClassName}_${targetClassName}`;

              newEdgeData.intermediateTable = {
                name: intermediateTableName,
                attributes: [
                  'id: Long [PK]',
                  `${sourceClassName}_id: Long [FK]`,
                  `${targetClassName}_id: Long [FK]`
                ]
              };

              console.log(`✨ Relación N:N marcada con tabla intermedia: ${intermediateTableName}`);
            }
          }

          return {
            ...edge,
            data: newEdgeData,
          };
        }
        return edge;
      });

      // Broadcast change to other users
      if (socket && isConnected) {
        emit('diagram_preview', {
          diagramId: diagram.id,
          changes: {
            type: 'edges',
            edges: updatedEdges,
          },
        });
      }

      return updatedEdges;
    });

    setIsEditingRelationship(false);
    setSelectedEdge(null);

    // Guardar cambios
    setTimeout(() => handleSave(), 100);
  }, [setEdges, nodes, edges, socket, isConnected, emit, diagram.id, userId, handleSave]);

  // handleSave is defined above, near the top of the component

  // Handle adding elements from sidebar
  const handleAddElement = useCallback((element: any, position?: { x: number; y: number }) => {
    if (element.type === 'umlClass') {
      const newNode = {
        id: element.data.id,
        type: 'umlClass',
        position: position || reactFlowInstance?.project({
          x: window.innerWidth / 2 - 200,
          y: window.innerHeight / 2 - 100
        }) || { x: 200, y: 200 },
        data: element.data,
      };

      setNodes((nds) => [...nds, newNode]);

      // Emit to collaborators
      if (socket && isConnected) {
        emit('diagram_preview', {
          diagramId: diagram.id,
          changes: {
            type: 'nodes',
            nodes: [...nodes, newNode],
          },
        });
      }
    }
  }, [reactFlowInstance, setNodes, socket, isConnected, emit, diagram.id, userId, nodes]);

  // Handle drop from sidebar
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const elementData = event.dataTransfer.getData('application/json');

      if (!elementData || !reactFlowInstance || !reactFlowWrapper.current) {
        return;
      }

      // Get the bounding rect to calculate correct position
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const element = JSON.parse(elementData);
      const newElement = {
        ...element,
        data: {
          ...element.data,
          id: `${element.data.id}_${Date.now()}` // Make unique
        }
      };

      handleAddElement(newElement, position);
    },
    [reactFlowInstance, handleAddElement]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle UML generation from AI
  const handleUMLGenerated = useCallback((umlModel: any) => {
    try {
      console.log('🤖 IA generó modelo completo:', JSON.stringify(umlModel, null, 2));

      if (!umlModel) {
        throw new Error('umlModel is null or undefined');
      }

      if (!umlModel.classes) {
        throw new Error('umlModel.classes is missing');
      }

      console.log(`📊 Procesando ${umlModel.classes.length} clases...`);

      const newNodes = umlModel.classes.map((umlClass: any) => ({
        id: umlClass.id,
        type: 'umlClass',
        position: umlClass.position,
        data: umlClass,
      }));

      const intermediateTableNodes: any[] = [];
      const newEdges = umlModel.relations?.flatMap((relation: any) => {
        // Parsear multiplicity si es string
        let multiplicityObj = relation.multiplicity;
        if (typeof relation.multiplicity === 'string' && relation.multiplicity.includes(':')) {
          const parts = relation.multiplicity.split(':');
          multiplicityObj = {
            source: parts[0] || '',
            target: parts[1] || ''
          };
        }

        // Detectar si es muchos a muchos
        const isSourceMany = multiplicityObj?.source?.includes('*');
        const isTargetMany = multiplicityObj?.target?.includes('*');
        const isManyToMany = isSourceMany && isTargetMany;

        console.log(`🔗 Creando edge ${relation.id}: ${relation.sourceClassId} -> ${relation.targetClassId}`);
        console.log(`   Multiplicidad:`, multiplicityObj);
        console.log(`   Es N:N: ${isManyToMany}`);

        // Si es N:N con tabla intermedia, crear nodo para la tabla intermedia
        if (isManyToMany && relation.intermediateTable) {
          const sourceNode = [...newNodes, ...intermediateTableNodes].find(n => n.id === relation.sourceClassId);
          const targetNode = [...newNodes, ...intermediateTableNodes].find(n => n.id === relation.targetClassId);

          if (sourceNode && targetNode) {
            // Calcular posición en el medio
            const intermediatePosition = {
              x: (sourceNode.position.x + targetNode.position.x) / 2,
              y: (sourceNode.position.y + targetNode.position.y) / 2 + 80,
            };

            // Crear nodo para tabla intermedia
            const intermediateNodeId = relation.intermediateTable.id || `node_${relation.intermediateTable.name}`;
            const intermediateNode = {
              id: intermediateNodeId,
              type: 'umlClass', // Usar el mismo tipo que las clases normales
              position: intermediatePosition,
              data: {
                id: intermediateNodeId,
                name: relation.intermediateTable.name,
                position: intermediatePosition,
                attributes: relation.intermediateTable.attributes?.map((attrStr: string, idx: number) => {
                  // Parse "name: Type [STEREOTYPE]" format
                  const match = attrStr.match(/^([^:]+):\s*([^\[]+)(?:\s*\[([^\]]+)\])?/);
                  if (match) {
                    return {
                      id: `${intermediateNodeId}_attr_${idx}`,
                      name: match[1].trim(),
                      type: match[2].trim(),
                      stereotype: match[3] ? match[3].trim().toLowerCase() : undefined,
                      nullable: true,
                      unique: false,
                    };
                  }
                  return null;
                }).filter(Boolean) || [],
                methods: [],
                stereotypes: ['entity'],
                isIntermediateTable: true, // Marcar como tabla intermedia
              },
            };

            intermediateTableNodes.push(intermediateNode);
            console.log(`📦 Creado nodo para tabla intermedia: ${intermediateNode.data.name}`);

            // Crear DOS edges: source -> intermediate y intermediate -> target
            const edge1 = {
              id: `${relation.id}_to_intermediate`,
              source: relation.sourceClassId,
              target: intermediateNodeId,
              type: 'umlRelationship',
              data: {
                label: '',
                type: 'ASSOCIATION',
                multiplicity: {
                  source: '1',
                  target: '0..*'
                }
              }
            };

            const edge2 = {
              id: `${relation.id}_from_intermediate`,
              source: intermediateNodeId,
              target: relation.targetClassId,
              type: 'umlRelationship',
              data: {
                label: relation.name || '',
                type: 'ASSOCIATION',
                multiplicity: {
                  source: '0..*',
                  target: '1'
                }
              }
            };

            console.log(`🔗 Creados 2 edges para tabla intermedia: ${relation.sourceClassId} -> ${intermediateNodeId} -> ${relation.targetClassId}`);
            return [edge1, edge2];
          }
        }

        // Relación normal (no N:N con tabla intermedia)
        return [{
          id: relation.id,
          source: relation.sourceClassId,
          target: relation.targetClassId,
          type: 'umlRelationship',
          data: {
            label: relation.name,
            type: relation.type,
            multiplicity: multiplicityObj,
            intermediateTable: relation.intermediateTable,
          }
        }];
      }) || [];

      console.log('📊 Aplicando nodos:', newNodes.length, 'edges:', newEdges.length, 'intermediate tables:', intermediateTableNodes.length);

      // Update nodes and edges - IMPORTANT: Reemplazar completamente con lo generado por IA
      let finalNodes: any[] = [];
      let finalEdges: any[] = [];

      setNodes(() => {
        finalNodes = [...newNodes, ...intermediateTableNodes];
        console.log('✅ Nodos totales después de IA (REPLACED):', finalNodes.length);
        return finalNodes;
      });

      setEdges(() => {
        finalEdges = [...newEdges];
        console.log('✅ Edges totales después de IA (REPLACED):', finalEdges.length);
        return finalEdges;
      });

      // Wait a bit for state to update, then broadcast and save
      setTimeout(() => {
        // Broadcast to collaborators
        if (socket && isConnected) {
          emit('diagram_preview', {
            diagramId: diagram.id,
            changes: {
              type: 'full_update',
              nodes: finalNodes,
              edges: finalEdges,
            },
          });
          console.log('📡 Cambios enviados por WebSocket');
        }

        // Save to database
        console.log('💾 Intentando guardar diagrama en BD...');
        try {
          handleSave();
          console.log('✅ Diagrama guardado exitosamente en BD');
        } catch (saveError) {
          console.error('❌ Error al guardar diagrama:', saveError);
        }
      }, 500);
    } catch (error) {
      console.error('❌❌❌ ERROR EN handleUMLGenerated ❌❌❌');
      console.error('Error completo:', error);
      console.error('Stack:', (error as Error).stack);
      throw error; // Re-lanzar para que lo capture el catch del AIChatInterface
    }
  }, [setNodes, setEdges, handleSave, socket, isConnected, emit, diagram.id, userId]);

  return (
    <div className="h-full w-full flex">
      {/* Sidebar Izquierdo - Elementos UML */}
      <UMLSidebar onAddElement={handleAddElement} />

      {/* Área Principal del Editor */}
      <div className="flex-1 flex flex-col">
        {/* Barra de Herramientas */}
        <UMLToolbar
          onAddClass={() => onAddClass({ x: 100, y: 100 })}
          onSave={handleSave}
          onEditClass={() => selectedNode && setIsEditingClass(true)}
          hasSelectedNode={!!selectedNode}
          isConnected={isConnected}
        />

        {/* Área del Canvas */}
        <div className="flex-1 relative">
          <div
            ref={reactFlowWrapper}
            className="h-full w-full"
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeUpdate={onEdgeUpdate}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onEdgeClick={onEdgeClick}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onInit={setReactFlowInstance}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              edgeUpdaterRadius={15}
              edgesUpdatable={true}
              fitView
              className="bg-gray-50"
              connectionLineStyle={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 }}
              defaultEdgeOptions={{
                type: 'smoothstep', // Líneas rectas con esquinas de 90°
                style: { strokeWidth: 2, stroke: 'hsl(var(--muted-foreground))' },
              }}
              snapToGrid={true}
              snapGrid={[20, 20]}
            >
              <Controls
                position="bottom-left"
                className="bg-card shadow-lg rounded-md border border-border"
              />
              <MiniMap
                nodeColor="hsl(var(--primary))"
                nodeStrokeWidth={2}
                className="bg-card shadow-lg rounded-md border border-border"
                position="bottom-right"
              />
              <Background
                color="hsl(var(--border))"
                gap={20}
                size={2}
              />
            </ReactFlow>
          </div>

          {/* Estado de Conexión */}
          <div className="absolute top-4 right-4 z-10">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium shadow-sm ${
                isConnected
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}
              />
              {isConnected ? t('diagramEditor.status.connected') : t('diagramEditor.status.disconnected')}
            </div>
          </div>
          {syncError && (
            <div className="absolute top-16 right-4 z-10 max-w-sm rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm">
              {syncError}
            </div>
          )}

          {/* Modal Editor de Clase */}
          {isEditingClass && selectedNode && (
            <ClassEditor
              umlClass={selectedNode.data as UMLClass}
              onSave={onUpdateClass}
              onCancel={() => setIsEditingClass(false)}
            />
          )}

          {/* Modal Editor de Relación */}
          {isEditingRelationship && selectedEdge && (
            <RelationshipEditor
              relationship={{
                id: selectedEdge.id,
                label: selectedEdge.data?.label,
                type: selectedEdge.data?.type,
                multiplicity: selectedEdge.data?.multiplicity,
              }}
              onSave={onUpdateRelationship}
              onCancel={() => setIsEditingRelationship(false)}
            />
          )}
        </div>
      </div>

      {/* Lado Derecho - Chat IA */}
      {isChatOpen && (
        <div className="w-80 border-l border-border bg-card flex-shrink-0">
          <AIChatInterface
            diagramId={diagram.id}
            onUMLGenerated={handleUMLGenerated}
            onClose={() => setIsChatOpen(false)}
            isOpen={isChatOpen}
          />
        </div>
      )}

      {/* Botón Flotante Chat */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          aria-label={t('diagramEditor.actions.openChat')}
          title={t('diagramEditor.actions.openChat')}
          className="fixed bottom-6 right-6 bg-primary hover:bg-primary/90 text-primary-foreground p-4 rounded-full shadow-lg shadow-primary/20 transition-all duration-200 z-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
    </div>
  );
}
