import assert from 'node:assert/strict';
import test from 'node:test';

const { buildRepositoryTree } = await import('../lib/repository-tree.ts').catch(
  () => ({}),
);

const file = (id, path) => ({
  id,
  revisionId: 'revision-1',
  path,
  checksum: 'a'.repeat(64),
  size: 1,
  mimeType: 'text/plain',
  isBinary: false,
  createdAt: '2026-09-12T10:00:00Z',
});

test('construye carpetas anidadas y ordena directorios antes de archivos', () => {
  assert.deepEqual(
    buildRepositoryTree([
      file('file-3', 'README.md'),
      file('file-2', 'src/z.ts'),
      file('file-1', 'src/a.ts'),
      file('file-4', 'docs/guide.md'),
    ]),
    [
      {
        kind: 'directory',
        name: 'docs',
        path: 'docs',
        children: [
          {
            kind: 'file',
            name: 'guide.md',
            path: 'docs/guide.md',
            file: file('file-4', 'docs/guide.md'),
          },
        ],
      },
      {
        kind: 'directory',
        name: 'src',
        path: 'src',
        children: [
          {
            kind: 'file',
            name: 'a.ts',
            path: 'src/a.ts',
            file: file('file-1', 'src/a.ts'),
          },
          {
            kind: 'file',
            name: 'z.ts',
            path: 'src/z.ts',
            file: file('file-2', 'src/z.ts'),
          },
        ],
      },
      {
        kind: 'file',
        name: 'README.md',
        path: 'README.md',
        file: file('file-3', 'README.md'),
      },
    ],
  );
});

test('rechaza rutas inseguras recibidas del servidor', () => {
  assert.throws(
    () => buildRepositoryTree([file('bad', '../secret.txt')]),
    /Ruta de repositorio insegura/,
  );
});
