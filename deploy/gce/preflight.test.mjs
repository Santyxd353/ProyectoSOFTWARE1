import assert from 'node:assert/strict';
import test from 'node:test';
import { scanSensitiveContent, validateEnvironment } from './preflight.mjs';

const valid = {
  DATABASE_URL: 'postgresql://app:private@127.0.0.1:5432/uml_platform?schema=public',
  JWT_SECRET: '12345678901234567890123456789012',
  AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'non-placeholder-key',
  CORS_ORIGIN: 'https://uml.example.com', FRONTEND_URL: 'https://uml.example.com',
  PORT: '3002',
  GENERATED_PROJECTS_PATH: '/var/lib/proyecto-software1/generated-projects',
  ARTIFACT_STORAGE_PATH: '/var/lib/proyecto-software1/artifacts',
};

test('accepts private persistent single-VM configuration', () => {
  assert.deepEqual(validateEnvironment(valid), []);
});

test('accepts Groq and requires a non-placeholder server key', () => {
  const groq = { ...valid, AI_PROVIDER: 'groq', GROQ_API_KEY: 'valid-private-groq-key' };
  delete groq.GEMINI_API_KEY;
  assert.deepEqual(validateEnvironment(groq), []);
  assert.ok(validateEnvironment({ ...groq, GROQ_API_KEY: 'REPLACE_WITH_GROQ_KEY' })
    .includes('GROQ_API_KEY no configurada'));
});

test('rejects placeholders, public database and ephemeral artifact paths', () => {
  const issues = validateEnvironment({ ...valid,
    DATABASE_URL: 'postgresql://app:password@public.example.com:5432/db',
    JWT_SECRET: 'change-me',
    ARTIFACT_STORAGE_PATH: './artifacts',
    CORS_ORIGIN: 'http://uml.example.com',
  });
  assert.ok(issues.some((issue) => issue.includes('DATABASE_URL')));
  assert.ok(issues.some((issue) => issue.includes('JWT_SECRET')));
  assert.ok(issues.some((issue) => issue.includes('ARTIFACT_STORAGE_PATH')));
  assert.ok(issues.some((issue) => issue.includes('CORS_ORIGIN')));
});

test('identifies tracked secret patterns without returning secret values', () => {
  const findings = scanSensitiveContent([
    ['backend/src/example.ts', 'const key = "AQ.' + 'a'.repeat(40) + '"'],
    ['backend/src/groq.ts', 'const key = "gsk_' + 'b'.repeat(48) + '"'],
    ['backend/.env.example', 'GEMINI_API_KEY=REPLACE_WITH_AUTHORIZED_KEY'],
  ]);
  assert.deepEqual(findings, ['backend/src/example.ts', 'backend/src/groq.ts']);
});
