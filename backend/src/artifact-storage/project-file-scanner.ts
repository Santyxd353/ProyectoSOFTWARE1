import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'crypto';
import { lstat, readdir, readFile } from 'fs/promises';
import * as path from 'path';
import { TextDecoder } from 'util';

export interface ScannedProjectFile {
  path: string;
  bytes: Buffer;
  checksum: string;
  size: number;
  mimeType: string;
  isBinary: boolean;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.css': 'text/css',
  '.dart': 'text/x-dart',
  '.html': 'text/html',
  '.java': 'text/x-java-source',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.properties': 'text/plain',
  '.sql': 'application/sql',
  '.ts': 'text/typescript',
  '.tsx': 'text/tsx',
  '.xml': 'application/xml',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
};

@Injectable()
export class ProjectFileScanner {
  async scan(rootPath: string): Promise<ScannedProjectFile[]> {
    const root = path.resolve(rootPath);
    const rootStats = await lstat(root);

    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
      throw new UnprocessableEntityException(
        'Generation root must be a regular directory',
      );
    }

    const files: ScannedProjectFile[] = [];
    await this.walk(root, root, files);
    return files.sort((left, right) => left.path.localeCompare(right.path));
  }

  private async walk(
    root: string,
    current: string,
    files: ScannedProjectFile[],
  ): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      const stats = await lstat(absolutePath);

      if (stats.isSymbolicLink()) {
        throw new UnprocessableEntityException(
          'Symbolic links are not allowed in generated projects',
        );
      }

      if (stats.isDirectory()) {
        await this.walk(root, absolutePath, files);
        continue;
      }

      if (!stats.isFile()) {
        throw new UnprocessableEntityException(
          'Generated projects may contain regular files only',
        );
      }

      const relative = path.relative(root, absolutePath).replace(/\\/g, '/');
      if (
        !relative ||
        relative.startsWith('../') ||
        path.posix.isAbsolute(relative)
      ) {
        throw new UnprocessableEntityException('Unsafe generated file path');
      }

      const bytes = await readFile(absolutePath);
      files.push({
        path: relative,
        bytes,
        checksum: createHash('sha256').update(bytes).digest('hex'),
        size: bytes.byteLength,
        mimeType:
          MIME_BY_EXTENSION[path.extname(relative).toLowerCase()] ??
          'application/octet-stream',
        isBinary: this.isBinary(bytes),
      });
    }
  }

  private isBinary(bytes: Buffer): boolean {
    if (bytes.includes(0)) {
      return true;
    }

    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return false;
    } catch {
      return true;
    }
  }
}
