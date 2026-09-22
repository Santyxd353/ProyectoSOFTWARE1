'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, X, Lightbulb, Image as ImageIcon } from 'lucide-react';
import { aiAPI } from '@/lib/api';
import { useI18n } from '@/components/i18n/I18nProvider';
import type { TranslationKey } from '@/lib/i18n/catalogs/en.ts';
import { describeUmlProposal, selectUmlProposal, type UmlModel } from '@/lib/uml-proposal';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  suggestionKeys?: TranslationKey[];
  imageUrl?: string;
  translationKey?: TranslationKey;
}

interface AIChatInterfaceProps {
  diagramId: string;
  currentModel: UmlModel;
  onUMLGenerated?: (umlModel: any) => void | Promise<void>;
  onClose?: () => void;
  isOpen: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

const templateTranslationKeys: Record<string, {
  name: TranslationKey;
  description: TranslationKey;
  prompt: TranslationKey;
}> = {
  farmacia: {
    name: 'ai.template.pharmacy.name',
    description: 'ai.template.pharmacy.description',
    prompt: 'ai.template.pharmacy.prompt',
  },
  ferreteria: {
    name: 'ai.template.hardware.name',
    description: 'ai.template.hardware.description',
    prompt: 'ai.template.hardware.prompt',
  },
  ecommerce: {
    name: 'ai.template.ecommerce.name',
    description: 'ai.template.ecommerce.description',
    prompt: 'ai.template.ecommerce.prompt',
  },
  biblioteca: {
    name: 'ai.template.library.name',
    description: 'ai.template.library.description',
    prompt: 'ai.template.library.prompt',
  },
  restaurante: {
    name: 'ai.template.restaurant.name',
    description: 'ai.template.restaurant.description',
    prompt: 'ai.template.restaurant.prompt',
  },
};

export default function AIChatInterface({ diagramId, currentModel, onUMLGenerated, onClose, isOpen }: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingModel, setPendingModel] = useState<any | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<string[]>([]);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const { locale, t } = useI18n();

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
      const templatesResponse = await aiAPI.getTemplates();

      setTemplates(templatesResponse.templates || []);

