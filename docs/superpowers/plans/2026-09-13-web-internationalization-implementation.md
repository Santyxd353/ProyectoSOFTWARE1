# Web Internationalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an immediate, persistent Español/English language selector that covers every user-facing string controlled by the web frontend.

**Architecture:** A typed, dependency-free i18n core owns locale resolution, interpolation, date formatting, persistence, and flat translation catalogs. A client React provider exposes that core to all pages; focused migration tasks replace visible literals while TypeScript and catalog-contract tests prevent missing keys.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Node test runner, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-13-web-internationalization-design.md`

## Global Constraints

- Supported locales are exactly `en` and `es`.
- First-visit fallback order is saved preference, browser language, then English.
- Spanish date locale is `es-BO`; English date locale is `en-US`.
- Do not translate backend technical details, user-created names, UML identifiers, file paths, or generated code.
- Do not add an external i18n package or locale-prefixed routes.
- Keep the existing neutral professional theme, dark mode, responsive behavior, and visible focus states.
- The selector must expose text as well as state and retain an interaction area of at least 44 pixels high.

---

## File Structure

**Create:**

- `frontend/lib/i18n/catalogs/en.ts` — canonical English flat catalog.
- `frontend/lib/i18n/catalogs/es.ts` — Spanish catalog constrained to English keys.
- `frontend/lib/i18n/core.ts` — locale validation, resolution, interpolation, date formatting, and persistence.
- `frontend/lib/i18n/types.ts` — shared locale, interpolation, and persistence target types.
- `frontend/components/i18n/I18nProvider.tsx` — application-wide client state and `useI18n` hook.
- `frontend/components/i18n/LanguageToggle.tsx` — accessible `ES | EN` selector.
- `frontend/tests/i18n.test.mjs` — behavioral tests for the i18n core and catalog contract.

**Modify:**

- `frontend/app/layout.tsx` — resolve initial locale and mount the provider.
- `frontend/app/page.tsx` — translate landing/redirect status.
- `frontend/app/login/page.tsx`, `frontend/app/register/page.tsx`, `frontend/app/dashboard/page.tsx` — public and dashboard copy.
- `frontend/app/workspace/[workspaceId]/page.tsx`, `frontend/app/workspace/[workspaceId]/diagram/[diagramId]/page.tsx` — workspace and diagram shell copy.
- `frontend/components/theme/ThemeToggle.tsx` — localized accessible labels.
- `frontend/components/workspace/MemberManagement.tsx` — members and repository policy copy.
- `frontend/components/repository/CodeRepositoryPanel.tsx`, `CommentPanel.tsx`, `FileTree.tsx`, `FileViewer.tsx`, `RevisionCompare.tsx` — repository copy and accessibility labels.
- `frontend/components/editor/ClassEditor.tsx`, `RelationshipEditor.tsx`, `UMLClassNode.tsx`, `UMLEditor.tsx`, `UMLRelationshipEdge.tsx`, `UMLSidebar.tsx`, `UMLToolbar.tsx` — UML editor copy.
- `frontend/components/chat/AIChatInterface.tsx`, `frontend/components/code-generation/CodeGenerationPanel.tsx` — AI and generation copy.
- `README.md` — document selector behavior and supported locales.

---

### Task 1: Typed i18n core and catalogs

**Files:**
- Create: `frontend/lib/i18n/types.ts`
- Create: `frontend/lib/i18n/core.ts`
- Create: `frontend/lib/i18n/catalogs/en.ts`
- Create: `frontend/lib/i18n/catalogs/es.ts`
- Create: `frontend/tests/i18n.test.mjs`

**Interfaces:**
- Produces: `Locale = 'en' | 'es'`, `TranslationVariables = Record<string, string | number>`, `LocalePersistenceTarget = { storage: { setItem(key, value): void }; root: { lang: string }; writeCookie(value): void }`, catalog-derived `TranslationKey`, `normalizeLocale(value)`, `resolveLocale(saved, acceptLanguage)`, `translate(locale, key, variables)`, `formatLocalizedDate(locale, value)`, `persistLocale(locale, target)`, `LOCALE_STORAGE_KEY`, and `LOCALE_COOKIE_KEY`.
- Consumes: no feature code.

- [x] **Step 1: Write the failing core test**

Create `frontend/tests/i18n.test.mjs` with literal expectations:

```js
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
```

- [x] **Step 2: Run the test and confirm RED**

Run: `cd frontend && npm test -- --run`

Expected: FAIL because `resolveLocale`, catalogs, interpolation, and date formatting do not exist.

- [x] **Step 3: Implement the minimal typed core**

Use flat catalogs beginning with these exact shared keys:

```ts
export const en = {
  'common.welcome': 'Welcome, {name}',
  'common.loading': 'Loading…',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'language.label': 'Change language',
  'theme.toLight': 'Switch to light mode',
  'theme.toDark': 'Switch to dark mode',
} as const;
```

`en.ts` must export `TranslationKey = keyof typeof en`. `es.ts` must import that type, declare `satisfies Record<TranslationKey, string>`, and provide `Bienvenido, {name}`, `Cargando…`, `Cancelar`, `Guardar`, `Eliminar`, `Cerrar`, `Cambiar idioma`, `Cambiar a modo claro`, and `Cambiar a modo oscuro`.

`translate` must replace only `{identifier}` placeholders present in the selected message and fall back to the English value when necessary. `formatLocalizedDate` must specify two-digit day/month/year and UTC-independent date-only handling. `persistLocale` must write `uml-studio-locale` to the supplied storage target, update the root `lang`, and emit a same-site cookie valid for one year.

- [x] **Step 4: Run tests and type-check**

Run: `cd frontend && npm test -- --run && npm run type-check`

Expected: all existing tests plus four i18n tests PASS; TypeScript exits 0.

- [x] **Step 5: Commit**

```bash
git add frontend/lib/i18n frontend/tests/i18n.test.mjs
git commit -m "feat: add typed bilingual translation core"
```

---

### Task 2: Global provider and accessible language selector

**Files:**
- Create: `frontend/components/i18n/I18nProvider.tsx`
- Create: `frontend/components/i18n/LanguageToggle.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/components/theme/ThemeToggle.tsx`
- Modify: `frontend/tests/i18n.test.mjs`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `useI18n(): { locale; setLocale; t; formatDate }` and `<LanguageToggle />`.

- [x] **Step 1: Add failing persistence assertions**

Extend `i18n.test.mjs` with a fake storage/root/cookie target. Assert that `persistLocale('es', target)` writes `uml-studio-locale=es`, sets `root.lang` to `es`, and produces a cookie containing `SameSite=Lax` and `Max-Age=31536000`.

- [x] **Step 2: Run the focused test and confirm RED**

Run: `cd frontend && node --no-warnings --test --experimental-strip-types tests/i18n.test.mjs`

Expected: FAIL until the persistence target contract and cookie output are complete.

- [x] **Step 3: Implement provider, server initialization, and selector**

`layout.tsx` must read `uml-studio-locale` from `cookies()` and `accept-language` from `headers()`, resolve them through `resolveLocale`, set `<html lang={initialLocale}>`, and wrap children in `<I18nProvider initialLocale={initialLocale}>`.

`I18nProvider` must synchronize a valid localStorage value after mount, expose a stable `t`, and call `persistLocale` on manual change. `LanguageToggle` must render two text buttons, `ES` and `EN`, within a translated `role="group"` label; active state must include `aria-pressed="true"` and a font/border difference.

Replace the fixed Spanish accessible labels in `ThemeToggle` with `t('theme.toLight')` and `t('theme.toDark')`.

- [x] **Step 4: Verify selector infrastructure**

Run: `cd frontend && npm test -- --run && npm run type-check && npm run build`

Expected: tests PASS; provider compiles in App Router; production build exits 0.

- [x] **Step 5: Commit**

```bash
git add frontend/app/layout.tsx frontend/components/i18n frontend/components/theme/ThemeToggle.tsx frontend/tests/i18n.test.mjs
git commit -m "feat: add persistent language selector"
```

---

### Task 3: Public authentication and dashboard translation

**Files:**
- Modify: `frontend/lib/i18n/catalogs/en.ts`
- Modify: `frontend/lib/i18n/catalogs/es.ts`
- Modify: `frontend/tests/i18n.test.mjs`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/app/register/page.tsx`
- Modify: `frontend/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useI18n`, `LanguageToggle`, shared catalogs.
- Produces: fully bilingual public/auth/dashboard screens.

