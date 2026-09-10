'use client';

import React from 'react';
import {
  Plus,
  Save,
  Edit3,
  Download,
  Zap,
  Users,
  MessageCircle,
  Undo,
  Redo,
  Grid,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface UMLToolbarProps {
  onAddClass: () => void;
  onSave: () => void;
  onEditClass: () => void;
  hasSelectedNode: boolean;
  isConnected: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onGenerateCode?: () => void;
  onOpenChat?: () => void;
}

export default function UMLToolbar({
  onAddClass,
  onSave,
  onEditClass,
  hasSelectedNode,
  isConnected,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onGenerateCode,
  onOpenChat,
}: UMLToolbarProps) {
  return (
    <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      {/* Sección Izquierda - Estado de Colaboración */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Users size={16} className={isConnected ? 'text-primary' : 'text-gray-400'} />
          <span className="text-sm text-gray-600">
            {isConnected ? 'Colaborando' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Sección Central - Título */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-700">Editor UML</h1>
      </div>

      {/* Sección Derecha - Solo Guardar */}
      <div className="flex items-center space-x-1">
        <button
          onClick={onSave}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm"
          title="Guardar Diagrama"
        >
          <Save size={16} />
          <span>GUARDAR</span>
        </button>
      </div>
    </div>
  );
}
