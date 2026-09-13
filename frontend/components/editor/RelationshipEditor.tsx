'use client';

import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';

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
  const { t } = useI18n();

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
          <h2 className="text-lg font-semibold text-gray-800">{t('diagramEditor.relationship.title')}</h2>
          <button
            onClick={onCancel}
            aria-label={t('diagramEditor.actions.close')}
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
              {t('diagramEditor.relationship.name')}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder={t('diagramEditor.relationship.namePlaceholder')}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('diagramEditor.relationship.type')}
            </label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="ASSOCIATION">{t('diagramEditor.relationship.association')}</option>
              <option value="AGGREGATION">{t('diagramEditor.relationship.aggregation')}</option>
              <option value="COMPOSITION">{t('diagramEditor.relationship.composition')}</option>
              <option value="INHERITANCE">{t('diagramEditor.relationship.inheritance')}</option>
              <option value="DEPENDENCY">{t('diagramEditor.relationship.dependency')}</option>
            </select>
          </div>

          {/* Multiplicity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('diagramEditor.relationship.sourceMultiplicity')}
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
                {t('diagramEditor.relationship.targetMultiplicity')}
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
            <p className="font-medium mb-1">{t('diagramEditor.relationship.examples')}</p>
            <ul className="space-y-1">
              <li>• <code>1</code> - {t('diagramEditor.relationship.exactlyOne')}</li>
              <li>• <code>0..1</code> - {t('diagramEditor.relationship.zeroOrOne')}</li>
              <li>• <code>1..*</code> - {t('diagramEditor.relationship.oneOrMany')}</li>
              <li>• <code>*</code> - {t('diagramEditor.relationship.zeroOrMany')}</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 flex items-center space-x-2"
          >
            <Save size={16} />
            <span>{t('common.save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
