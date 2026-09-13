'use client';

import { FileWarning } from 'lucide-react';
import { RevisionFileContent } from '@/types/repository';
import { useI18n } from '@/components/i18n/I18nProvider';

export default function FileViewer({ file }: { file: RevisionFileContent | null }) {
  const { locale, t } = useI18n();
  if (!file) {
    return (
      <div className="flex min-h-72 items-center justify-center p-8 text-sm text-muted-foreground">
        {t('repository.file.select')}
      </div>
    );
  }

  if (file.isBinary) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
        <FileWarning size={32} className="text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">{t('repository.file.binary')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {file.mimeType} · {file.size.toLocaleString(locale === 'es' ? 'es-BO' : 'en-US')} bytes
          </p>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">SHA-256: {file.checksum}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[36rem] overflow-auto bg-background/60">
      <ol className="min-w-max py-3 font-mono text-[13px] leading-6" aria-label={t('repository.file.contentLabel', { path: file.path })}>
        {(file.content ?? '').split('\n').map((line, index) => (
          <li key={index} className="grid grid-cols-[3.5rem_1fr] hover:bg-muted/60">
            <span className="select-none border-r border-border px-3 text-right text-muted-foreground" aria-hidden="true">
              {index + 1}
            </span>
            <code className="whitespace-pre px-4 text-foreground">{line || ' '}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
