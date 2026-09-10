'use client';

import React, { useState } from 'react';
import { Download, Code, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { codeGenAPI } from '@/lib/api';

interface CodeGenerationPanelProps {
  diagramId: string;
  diagramName: string;
}

export default function CodeGenerationPanel({ diagramId, diagramName }: CodeGenerationPanelProps) {
  const [isGeneratingBackend, setIsGeneratingBackend] = useState(false);
  const [isGeneratingFrontend, setIsGeneratingFrontend] = useState(false);
  const [backendResult, setBackendResult] = useState<any>(null);
  const [frontendResult, setFrontendResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSpringBoot = async () => {
    setIsGeneratingBackend(true);
    setError(null);
    setBackendResult(null);

    try {
      const result = await codeGenAPI.generateSpringBoot(diagramId);

      if (result.success) {
        setBackendResult(result);
      } else {
        setError(result.error || 'Failed to generate Spring Boot project');
      }
    } catch (error: any) {
      console.error('Code generation error:', error);
      setError(error.response?.data?.error || 'Failed to generate Spring Boot project');
    } finally {
      setIsGeneratingBackend(false);
    }
  };

  const handleGenerateFlutter = async () => {
    setIsGeneratingFrontend(true);
    setError(null);
    setFrontendResult(null);

    try {
      const result = await codeGenAPI.generateFlutter(diagramId);

      if (result.success) {
        setFrontendResult(result);
      } else {
        setError(result.error || 'Failed to generate Flutter project');
      }
    } catch (error: any) {
      console.error('Flutter generation error:', error);
      setError(error.response?.data?.error || 'Failed to generate Flutter project');
    } finally {
      setIsGeneratingFrontend(false);
    }
  };

  const handleDownloadBackend = async () => {
    if (!backendResult?.generatedCodeId) return;

    try {
      const blob = await codeGenAPI.downloadProject(backendResult.generatedCodeId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${diagramName.toLowerCase().replace(/\s+/g, '-')}-springboot.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download backend project');
    }
  };

  const handleDownloadFrontend = async () => {
    if (!frontendResult?.generatedCodeId) return;

    try {
      const blob = await codeGenAPI.downloadProject(frontendResult.generatedCodeId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${diagramName.toLowerCase().replace(/\s+/g, '-')}-flutter.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download frontend project');
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-lg border border-border p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Code size={20} className="text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Code Generation</h3>
      </div>

      <div className="space-y-6">
        {/* Backend Section - Spring Boot */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Backend - Spring Boot</h4>
          <p className="text-sm text-gray-600 mb-3">
            Generate a complete Spring Boot REST API from your UML diagram.
          </p>

          <button
            onClick={handleGenerateSpringBoot}
            disabled={isGeneratingBackend}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-md font-medium transition-colors ${
              isGeneratingBackend
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isGeneratingBackend ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating Backend...</span>
              </>
            ) : (
              <>
                <Code size={16} />
                <span>Generate Spring Boot Backend</span>
              </>
            )}
          </button>

          {backendResult && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-3">
              <div className="flex items-start space-x-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-green-800 mb-1">
                    Backend Generated Successfully!
                  </h5>
                  <p className="text-xs text-green-700 mb-3">{backendResult.message}</p>
                  <button
                    onClick={handleDownloadBackend}
                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download size={14} />
                    <span>Download Spring Boot ZIP</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-md p-3 mt-3">
            <p className="text-xs font-medium text-gray-900 mb-1">Includes:</p>
            <ul className="text-xs text-gray-600 space-y-0.5">
              <li>• JPA Entities, DTOs, Repositories</li>
              <li>• REST Controllers with CRUD endpoints</li>
              <li>• PostgreSQL database configuration</li>
            </ul>
          </div>
        </div>

        {/* Frontend Section - Flutter */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Frontend - Flutter</h4>
          <p className="text-sm text-gray-600 mb-3">
            Generate a complete Flutter mobile app consuming your Spring Boot API.
          </p>

          <button
            onClick={handleGenerateFlutter}
            disabled={isGeneratingFrontend}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-md font-medium transition-colors ${
              isGeneratingFrontend
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {isGeneratingFrontend ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating Frontend...</span>
              </>
            ) : (
              <>
                <Code size={16} />
                <span>Generate Flutter Frontend</span>
              </>
            )}
          </button>

          {frontendResult && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-3">
              <div className="flex items-start space-x-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-green-800 mb-1">
                    Frontend Generated Successfully!
                  </h5>
                  <p className="text-xs text-green-700 mb-3">{frontendResult.message}</p>
                  <button
                    onClick={handleDownloadFrontend}
                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download size={14} />
                    <span>Download Flutter ZIP</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-md p-3 mt-3">
            <p className="text-xs font-medium text-gray-900 mb-1">Includes:</p>
            <ul className="text-xs text-gray-600 space-y-0.5">
              <li>• Models, Services, Screens (CRUD)</li>
              <li>• Material Design UI</li>
              <li>• Auto-configured to consume Spring Boot API</li>
            </ul>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-1">
                  Generation Failed
                </h4>
                <p className="text-xs text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
