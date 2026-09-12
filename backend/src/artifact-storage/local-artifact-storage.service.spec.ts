import { UnprocessableEntityException } from '@nestjs/common';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalArtifactStorage } from './local-artifact-storage.service';

describe('LocalArtifactStorage', () => {
  let root: string;
  let storage: LocalArtifactStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'artifact-storage-'));
    storage = new LocalArtifactStorage({
      get: (_key: string, fallback: string) => root || fallback,
    } as any);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips bytes through an opaque normalized key', async () => {
    const bytes = Buffer.from('class App {}', 'utf8');

    await storage.put('workspace-1/revision-1/src/App.ts', bytes);

    await expect(
      storage.read('workspace-1/revision-1/src/App.ts'),
    ).resolves.toEqual(bytes);
    await expect(
      storage.exists('workspace-1/revision-1/src/App.ts'),
    ).resolves.toBe(true);
  });

  it.each(['../secret', '/absolute/file', 'C:\\secret']) (
    'rejects unsafe key %s',
    async (unsafeKey) => {
      await expect(
        storage.put(unsafeKey, Buffer.from('x')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    },
  );

  it('deletes an existing object idempotently', async () => {
    await storage.put('workspace-1/revision-1/file.txt', Buffer.from('x'));

    await storage.delete('workspace-1/revision-1/file.txt');
    await storage.delete('workspace-1/revision-1/file.txt');

    await expect(
      storage.exists('workspace-1/revision-1/file.txt'),
    ).resolves.toBe(false);
  });
});
