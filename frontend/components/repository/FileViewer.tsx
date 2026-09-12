import { FileWarning } from 'lucide-react';
import { RevisionFileContent } from '@/types/repository';

export default function FileViewer({ file }: { file: RevisionFileContent | null }) {
  if (!file) {
    return (
      <div className="flex min-h-72 items-center justify-center p-8 text-sm text-muted-foreground">
        Selecciona un archivo para ver su contenido.
      </div>
    );
  }

  if (file.isBinary) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
        <FileWarning size={32} className="text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">Archivo binario</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {file.mimeType} · {file.size.toLocaleString()} bytes
          </p>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">SHA-256: {file.checksum}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[36rem] overflow-auto bg-background/60">
      <ol className="min-w-max py-3 font-mono text-[13px] leading-6" aria-label={`Contenido de ${file.path}`}>
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
