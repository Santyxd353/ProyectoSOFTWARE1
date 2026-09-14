'use client';

import React, { useState } from 'react';
import { Download, Code, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { aiAPI, codeGenAPI } from '@/lib/api';
import { useI18n } from '@/components/i18n/I18nProvider';

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
  const [refinementInstruction, setRefinementInstruction] = useState('');
  const [refinementProposal, setRefinementProposal] = useState<any>(null);
  const [isRefining, setIsRefining] = useState(false);
  const { t } = useI18n();

  const handleGenerateSpringBoot = async () => {
    setIsGeneratingBackend(true);
    setError(null);
    setBackendResult(null);

    try {
      const result = await codeGenAPI.generateSpringBoot(diagramId);

      if (result.success) {
        setBackendResult(result);
      } else {
        setError(result.error || t('generation.spring.error'));
      }
    } catch (error: any) {
      console.error('Code generation error:', error);
      setError(error.response?.data?.error || t('generation.spring.error'));
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
        setError(result.error || t('generation.flutter.error'));
      }
    } catch (error: any) {
      console.error('Flutter generation error:', error);
      setError(error.response?.data?.error || t('generation.flutter.error'));
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
      setError(t('generation.spring.downloadError'));
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
      setError(t('generation.flutter.downloadError'));
    }
  };

  const handleProposeRefinement = async () => {
    if (!refinementInstruction.trim()) return;
    setIsRefining(true);
    setError(null);
    try {
      setRefinementProposal(
        await aiAPI.proposeBackendRefinement(diagramId, refinementInstruction.trim()),
      );
    } catch (error: any) {
      setError(error.response?.data?.message || t('generation.refinement.proposalError'));
    } finally {
      setIsRefining(false);
    }
  };

  const handleConfirmRefinement = async () => {
    if (!refinementProposal?.token) return;
    setIsRefining(true);
    setError(null);
    try {
      const result = await aiAPI.confirmBackendRefinement(refinementProposal.token);
      setBackendResult(result);
      setRefinementProposal(null);
      setRefinementInstruction('');
    } catch (error: any) {
      setError(error.response?.data?.message || t('generation.refinement.confirmError'));
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-lg border border-border p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Code size={20} className="text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">{t('generation.title')}</h3>
      </div>

      <div className="space-y-6">
        {/* Backend Section - Spring Boot */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">{t('generation.spring.title')}</h4>
          <p className="text-sm text-gray-600 mb-3">
            {t('generation.spring.description')}
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
                <span>{t('generation.spring.generating')}</span>
              </>
            ) : (
              <>
                <Code size={16} />
                <span>{t('generation.spring.generate')}</span>
              </>
            )}
          </button>

          {backendResult && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-3">
              <div className="flex items-start space-x-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-green-800 mb-1">
                    {t('generation.spring.success')}
                  </h5>
                  <p className="text-xs text-green-700 mb-3">{backendResult.message}</p>
                  <button
                    onClick={handleDownloadBackend}
                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download size={14} />
                    <span>{t('generation.spring.download')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-md p-3 mt-3">
            <p className="text-xs font-medium text-gray-900 mb-1">{t('generation.includes')}</p>
            <ul className="text-xs text-gray-600 space-y-0.5">
              <li>• {t('generation.spring.featureData')}</li>
              <li>• {t('generation.spring.featureRest')}</li>
              <li>• {t('generation.spring.featureDatabase')}</li>
              <li>• {t('generation.spring.featureArtifacts')}</li>
            </ul>
          </div>

          <div className="border-t border-gray-200 mt-4 pt-4">
            <h5 className="text-sm font-semibold text-gray-900 mb-1">
              {t('generation.refinement.title')}
            </h5>
            <p className="text-xs text-gray-600 mb-2">
              {t('generation.refinement.description')}
            </p>
            <textarea
              value={refinementInstruction}
              onChange={(event) => setRefinementInstruction(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={t('generation.refinement.placeholder')}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleProposeRefinement}
              disabled={isRefining || !refinementInstruction.trim()}
              className="mt-2 w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefining ? t('generation.refinement.processing') : t('generation.refinement.propose')}
            </button>

            {refinementProposal && (
              <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-900">{refinementProposal.summary}</p>
                <ul className="mt-2 space-y-1 text-xs text-blue-800">
                  {refinementProposal.changes.map((change: any) => (
                    <li key={change.feature}>• {change.feature}: {change.rationale}</li>
                  ))}
                  {refinementProposal.warnings.map((warning: string) => (
                    <li key={warning} className="text-amber-800">• {warning}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-blue-700">
                  {t('generation.refinement.confirmHint')}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleConfirmRefinement}
                    disabled={isRefining}
                    className="flex-1 rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {t('generation.refinement.apply')}
                  </button>
                  <button
                    onClick={() => setRefinementProposal(null)}
                    disabled={isRefining}
                    className="flex-1 rounded-md border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {t('generation.refinement.discard')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Frontend Section - Flutter */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">{t('generation.flutter.title')}</h4>
          <p className="text-sm text-gray-600 mb-3">
            {t('generation.flutter.description')}
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
                <span>{t('generation.flutter.generating')}</span>
              </>
            ) : (
              <>
                <Code size={16} />
                <span>{t('generation.flutter.generate')}</span>
              </>
            )}
          </button>

          {frontendResult && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-3">
              <div className="flex items-start space-x-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-green-800 mb-1">
                    {t('generation.flutter.success')}
                  </h5>
                  <p className="text-xs text-green-700 mb-3">{frontendResult.message}</p>
                  <button
                    onClick={handleDownloadFrontend}
                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download size={14} />
                    <span>{t('generation.flutter.download')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-md p-3 mt-3">
            <p className="text-xs font-medium text-gray-900 mb-1">{t('generation.includes')}</p>
            <ul className="text-xs text-gray-600 space-y-0.5">
              <li>• {t('generation.flutter.featureCrud')}</li>
              <li>• {t('generation.flutter.featureMaterial')}</li>
              <li>• {t('generation.flutter.featureApi')}</li>
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
                  {t('generation.error')}
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
