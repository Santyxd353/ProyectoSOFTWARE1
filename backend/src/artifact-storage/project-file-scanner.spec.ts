import { UnprocessableEntityException } from '@nestjs/common';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProjectFileScanner } from './project-file-scanner';

describe('ProjectFileScanner', () => {
  let root: string;
  const scanner = new ProjectFileScanner();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'project-scanner-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('returns sorted normalized metadata and bytes for regular files', async () => {
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src', 'App.ts'), 'export const app = true;');
    await writeFile(join(root, 'logo.bin'), Buffer.from([0, 1, 2]));

    const files = await scanner.scan(root);

    expect(files.map(({ path, mimeType, isBinary, size }) => ({
      path,
      mimeType,
      isBinary,
      size,
    }))).toEqual([
      { path: 'logo.bin', mimeType: 'application/octet-stream', isBinary: true, size: 3 },
      { path: 'src/App.ts', mimeType: 'text/typescript', isBinary: false, size: 24 },
    ]);
    expect(files[1].checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(files[1].bytes.toString('utf8')).toBe('export const app = true;');
  });

  it('rejects symbolic links instead of following them', async () => {
    const target = join(root, 'target.txt');
    await writeFile(target, 'private');
    await symlink(target, join(root, 'linked.txt'), 'file');

    await expect(scanner.scan(root)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
