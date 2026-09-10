'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Type, Database } from 'lucide-react';
import { UMLClass, UMLAttribute, UMLMethod } from '@/types/uml';

interface ClassEditorProps {
  umlClass: UMLClass;
  onSave: (updatedClass: UMLClass) => void;
  onCancel: () => void;
}

const javaTypes = [
  'String', 'Integer', 'Long', 'Boolean', 'BigDecimal',
  'LocalDate', 'LocalDateTime', 'Double', 'Float', 'Byte'
];

const visibilityOptions = ['public', 'private', 'protected'];

export default function ClassEditor({ umlClass, onSave, onCancel }: ClassEditorProps) {
  const [className, setClassName] = useState(umlClass.name);
  const [attributes, setAttributes] = useState<UMLAttribute[]>(umlClass.attributes || []);
  const [methods, setMethods] = useState<UMLMethod[]>(umlClass.methods || []);

  // Add new attribute
  const addAttribute = () => {
    const newAttribute: UMLAttribute = {
      id: `attr-${Date.now()}`,
      name: 'newAttribute',
      type: 'String',
      nullable: true,
      unique: false,
    };
    setAttributes([...attributes, newAttribute]);
  };

  // Update attribute
  const updateAttribute = (index: number, field: keyof UMLAttribute, value: any) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], [field]: value };
    setAttributes(updated);
  };

  // Remove attribute
  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  // Add new method
  const addMethod = () => {
    const newMethod: UMLMethod = {
      id: `method-${Date.now()}`,
      name: 'newMethod',
      returnType: 'void',
      parameters: [],
      visibility: 'public',
    };
    setMethods([...methods, newMethod]);
  };

  // Update method
  const updateMethod = (index: number, field: keyof UMLMethod, value: any) => {
    const updated = [...methods];
    updated[index] = { ...updated[index], [field]: value };
    setMethods(updated);
  };

  // Remove method
  const removeMethod = (index: number) => {
    setMethods(methods.filter((_, i) => i !== index));
  };

  // Save changes
  const handleSave = () => {
    const updatedClass: UMLClass = {
      ...umlClass,
      name: className,
      attributes,
      methods,
    };
    onSave(updatedClass);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Database className="mr-2" size={20} />
            Editar Clase
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Class Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class Name
            </label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter class name"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attributes Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Type className="mr-2" size={18} />
                  Attributes
                </h3>
                <button
                  onClick={addAttribute}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>

              <div className="space-y-3">
                {attributes.map((attr, index) => (
                  <div key={attr.id} className="border border-gray-200 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={attr.name}
                        onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Attribute name"
                      />
                      <button
                        onClick={() => removeAttribute(index)}
                        className="ml-2 text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={attr.type}
                        onChange={(e) => updateAttribute(index, 'type', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {javaTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={attr.multiplicity || ''}
                        onChange={(e) => updateAttribute(index, 'multiplicity', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Multiplicity"
                      />
                    </div>

                    <div className="flex items-center flex-wrap gap-3 mt-2">
                      <label className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={!attr.nullable}
                          onChange={(e) => updateAttribute(index, 'nullable', !e.target.checked)}
                          className="mr-1"
                        />
                        Not Null
                      </label>
                      <label className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={attr.unique}
                          onChange={(e) => updateAttribute(index, 'unique', e.target.checked)}
                          className="mr-1"
                        />
                        Unique
                      </label>
                      <label className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={attr.stereotype === 'id'}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateAttribute(index, 'stereotype', 'id');
                            } else if (attr.stereotype === 'id') {
                              updateAttribute(index, 'stereotype', undefined);
                            }
                          }}
                          className="mr-1"
                        />
                        Primary Key
                      </label>
                      <label className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={attr.stereotype === 'fk'}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateAttribute(index, 'stereotype', 'fk');
                            } else if (attr.stereotype === 'fk') {
                              updateAttribute(index, 'stereotype', undefined);
                            }
                          }}
                          className="mr-1"
                        />
                        Foreign Key
                      </label>
                    </div>
                  </div>
                ))}

                {attributes.length === 0 && (
                  <div className="text-gray-500 text-sm italic text-center py-4">
                    No attributes. Click "Add" to create one.
                  </div>
                )}
              </div>
            </div>

            {/* Methods Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Methods</h3>
                <button
                  onClick={addMethod}
                  className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>

              <div className="space-y-3">
                {methods.map((method, index) => (
                  <div key={method.id} className="border border-gray-200 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={method.name}
                        onChange={(e) => updateMethod(index, 'name', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Method name"
                      />
                      <button
                        onClick={() => removeMethod(index)}
                        className="ml-2 text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={method.visibility}
                        onChange={(e) => updateMethod(index, 'visibility', e.target.value as 'public' | 'private' | 'protected')}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {visibilityOptions.map((visibility) => (
                          <option key={visibility} value={visibility}>
                            {visibility}
                          </option>
                        ))}
                      </select>

                      <select
                        value={method.returnType}
                        onChange={(e) => updateMethod(index, 'returnType', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="void">void</option>
                        {javaTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                {methods.length === 0 && (
                  <div className="text-gray-500 text-sm italic text-center py-4">
                    No methods. Click "Add" to create one.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-foreground bg-card border border-border rounded-md hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Save size={16} />
            <span>Save Class</span>
          </button>
        </div>
      </div>
    </div>
  );
}