- [ ] **Step 1: Add a failing required-key contract**

Add a table-driven assertion requiring these namespaces and keys in both catalogs: `auth.login.*`, `auth.register.*`, `validation.nameMin`, `validation.invalidEmail`, `validation.passwordMin`, `dashboard.title`, `dashboard.welcomeBack`, `dashboard.logout`, `dashboard.myWorkspaces`, `dashboard.sharedWithMe`, `dashboard.newWorkspace`, `dashboard.createFirst`, `dashboard.emptyOwned`, `dashboard.emptyShared`, `dashboard.owner`, `dashboard.diagramCount`, `dashboard.collaboratorCount`, `workspaceForm.name`, `workspaceForm.description`, `workspaceForm.create`, and `workspaceForm.createError`.

- [ ] **Step 2: Run the i18n test and confirm RED**

Run: `cd frontend && node --no-warnings --test --experimental-strip-types tests/i18n.test.mjs`

Expected: FAIL listing the first missing authentication/dashboard key.

- [ ] **Step 3: Add exact English and Spanish catalog entries**

Use natural Spanish such as `Inicia sesión en tu cuenta`, `Crear una cuenta`, `Bienvenido de nuevo, {name}`, `Mis espacios de trabajo`, `Compartidos conmigo`, `Nuevo espacio`, `Nombre del espacio`, and `No se pudo crear el espacio. Inténtalo nuevamente.` English values must preserve the current meaning.

