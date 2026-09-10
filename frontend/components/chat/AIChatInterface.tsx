'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, X, Lightbulb, Image as ImageIcon } from 'lucide-react';
import { aiAPI } from '@/lib/api';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  imageUrl?: string;
}

interface AIChatInterfaceProps {
  diagramId: string;
  onUMLGenerated?: (umlModel: any) => void;
  onClose?: () => void;
  isOpen: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

export default function AIChatInterface({ diagramId, onUMLGenerated, onClose, isOpen }: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load initial data when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadInitialData();
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      // Load templates and suggestions
      const [templatesResponse, suggestionsResponse] = await Promise.all([
        aiAPI.getTemplates(),
        aiAPI.getSuggestions()
      ]);

      setTemplates(templatesResponse.templates || []);
      setSuggestions(suggestionsResponse.suggestions || []);

      // Add welcome message with loaded suggestions
      const welcomeMessage: ChatMessage = {
        id: '1',
        type: 'ai',
        content: '👋 ¡Hola! Soy tu asistente UML con IA powered by Claude 3 Haiku. Puedo ayudarte a crear diagramas de clases desde descripciones en lenguaje natural. ¡Describe un sistema que quieras modelar!',
        timestamp: new Date(),
        suggestions: suggestionsResponse.suggestions?.slice(0, 3) || []
      };

      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Fallback to static message
      const fallbackMessage: ChatMessage = {
        id: '1',
        type: 'ai',
        content: '👋 ¡Hola! Soy tu asistente UML con IA. Puedo ayudarte a crear diagramas de clases desde descripciones en lenguaje natural. ¡Describe un sistema que quieras modelar!',
        timestamp: new Date(),
        suggestions: [
          'Crear un sistema e-commerce con productos, categorías y usuarios',
          'Diseñar un sistema de gestión de biblioteca con libros, autores y prestamistas',
          'Construir una plataforma de blog con posts, comentarios y etiquetas'
        ]
      };
      setMessages([fallbackMessage]);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    // Leer el archivo como base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSelectedImage(base64String);
      setImagePreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || inputMessage.trim();
    if ((!text && !selectedImage) || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: text || '📷 Imagen de diagrama enviada',
      timestamp: new Date(),
      imageUrl: imagePreview || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    const imageToSend = selectedImage;
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsLoading(true);

    try {
      // Get AI response with diagram context and image if provided
      const chatResponse = await aiAPI.chat(text || 'Analiza este diagrama', diagramId, imageToSend || undefined);

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: chatResponse.response,
        timestamp: new Date(),
        suggestions: chatResponse.suggestions,
      };

      setMessages(prev => [...prev, aiMessage]);

      // If the response includes a UML model, apply it automatically
      if (chatResponse.model && onUMLGenerated) {
        console.log('✅ Diagrama UML recibido, aplicando automáticamente:', chatResponse.model.name);
        onUMLGenerated(chatResponse.model);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '😅 Lo siento, estoy teniendo problemas ahora. Por favor intenta de nuevo en un momento.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full h-full bg-card flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-primary bg-primary text-primary-foreground flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Bot size={20} />
          <h3 className="font-semibold">Asistente UML IA</h3>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded p-3 ${
              message.type === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 text-gray-900'
            }`}>
              <div className="flex items-start space-x-2">
                {message.type === 'ai' && (
                  <Bot size={16} className="text-gray-600 mt-0.5 flex-shrink-0" />
                )}
                {message.type === 'user' && (
                  <User size={16} className="text-white mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  {/* Image preview in message */}
                  {message.imageUrl && (
                    <div className="mb-2">
                      <img
                        src={message.imageUrl}
                        alt="Diagrama enviado"
                        className="max-w-full h-auto rounded border border-gray-300"
                        style={{ maxHeight: '200px' }}
                      />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {/* Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <Lightbulb size={12} />
                        <span>Prueba estos ejemplos:</span>
                      </div>
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSendMessage(suggestion)}
                          className="block w-full text-left text-xs p-2 bg-card border border-border rounded hover:bg-muted transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={`text-xs mt-1 ${message.type === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Bot size={16} className="text-gray-600" />
                <Loader2 size={16} className="animate-spin text-gray-600" />
                <span className="text-sm text-gray-600">Pensando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-2 relative inline-block">
            <img
              src={imagePreview}
              alt="Vista previa"
              className="max-h-24 rounded border border-gray-300"
            />
            <button
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex items-center space-x-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Image upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-2 rounded border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Subir imagen de diagrama"
          >
            <ImageIcon size={16} className="text-gray-600" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe tu diagrama o sube una imagen..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={(!inputMessage.trim() && !selectedImage) || isLoading}
            className={`p-2 rounded transition-colors ${
              (!inputMessage.trim() && !selectedImage) || isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex items-center justify-between mt-3 gap-2">
          <button
            onClick={() => handleSendMessage("Crear un sistema de farmacia")}
            className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-1"
            disabled={isLoading}
          >
            <Sparkles size={12} />
            <span>Rápido: Farmacia</span>
          </button>

          <button
            onClick={() => handleSendMessage("Diseñar un e-commerce")}
            className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-1"
            disabled={isLoading}
          >
            <Sparkles size={12} />
            <span>Rápido: E-commerce</span>
          </button>

          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-1"
            disabled={isLoading}
          >
            <Lightbulb size={12} />
            <span>Plantillas</span>
          </button>
        </div>

        {/* Templates dropdown */}
        {showTemplates && templates.length > 0 && (
          <div className="mt-2 p-2 bg-gray-50 rounded-md">
            <div className="text-xs font-medium text-gray-700 mb-2">Plantillas Rápidas:</div>
            <div className="grid grid-cols-1 gap-1">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    handleSendMessage(template.prompt);
                    setShowTemplates(false);
                  }}
                  className="text-left text-xs p-2 bg-card border border-border rounded hover:bg-muted transition-colors"
                  disabled={isLoading}
                >
                  <div className="font-medium text-gray-900">{template.name}</div>
                  <div className="text-gray-600 truncate">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
