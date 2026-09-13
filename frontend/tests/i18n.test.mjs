import assert from 'node:assert/strict';
import test from 'node:test';

const core = await import('../lib/i18n/core.ts').catch(() => ({}));
const enModule = await import('../lib/i18n/catalogs/en.ts').catch(() => ({}));
const esModule = await import('../lib/i18n/catalogs/es.ts').catch(() => ({}));

test('resolves saved locale before browser locale and English fallback', () => {
  assert.equal(core.resolveLocale?.('es', 'en-US,en;q=0.9'), 'es');
  assert.equal(core.resolveLocale?.(null, 'es-BO,es;q=0.9'), 'es');
  assert.equal(core.resolveLocale?.('invalid', 'fr-FR'), 'en');
});

test('catalogs expose identical non-empty keys', () => {
  const enKeys = Object.keys(enModule.en ?? {}).sort();
  const esKeys = Object.keys(esModule.es ?? {}).sort();
  assert.deepEqual(esKeys, enKeys);
  assert.ok(enKeys.length >= 8);
  assert.equal(Object.values(esModule.es ?? {}).every(Boolean), true);
});

test('interpolates variables without altering unknown user content', () => {
  assert.equal(core.translate?.('es', 'common.welcome', { name: 'Felix' }), 'Bienvenido, Felix');
  assert.equal(core.translate?.('en', 'common.welcome', { name: '<User>' }), 'Welcome, <User>');
});

test('formats dates with explicit regional conventions', () => {
  const date = new Date('2026-09-13T12:00:00.000Z');
  assert.equal(core.formatLocalizedDate?.('es', date), '13/09/2026');
  assert.equal(core.formatLocalizedDate?.('en', date), '09/13/2026');
});