- [ ] **Step 4: Replace visible literals and localize validation**

Move Zod schema creation inside login/register components with `useMemo(() => z.object(...t(...)), [t])`. Place `<LanguageToggle />` beside `<ThemeToggle />`. Replace headings, labels, placeholders, buttons, loading states, empty states, counters, modal copy, alerts, and accessibility labels with `t`. Use separate singular/plural count keys selected from the numeric value.

- [ ] **Step 5: Verify the batch**

Run: `cd frontend && npm test -- --run && npm run type-check`

Expected: all tests PASS and no translation-key type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/page.tsx frontend/app/login/page.tsx frontend/app/register/page.tsx frontend/app/dashboard/page.tsx frontend/lib/i18n/catalogs frontend/tests/i18n.test.mjs
git commit -m "feat: translate authentication and dashboard"
```

---

### Task 4: Workspace, repository, and member translation

**Files:**
- Modify: `frontend/lib/i18n/catalogs/en.ts`
- Modify: `frontend/lib/i18n/catalogs/es.ts`
- Modify: `frontend/tests/i18n.test.mjs`
- Modify: `frontend/app/workspace/[workspaceId]/page.tsx`
- Modify: `frontend/components/workspace/MemberManagement.tsx`
- Modify: `frontend/components/repository/CodeRepositoryPanel.tsx`
- Modify: `frontend/components/repository/CommentPanel.tsx`
- Modify: `frontend/components/repository/FileTree.tsx`
- Modify: `frontend/components/repository/FileViewer.tsx`
- Modify: `frontend/components/repository/RevisionCompare.tsx`

**Interfaces:**
- Consumes: `useI18n`, `formatDate`, shared catalogs.
- Produces: bilingual workspace and internal repository workflows.

- [ ] **Step 1: Add failing workspace/repository key assertions**

Require keys for `workspace.loading`, `workspace.backToDashboard`, `workspace.tabs.*`, `workspace.stats.*`, `workspace.diagram.*`, `workspace.invite.*`, `workspace.deleteDialog.*`, `members.*`, `repository.empty`, `repository.revision`, `repository.files`, `repository.preview`, `repository.compare.*`, `repository.download`, `repository.restore.*`, `repository.comments.*`, and localized role labels `roles.owner`, `roles.editor`, and `roles.viewer`.

- [ ] **Step 2: Run the i18n test and confirm RED**

Run: `cd frontend && node --no-warnings --test --experimental-strip-types tests/i18n.test.mjs`

Expected: FAIL because workspace/repository keys are absent.

- [ ] **Step 3: Add both catalog sections**

Provide equivalent copy for loading, tabs, statistics, creation/invitation, destructive confirmation, permissions, review comments, comparison status, download, and restore. Keep role enum values (`OWNER`, `EDITOR`, `VIEWER`) unchanged; only translate their display labels.

- [ ] **Step 4: Migrate components**

Add `<LanguageToggle />` to the workspace header. Replace all visible literals, `alert`, `confirm`, `aria-label`, `title`, placeholders, and empty states with `t`. Replace every `toLocaleDateString()` in these files with `formatDate`. Preserve dynamic workspace, member, diagram, revision, and file names unchanged.

- [ ] **Step 5: Verify the batch**

Run: `cd frontend && npm test -- --run && npm run type-check`

Expected: tests and type-check PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/workspace/[workspaceId]/page.tsx frontend/components/workspace frontend/components/repository frontend/lib/i18n/catalogs frontend/tests/i18n.test.mjs
git commit -m "feat: translate workspace repository workflows"
```

