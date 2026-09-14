'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider } from 'reactflow';
import UMLEditor from '@/components/editor/UMLEditor';
import AIChatInterface from '@/components/chat/AIChatInterface';
import CodeGenerationPanel from '@/components/code-generation/CodeGenerationPanel';
import { useAuthStore } from '@/stores/auth';
import { diagramAPI } from '@/lib/api';
import { Diagram } from '@/types/uml';
import ThemeToggle from '@/components/theme/ThemeToggle';
import LanguageToggle from '@/components/i18n/LanguageToggle';
import { useI18n } from '@/components/i18n/I18nProvider';
import { Download, Loader2 } from 'lucide-react';

interface DiagramPageProps {
  params: {
    workspaceId: string;
    diagramId: string;
  };
}

export default function DiagramPage({ params }: DiagramPageProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCodeGenOpen, setIsCodeGenOpen] = useState(false);
  const [isExportingXmi, setIsExportingXmi] = useState(false);
  const { t, formatDate } = useI18n();

  // Fetch diagram data
  useEffect(() => {
    const fetchDiagram = async () => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        setIsLoading(true);
        const diagramData = await diagramAPI.getDiagramById(params.diagramId);
        setDiagram(diagramData);
      } catch (error: any) {
        console.error('Error fetching diagram:', error);
        setError(error.response?.data?.message || t('diagramEditor.validation.loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiagram();
  }, [params.diagramId, user, router, t]);

  // Handle diagram save
  const handleSave = async (diagramData: any) => {
    if (!diagram) return;

    try {
      console.log('💾 Intentando guardar diagrama:', {
        diagramId: diagram.id,
        dataKeys: Object.keys(diagramData),
        classesCount: diagramData.classes?.length,
        relationsCount: diagramData.relations?.length
      });

      await diagramAPI.updateDiagram(diagram.id, diagramData);
      console.log('✅ Diagrama guardado en BD exitosamente');

      // NO actualizar el estado de diagram para evitar re-renderizados
      // que disparen la reinicialización del editor
      // El editor mantiene su propio estado (nodes/edges)
    } catch (error: any) {
      console.error('❌ Error guardando diagrama:', error);
      console.error('❌ Error detalles:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      setError(error.response?.data?.message || error.message || t('diagramEditor.validation.saveError'));
    }
  };

  // Handle UML generation from AI
  const handleUMLGenerated = (umlModel: any) => {
    if (!diagram) return;

    console.log('🎯 Aplicando modelo UML generado:', umlModel);

    // Convert AI model to diagram format
    const updatedData = {
      ...diagram.data,
      classes: umlModel.classes || [],
      relations: umlModel.relations || [],
      metadata: {
        ...diagram.data.metadata,
        lastAIGeneration: new Date().toISOString(),
      },
    };

    console.log('📊 Datos actualizados del diagrama:', {
      classes: updatedData.classes.length,
      relations: updatedData.relations.length
    });

    setDiagram(prev => prev ? {
      ...prev,
      data: updatedData,
    } : null);
  };

  const handleExportXmi = async () => {
    if (!diagram) return;
    try {
      setIsExportingXmi(true);
      const blob = await diagramAPI.exportXmi(diagram.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${diagram.name.replace(/[^A-Za-z0-9._-]/g, '_') || 'diagram'}.xmi`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('interchange.exportError'));
    } finally {
      setIsExportingXmi(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('diagramEditor.header.authRequired')}</h2>
          <p className="text-gray-600">{t('diagramEditor.header.loginRequired')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('diagramEditor.header.loading')}</h2>
          <p className="text-gray-600">{t('diagramEditor.header.loadingDetail')}</p>
        </div>
      </div>
    );
  }

  if (error || !diagram) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">{t('diagramEditor.header.error')}</h2>
          <p className="text-gray-600 mb-4">{error || t('diagramEditor.header.notFound')}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {t('diagramEditor.header.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← {t('diagramEditor.header.back')}
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{diagram.name}</h1>
              <p className="text-sm text-gray-600">
                {t('diagramEditor.header.version', { version: diagram.version, date: formatDate(diagram.updatedAt) })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <LanguageToggle />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void handleExportXmi()}
              disabled={isExportingXmi}
              className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-50"
            >
              {isExportingXmi ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isExportingXmi ? t('interchange.exporting') : t('interchange.export')}
            </button>
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`px-4 py-2 rounded-md transition-colors ${
                isChatOpen
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isChatOpen ? t('diagramEditor.actions.closeChat') : t('diagramEditor.actions.openChat')}
            </button>

            <button
              onClick={() => setIsCodeGenOpen(!isCodeGenOpen)}
              className={`px-4 py-2 rounded-md transition-colors ${
                isCodeGenOpen
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isCodeGenOpen ? t('diagramEditor.actions.closeCode') : t('diagramEditor.actions.openCode')}
            </button>

            <button
              onClick={() => router.push(`/workspace/${params.workspaceId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {t('diagramEditor.header.workspace')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <UMLEditor
            diagram={diagram}
            workspaceId={params.workspaceId}
            userId={user.id}
            userName={user.name}
            onSave={handleSave}
          />
        </ReactFlowProvider>

        {/* AI Chat Interface */}
        <AIChatInterface
          diagramId={diagram.id}
          onUMLGenerated={handleUMLGenerated}
          onClose={() => setIsChatOpen(false)}
          isOpen={isChatOpen}
        />

        {/* Code Generation Panel */}
        {isCodeGenOpen && (
          <div className="fixed right-4 top-20 w-80 z-40">
            <CodeGenerationPanel
              diagramId={diagram.id}
              diagramName={diagram.name}
            />
          </div>
        )}
      </div>
    </div>
  );
}
