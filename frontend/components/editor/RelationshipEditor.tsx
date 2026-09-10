'use client';

import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

interface RelationshipEditorProps {
  relationship: {
    id: string;
    label?: string;
    type?: string;
    multiplicity?: {
      source?: string;
      target?: string;
    };
  };
  onSave: (updatedRelationship: any) => void;
  onCancel: () => void;
}

export default function RelationshipEditor({ relationship, onSave, onCancel }: RelationshipEditorProps) {
  const [label, setLabel] = useState(relationship.label || '');
  const [sourceMultiplicity, setSourceMultiplicity] = useState(relationship.multiplicity?.source || '');
  const [targetMultiplicity, setTargetMultiplicity] = useState(relationship.multiplicity?.target || '');
  const [relationType, setRelationType] = useState(relationship.type || 'ASSOCIATION');

  const handleSave = () => {
    onSave({
      ...relationship,
      label: label.trim(),
      type: relationType,
      multiplicity: {
        source: sourceMultiplicity.trim(),
        target: targetMultiplicity.trim(),
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Editar Relación</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la Relación
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder="nombreRelacion"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Relación
            </label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="ASSOCIATION">Asociación</option>
              <option value="AGGREGATION">Agregación</option>
              <option value="COMPOSITION">Composición</option>
              <option value="INHERITANCE">Herencia</option>
              <option value="DEPENDENCY">Dependencia</option>
            </select>
          </div>

          {/* Multiplicity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Multiplicidad Origen
              </label>
              <input
                type="text"
                value={sourceMultiplicity}
                onChange={(e) => setSourceMultiplicity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="1, 0..1, 1..*"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Multiplicidad Destino
              </label>
              <input
                type="text"
                value={targetMultiplicity}
                onChange={(e) => setTargetMultiplicity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="1, 0..1, 1..*"
              />
            </div>
          </div>

          {/* Examples */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <p className="font-medium mb-1">Ejemplos de multiplicidad:</p>
            <ul className="space-y-1">
              <li>• <code>1</code> - Exactamente uno</li>
              <li>• <code>0..1</code> - Cero o uno</li>
              <li>• <code>1..*</code> - Uno o muchos</li>
              <li>• <code>*</code> - Cero o muchos</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 flex items-center space-x-2"
          >
            <Save size={16} />
            <span>Guardar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