---

### Task 5: UML editor translation

**Files:**
- Modify: `frontend/lib/i18n/catalogs/en.ts`
- Modify: `frontend/lib/i18n/catalogs/es.ts`
- Modify: `frontend/tests/i18n.test.mjs`
- Modify: `frontend/app/workspace/[workspaceId]/diagram/[diagramId]/page.tsx`
- Modify: `frontend/components/editor/ClassEditor.tsx`
- Modify: `frontend/components/editor/RelationshipEditor.tsx`
- Modify: `frontend/components/editor/UMLClassNode.tsx`
- Modify: `frontend/components/editor/UMLEditor.tsx`
- Modify: `frontend/components/editor/UMLRelationshipEdge.tsx`
- Modify: `frontend/components/editor/UMLSidebar.tsx`
- Modify: `frontend/components/editor/UMLToolbar.tsx`

**Interfaces:**
- Consumes: `useI18n`, `LanguageToggle`, `formatDate`.
- Produces: bilingual diagram editor without changing UML data.

- [ ] **Step 1: Add failing editor key assertions**

Require non-empty keys under `diagramEditor.header.*`, `diagramEditor.status.*`, `diagramEditor.actions.*`, `diagramEditor.class.*`, `diagramEditor.attribute.*`, `diagramEditor.method.*`, `diagramEditor.relationship.*`, `diagramEditor.sidebar.*`, and `diagramEditor.validation.*` in both catalogs.

- [ ] **Step 2: Run the i18n test and confirm RED**

Run: `cd frontend && node --no-warnings --test --experimental-strip-types tests/i18n.test.mjs`

Expected: FAIL on missing diagram editor entries.

- [ ] **Step 3: Add editor translations**

Translate user-interface concepts such as `Class name`/`Nombre de clase`, `Attributes`/`Atributos`, `Methods`/`Métodos`, `Relationship`/`Relación`, `Multiplicity`/`Multiplicidad`, `Save diagram`/`Guardar diagrama`, connection states, validation errors, and delete confirmations. Do not translate user-entered class, method, attribute, relationship, stereotype, or type values.

- [ ] **Step 4: Migrate editor shell and components**

Add `<LanguageToggle />` to the editor header. Replace editor headings, button text, tooltips, placeholders, instructional text, alerts, modal copy, connection status, and ARIA labels with `t`. Replace header date formatting with `formatDate`. Keep React Flow node IDs and UML enum values unchanged.

- [ ] **Step 5: Verify editor behavior**

Run: `cd frontend && npm test -- --run && npm run type-check && npm run build`

Expected: tests PASS, editor types compile, and production build exits 0.

- [ ] **Step 6: Commit**

