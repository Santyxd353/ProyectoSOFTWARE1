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

test('persists locale to storage, document language and cookie', () => {
  const writes = new Map();
  const cookies = [];
  const target = {
    storage: { setItem: (key, value) => writes.set(key, value) },
    root: { lang: 'en' },
    writeCookie: (value) => cookies.push(value),
  };

  core.persistLocale?.('es', target);

  assert.equal(writes.get('uml-studio-locale'), 'es');
  assert.equal(target.root.lang, 'es');
  assert.match(cookies[0] ?? '', /^uml-studio-locale=es;/);
  assert.match(cookies[0] ?? '', /SameSite=Lax/);
  assert.match(cookies[0] ?? '', /Max-Age=31536000/);
});

test('catalogs include authentication and dashboard contracts', () => {
  const requiredKeys = [
    'auth.login.title',
    'auth.login.email',
    'auth.login.password',
    'auth.login.submit',
    'auth.register.title',
    'auth.register.name',
    'auth.register.submit',
    'validation.nameMin',
    'validation.invalidEmail',
    'validation.passwordMin',
    'dashboard.title',
    'dashboard.welcomeBack',
    'dashboard.logout',
    'dashboard.myWorkspaces',
    'dashboard.sharedWithMe',
    'dashboard.newWorkspace',
    'dashboard.createFirst',
    'dashboard.emptyOwned',
    'dashboard.emptyShared',
    'dashboard.owner',
    'dashboard.diagramCount',
    'dashboard.collaboratorCount',
    'workspaceForm.name',
    'workspaceForm.description',
    'workspaceForm.create',
    'workspaceForm.createError',
  ];

  for (const key of requiredKeys) {
    assert.equal(typeof enModule.en?.[key], 'string', `missing English key: ${key}`);
    assert.equal(typeof esModule.es?.[key], 'string', `missing Spanish key: ${key}`);
  }
});

test('catalogs include workspace, members and repository contracts', () => {
  const requiredKeys = [
    'workspace.loading', 'workspace.backToDashboard', 'workspace.tabs.diagrams',
    'workspace.tabs.code', 'workspace.tabs.members', 'workspace.stats.diagrams',
    'workspace.stats.collaborators', 'workspace.stats.created', 'workspace.diagram.create',
    'workspace.diagram.empty', 'workspace.invite.title', 'workspace.deleteDialog.title',
    'workspace.diagram.archiveLabel', 'workspace.diagram.archivedList',
    'workspace.diagram.restoreLabel', 'workspace.archiveDialog.warning',
    'members.title', 'members.allowViewerComments', 'members.removeConfirm',
    'repository.empty', 'repository.revision', 'repository.files', 'repository.preview',
    'repository.compare.title', 'repository.download', 'repository.restore.action',
    'repository.comments.title', 'roles.owner', 'roles.editor', 'roles.viewer',
  ];

  for (const key of requiredKeys) {
    assert.equal(typeof enModule.en?.[key], 'string', `missing English key: ${key}`);
    assert.equal(typeof esModule.es?.[key], 'string', `missing Spanish key: ${key}`);
  }
});

test('catalogs include the documented project administration flows', () => {
  const requiredKeys = [
    'dashboard.search', 'dashboard.sort.label', 'dashboard.sort.updatedDesc',
    'dashboard.sort.updatedAsc', 'dashboard.sort.nameAsc', 'dashboard.sort.nameDesc',
    'workspace.settings.title', 'workspace.settings.save', 'workspace.settings.saved',
    'workspace.invitations.pending', 'workspace.invitations.revoke',
    'workspace.invitations.pendingSuccess', 'workspace.transfer.title',
    'workspace.transfer.member', 'workspace.transfer.confirmation',
    'workspace.transfer.action', 'workspace.transfer.success',
  ];

  for (const key of requiredKeys) {
    assert.equal(typeof enModule.en?.[key], 'string', `missing English key: ${key}`);
    assert.equal(typeof esModule.es?.[key], 'string', `missing Spanish key: ${key}`);
  }
});

test('catalogs include XMI interoperability controls', () => {
  for (const key of [
    'interchange.import', 'interchange.importing', 'interchange.importSuccess',
    'interchange.importError', 'interchange.export', 'interchange.exporting',
    'interchange.exportError',
  ]) {
    assert.equal(typeof enModule.en?.[key], 'string', `missing English key: ${key}`);
    assert.equal(typeof esModule.es?.[key], 'string', `missing Spanish key: ${key}`);
  }
});

test('catalogs include UML editor contracts', () => {
  const requiredKeys = [
    'diagramEditor.header.back', 'diagramEditor.header.version',
    'diagramEditor.status.connected', 'diagramEditor.status.disconnected',
    'diagramEditor.actions.save', 'diagramEditor.actions.openChat',
    'diagramEditor.class.title', 'diagramEditor.class.name',
    'diagramEditor.attribute.title', 'diagramEditor.attribute.name',
    'diagramEditor.method.title', 'diagramEditor.method.name',
    'diagramEditor.relationship.title', 'diagramEditor.relationship.type',
    'diagramEditor.sidebar.title', 'diagramEditor.sidebar.tips',
    'diagramEditor.validation.loadError', 'diagramEditor.validation.saveError',
  ];
  for (const key of requiredKeys) {
    assert.equal(typeof enModule.en?.[key], 'string', `missing English key: ${key}`);
    assert.equal(typeof esModule.es?.[key], 'string', `missing Spanish key: ${key}`);
  }
});

test('catalogs include AI and code-generation contracts', () => {
  const requiredKeys = [
    'ai.title', 'ai.welcome', 'ai.placeholder', 'ai.upload', 'ai.send',
    'ai.thinking', 'ai.imageInvalid', 'ai.diagramApplied',
    'ai.previewReady', 'ai.applyProposal', 'ai.discardProposal',
    'ai.template.pharmacy.name', 'ai.template.pharmacy.description', 'ai.template.pharmacy.prompt',
    'ai.template.hardware.name', 'ai.template.hardware.description', 'ai.template.hardware.prompt',
    'ai.template.ecommerce.name', 'ai.template.ecommerce.description', 'ai.template.ecommerce.prompt',
    'ai.template.library.name', 'ai.template.library.description', 'ai.template.library.prompt',
    'ai.template.restaurant.name', 'ai.template.restaurant.description', 'ai.template.restaurant.prompt',
    'generation.title', 'generation.spring.title', 'generation.spring.description',
    'generation.flutter.title', 'generation.flutter.description',
    'generation.generate', 'generation.generating', 'generation.download',
    'generation.success', 'generation.error',
  ];
  for (const key of requiredKeys) {
    assert.equal(typeof enModule.en?.[key], 'string', `missing English key: ${key}`);
    assert.equal(typeof esModule.es?.[key], 'string', `missing Spanish key: ${key}`);
  }
});
