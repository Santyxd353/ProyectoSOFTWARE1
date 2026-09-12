import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { access, mkdir, readFile, rm, writeFile } from 'fs/promises';
import * as path from 'path';
import { ArtifactStorage } from './artifact-storage';

@Injectable()
export class LocalArtifactStorage implements ArtifactStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(
      config.get<string>('ARTIFACT_STORAGE_PATH', './artifacts'),
    );
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const destination = this.resolveKey(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolveKey(key));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  private resolveKey(key: string): string {
    if (
      !key ||
      key.includes('\\') ||
      path.isAbsolute(key) ||
      key.split('/').some((segment) => segment === '..' || segment === '')
    ) {
      throw new UnprocessableEntityException('Unsafe artifact key');
    }

    const resolved = path.resolve(this.root, ...key.split('/'));
    const relative = path.relative(this.root, resolved);

    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new UnprocessableEntityException('Unsafe artifact key');
    }

    return resolved;
  }
}