```bash
git add "frontend/app/workspace/[workspaceId]/diagram/[diagramId]/page.tsx" frontend/components/editor frontend/lib/i18n/catalogs frontend/tests/i18n.test.mjs
git commit -m "feat: translate UML editor"
```

---

### Task 6: AI chat and code generation translation

**Files:**
- Modify: `frontend/lib/i18n/catalogs/en.ts`
- Modify: `frontend/lib/i18n/catalogs/es.ts`
- Modify: `frontend/tests/i18n.test.mjs`
- Modify: `frontend/components/chat/AIChatInterface.tsx`
- Modify: `frontend/components/code-generation/CodeGenerationPanel.tsx`

**Interfaces:**
- Consumes: `useI18n` and catalogs.
- Produces: bilingual AI and generation panels while preserving prompts and generated content.

- [ ] **Step 1: Add failing AI/generation key assertions**

Require keys under `ai.title`, `ai.welcome`, `ai.placeholder`, `ai.upload`, `ai.send`, `ai.thinking`, `ai.imageInvalid`, `ai.diagramApplied`, `generation.title`, `generation.spring.*`, `generation.flutter.*`, `generation.generate`, `generation.generating`, `generation.download`, `generation.success`, and `generation.error`.

- [ ] **Step 2: Run the i18n test and confirm RED**

Run: `cd frontend && node --no-warnings --test --experimental-strip-types tests/i18n.test.mjs`

Expected: FAIL on absent AI/generation keys.

- [ ] **Step 3: Add both catalog sections**

Translate panel chrome, guidance, upload labels, progress, success, errors, framework descriptions, feature lists, and download actions. Do not translate user prompts, assistant responses, uploaded filenames, generated paths, or generated source code.

- [ ] **Step 4: Migrate both panels**

Replace visible literals, alerts, placeholders, buttons, status messages, tooltips, and image alternate text with `t`. Preserve messages returned by the AI as content; add a localized technical-error heading before unknown backend details.

- [ ] **Step 5: Verify the batch**

Run: `cd frontend && npm test -- --run && npm run type-check`

Expected: tests and type-check PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/chat/AIChatInterface.tsx frontend/components/code-generation/CodeGenerationPanel.tsx frontend/lib/i18n/catalogs frontend/tests/i18n.test.mjs
git commit -m "feat: translate AI and code generation panels"
```

---

### Task 7: Full-app audit, documentation, and runtime verification

**Files:**
- Modify: `README.md`
- Modify only if audit finds frontend-owned copy: any file listed in the File Structure section.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified bilingual application and operator instructions.

- [ ] **Step 1: Run catalog and frontend verification**

Run:

```powershell
cd frontend
npm test -- --run
npm run type-check
npm run build
```

Expected: zero failed tests, zero TypeScript errors, production build exit 0.

- [ ] **Step 2: Run backend regression tests**

Run: `cd ../backend && npm test -- --runInBand && npm run build`

Expected: all backend tests PASS and Nest build exits 0.

- [ ] **Step 3: Audit every frontend surface manually**

Start the local system with `./INICIAR_LOCAL.cmd`. In English and Spanish, visit `/login`, `/register`, `/dashboard`, one workspace's Diagramas/Código/Miembros tabs, and one diagram editor. Open class and relationship dialogs, AI chat, generation panel, revision comparison, file comments, invitations, and delete confirmations. Confirm there are no frontend-owned mixed-language strings, the selection changes immediately, and `html[lang]` matches the active locale.

- [ ] **Step 4: Verify persistence and browser fallback**

Select Spanish, reload, and confirm Spanish remains. Clear `uml-studio-locale` from localStorage and cookie, set browser preference to Spanish, reload, and confirm Spanish. Repeat with an unsupported language and confirm English.

- [ ] **Step 5: Update README**

Add a `## Idiomas` section stating that English and Spanish cover the full web app, the first visit follows the browser, selection persists locally, and the switch appears beside the theme control.

- [ ] **Step 6: Run repository hygiene checks and commit**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended localization/documentation files are modified.

```bash
git add README.md frontend
git commit -m "docs: document bilingual interface"
```
