'use client';

import React, { useEffect, useState } from 'react';
import {
  Layers,
  Box,
  Database,
  Users,
  FileText,
  Zap,
  Circle,
  Square,
  Triangle,
  ChevronDown,
  ChevronRight,
  Lightbulb
} from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';

interface UMLTemplate {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: string;
  data: any;
}

interface SidebarSection {
  title: string;
  icon: React.ReactNode;
  items: UMLTemplate[];
  isOpen: boolean;
}

export default function UMLSidebar({ onAddElement }: { onAddElement: (element: any) => void }) {
  const { t } = useI18n();
  const [sections, setSections] = useState<SidebarSection[]>([
    {
      title: t('diagramEditor.sidebar.classes'),
      icon: <Box size={16} />,
      isOpen: true,
      items: [
        {
          id: 'basic-class',
          name: t('diagramEditor.sidebar.class'),
          icon: <Box size={14} />,
          type: 'umlClass',
          data: {
            id: `class_${Date.now()}`,
            name: 'NuevaClase',
            position: { x: 0, y: 0 },
            attributes: [
              { id: 'attr_1', name: 'id', type: 'Long', stereotype: 'id', nullable: false, unique: true }
            ],
            methods: [],
            stereotypes: ['class']
          }
        }
      ]
    }
  ]);

  useEffect(() => {
    setSections((current) => current.map((section) => ({
      ...section,
      title: t('diagramEditor.sidebar.classes'),
      items: section.items.map((item) => ({
        ...item,
        name: t('diagramEditor.sidebar.class'),
      })),
    })));
  }, [t]);

  const toggleSection = (index: number) => {
    setSections(prev => prev.map((section, i) =>
      i === index ? { ...section, isOpen: !section.isOpen } : section
    ));
  };

  const handleDragStart = (e: React.DragEvent, item: UMLTemplate) => {
    // Create a new instance with unique ID for drag operation
    const newItem = {
      ...item,
      data: {
        ...item.data,
        id: `class_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    };
    e.dataTransfer.setData('application/json', JSON.stringify(newItem));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleItemClick = (item: UMLTemplate) => {
    if (onAddElement) {
      // Create a new instance with unique ID for click operation
      const newItem = {
        ...item,
        data: {
          ...item.data,
          id: `class_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      };
      onAddElement(newItem);
    }
  };

  return (
    <div className="w-80 bg-card border-r border-border h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          <Layers className="mr-2" size={20} />
          {t('diagramEditor.sidebar.title')}
        </h2>
        <p className="text-sm text-gray-600 mt-1">{t('diagramEditor.sidebar.instruction')}</p>
      </div>

      {/* Sections */}
      <div className="p-2">
        {sections.map((section, sectionIndex) => (
          <div key={section.title} className="mb-4">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(sectionIndex)}
              className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 rounded-md transition-colors"
            >
              <div className="flex items-center text-sm font-medium text-gray-800">
                {section.icon}
                <span className="ml-2">{section.title}</span>
              </div>
              {section.isOpen ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </button>

            {/* Section Items */}
            {section.isOpen && (
              <div className="ml-2 mt-1 space-y-1">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onClick={() => handleItemClick(item)}
                    className="flex items-center p-3 border border-gray-300 rounded hover:bg-gray-200 hover:border-gray-400 cursor-pointer transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-gray-200 rounded mr-3 group-hover:bg-gray-300">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{item.type.replace('uml', '')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="p-4 bg-muted border-t border-border mt-auto">
        <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
          <Lightbulb size={15} className="text-primary" aria-hidden="true" />
          {t('diagramEditor.sidebar.tips')}
        </h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>{t('diagramEditor.sidebar.tipDrag')}</li>
          <li>{t('diagramEditor.sidebar.tipClick')}</li>
          <li>{t('diagramEditor.sidebar.tipAI')}</li>
          <li>{t('diagramEditor.sidebar.tipConnect')}</li>
        </ul>
      </div>
    </div>
  );
}
