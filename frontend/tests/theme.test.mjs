import assert from 'node:assert/strict';
import test from 'node:test';

const themeModule = await import('../lib/theme.ts').catch(() => ({}));

test('la preferencia guardada prevalece sobre la del sistema', () => {
  assert.equal(themeModule.resolveTheme?.('dark', false), 'dark');
  assert.equal(themeModule.resolveTheme?.('light', true), 'light');
});

test('la preferencia del sistema se usa cuando no existe una selección válida', () => {
  assert.equal(themeModule.resolveTheme?.(null, true), 'dark');
  assert.equal(themeModule.resolveTheme?.('desconocido', false), 'light');
});

test('aplicar un tema sincroniza la clase, el atributo y el esquema de color', () => {
  const classes = new Set();
  const root = {
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    dataset: {},
    style: {},
  };

  themeModule.applyTheme?.(root, 'dark');

  assert.equal(classes.has('dark'), true);
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.style.colorScheme, 'dark');
});