      const welcomeMessage: ChatMessage = {
        id: '1',
        type: 'ai',
        content: '',
        translationKey: 'ai.welcome',
        timestamp: new Date(),
        suggestionKeys: [
          'ai.fallback.shop',
          'ai.fallback.library',
          'ai.fallback.blog',
        ],
      };

      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Fallback to static message
      const fallbackMessage: ChatMessage = {
        id: '1',
        type: 'ai',
        content: '',
        translationKey: 'ai.welcome',
        timestamp: new Date(),
        suggestionKeys: [
          'ai.fallback.shop',
          'ai.fallback.library',
          'ai.fallback.blog',
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
      alert(t('ai.imageInvalid'));
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
      content: text,
      translationKey: text ? undefined : 'ai.imageSent',
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
      const chatResponse = await aiAPI.chat(text || t('ai.imageAnalyze'), diagramId, imageToSend || undefined);

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: chatResponse.response,
        timestamp: new Date(),
        suggestions: chatResponse.suggestions,
      };

      setMessages(prev => [...prev, aiMessage]);

      if (chatResponse.model && onUMLGenerated) {
        setPendingModel(chatResponse.model);
        setSelectedChanges(describeUmlProposal(currentModel, chatResponse.model).map((change) => change.id));
        setProposalError(null);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '',
        translationKey: 'ai.error',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyPendingModel = async () => {
    if (!pendingModel || !onUMLGenerated || selectedChanges.length === 0) return;
    setIsApplying(true);
    try {
      await onUMLGenerated(selectUmlProposal(currentModel, pendingModel, selectedChanges));
      setPendingModel(null);
      setProposalError(null);
      setMessages((current) => [...current, {
        id: `${Date.now()}-applied`,
        type: 'ai',
        content: '',
        translationKey: 'ai.diagramApplied',
        timestamp: new Date(),
      }]);
    } catch (error) {
      setProposalError(error instanceof Error ? error.message : t('ai.proposalError'));
    } finally {
      setIsApplying(false);
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
          <h3 className="font-semibold">{t('ai.title')}</h3>
        </div>
        <button
          onClick={onClose}
          aria-label={t('ai.close')}
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
                        alt={t('ai.imageAlt')}
                        className="max-w-full h-auto rounded border border-gray-300"
                        style={{ maxHeight: '200px' }}
                      />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{message.translationKey ? t(message.translationKey) : message.content}</p>

                  {/* Suggestions */}
                  {((message.suggestions?.length ?? 0) > 0 || (message.suggestionKeys?.length ?? 0) > 0) && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <Lightbulb size={12} />
                        <span>{t('ai.examples')}</span>
                      </div>
                      {(message.suggestionKeys?.map((key) => t(key)) ?? message.suggestions ?? []).map((suggestion, index) => (
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
                {message.timestamp.toLocaleTimeString(locale === 'es' ? 'es-BO' : 'en-US')}
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
                <span className="text-sm text-gray-600">{t('ai.thinking')}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        {pendingModel && (
          <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm text-foreground">
              {t('ai.previewReady', {
                classes: pendingModel.classes?.length || 0,
                relations: pendingModel.relations?.length || 0,
              })}
            </p>
            <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs">
              {describeUmlProposal(currentModel, pendingModel).map((change) => (
                <label key={`${change.kind}:${change.id}`} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedChanges.includes(change.id)}
                    onChange={() => setSelectedChanges((items) => items.includes(change.id)
                      ? items.filter((id) => id !== change.id)
                      : [...items, change.id])}
                  />
                  <span>{change.status === 'added' ? t('ai.changeAdded') : t('ai.changeModified')}: {change.name}</span>
                </label>
              ))}
            </div>
            {proposalError && <p role="alert" className="mt-1 text-xs text-red-700">{proposalError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void applyPendingModel()}
                disabled={isApplying || selectedChanges.length === 0}
                className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {isApplying ? t('ai.thinking') : t('ai.applyProposal')}
              </button>
              <button
                type="button"
                onClick={() => setPendingModel(null)}
                disabled={isApplying}
                className="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                {t('ai.discardProposal')}
              </button>
            </div>
          </div>
        )}
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-2 relative inline-block">
            <img
              src={imagePreview}
              alt={t('ai.previewAlt')}
              className="max-h-24 rounded border border-gray-300"
            />
            <button
              onClick={handleRemoveImage}
              aria-label={t('ai.removeImage')}
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
            title={t('ai.upload')}
            aria-label={t('ai.upload')}
          >
            <ImageIcon size={16} className="text-gray-600" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('ai.placeholder')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage()}
            aria-label={t('ai.send')}
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
            onClick={() => handleSendMessage(t('ai.quick.pharmacyPrompt'))}
            className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-1"
            disabled={isLoading}
          >
            <Sparkles size={12} />
            <span>{t('ai.quick.pharmacy')}</span>
          </button>

          <button
            onClick={() => handleSendMessage(t('ai.quick.shopPrompt'))}
            className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-1"
            disabled={isLoading}
          >
            <Sparkles size={12} />
            <span>{t('ai.quick.shop')}</span>
          </button>

          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-1"
            disabled={isLoading}
          >
            <Lightbulb size={12} />
            <span>{t('ai.templates')}</span>
          </button>
        </div>

        {/* Templates dropdown */}
        {showTemplates && templates.length > 0 && (
          <div className="mt-2 p-2 bg-gray-50 rounded-md">
            <div className="text-xs font-medium text-gray-700 mb-2">{t('ai.quickTemplates')}</div>
            <div className="grid grid-cols-1 gap-1">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    const keys = templateTranslationKeys[template.id];
                    handleSendMessage(keys ? t(keys.prompt) : template.prompt);
                    setShowTemplates(false);
                  }}
                  className="text-left text-xs p-2 bg-card border border-border rounded hover:bg-muted transition-colors"
                  disabled={isLoading}
                >
                  <div className="font-medium text-gray-900">
                    {templateTranslationKeys[template.id] ? t(templateTranslationKeys[template.id].name) : template.name}
                  </div>
                  <div className="text-gray-600 truncate">
                    {templateTranslationKeys[template.id] ? t(templateTranslationKeys[template.id].description) : template.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
