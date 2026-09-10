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
        setError(error.response?.data?.message || 'Failed to load diagram');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiagram();
  }, [params.diagramId, user, router]);

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
      setError(error.response?.data?.message || error.message || 'Failed to save diagram');
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please log in to access this diagram.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Diagram</h2>
          <p className="text-gray-600">Please wait while we load your UML diagram...</p>
        </div>
      </div>
    );
  }

  if (error || !diagram) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Diagram not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
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
              ← Back to Dashboard
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{diagram.name}</h1>
              <p className="text-sm text-gray-600">
                Version {diagram.version} • Last updated {new Date(diagram.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`px-4 py-2 rounded-md transition-colors ${
                isChatOpen
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isChatOpen ? 'Close AI Chat' : 'Open AI Chat'}
            </button>

            <button
              onClick={() => setIsCodeGenOpen(!isCodeGenOpen)}
              className={`px-4 py-2 rounded-md transition-colors ${
                isCodeGenOpen
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isCodeGenOpen ? 'Close Code Gen' : 'Code Generation'}
            </button>

            <button
              onClick={() => router.push(`/workspace/${params.workspaceId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Workspace
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
