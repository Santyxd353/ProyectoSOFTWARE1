# Internal Code Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the documented internal repository so authorized workspace members can preserve, browse, review, compare, download, and restore generated code.

**Architecture:** NestJS owns authorization, audit, immutable revision metadata, comments, and REST/WebSocket APIs. File bytes pass through an `ArtifactStorage` contract with a local implementation now and a later GCS implementation; Next.js consumes explicit DTOs and renders a read-only repository workspace.

**Tech Stack:** NestJS 10, Prisma 5/PostgreSQL, Jest, Socket.IO, Next.js 14, React 18, TypeScript, Node test runner, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-12-internal-code-repository-design.md`

## Global Constraints

- Scope is CU-12, CU-17, CU-19, and CU-20 only.
- Published revisions are immutable; restoration always creates a new revision.
- Identity comes from JWT for REST and WebSocket; clients cannot choose `userId`, name, or role.
- OWNER and EDITOR may generate/restore; VIEWER remains read-only except comments when `allowViewerComments` is true.
- Physical paths and `storageKey` never appear in API responses.
- Reject absolute paths, `..`, symlinks, and files outside the generation root.
- Audit metadata excludes secrets, audio, full file contents, and physical paths.
- Keep the existing light/dark professional visual system.

---

### Task 1: Authorization capability service

**Files:**
- Create: `backend/src/authorization/authorization.types.ts`
- Create: `backend/src/authorization/authorization.service.ts`
- Create: `backend/src/authorization/authorization.service.spec.ts`
- Create: `backend/src/authorization/authorization.module.ts`

**Interfaces:**
- Produces: `WorkspaceCapability`, `WorkspaceAccess`, `AuthorizationService.getAccess(workspaceId, userId)`, and `AuthorizationService.require(workspaceId, userId, capability)`.

- [x] **Step 1: Write failing role-capability tests**

```ts
it.each([
  [Role.OWNER, 'repository:read', true],
  [Role.EDITOR, 'repository:restore', true],
  [Role.VIEWER, 'repository:restore', false],
  [Role.VIEWER, 'comment:create', false],
])('maps %s and %s to %s', async (role, capability, allowed) => {
  prisma.workspace.findUnique.mockResolvedValue(workspaceFor(role));
  if (allowed) await expect(service.require('w1', 'u1', capability)).resolves.toBeDefined();
  else await expect(service.require('w1', 'u1', capability)).rejects.toThrow(ForbiddenException);
});

it('allows viewer comments only when policy is enabled', async () => {
  prisma.workspace.findUnique.mockResolvedValue(workspaceFor(Role.VIEWER, true));
  await expect(service.require('w1', 'u1', 'comment:create')).resolves.toMatchObject({ role: Role.VIEWER });
});
```

- [x] **Step 2: Verify RED**

Run: `cd backend; npm test -- authorization.service.spec.ts --runInBand`

Expected: FAIL because `AuthorizationService` does not exist.

- [x] **Step 3: Implement capability mapping**

```ts
export type WorkspaceCapability =
  | 'repository:read' | 'repository:generate' | 'repository:restore'
  | 'comment:create' | 'members:manage' | 'policy:manage';

export interface WorkspaceAccess {
  workspaceId: string;
  userId: string;
  role: Role;
  allowViewerComments: boolean;
}
```

`getAccess` loads owner and matching collaborator once. `require` returns access when the role permits the capability and throws `NotFoundException`/`ForbiddenException` otherwise. Export service from a module importing `PrismaModule`.

- [x] **Step 4: Verify GREEN**

Run: `cd backend; npm test -- authorization.service.spec.ts --runInBand`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/authorization
git commit -m "feat: centralize workspace authorization"
```

### Task 2: Repository schema and audit service

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260912_internal_code_repository/migration.sql`
- Create: `backend/src/audit/audit.service.ts`
- Create: `backend/src/audit/audit.service.spec.ts`
- Create: `backend/src/audit/audit.module.ts`

**Interfaces:**
- Consumes: authenticated `workspaceId`, `actorId`.
- Produces: Prisma models `CodeRevision`, `RevisionFile`, `ReviewComment`, `AuditEvent`; `AuditService.record(input)`.

- [ ] **Step 1: Write failing audit sanitization test**

```ts
it('stores bounded metadata without sensitive fields', async () => {
  await service.record({
    workspaceId: 'w1', actorId: 'u1', action: 'REVISION_DOWNLOADED',
    entityType: 'CodeRevision', entityId: 'r1',
    metadata: { count: 3, token: 'secret', path: 'C:/private', content: 'source' },
  });
  expect(prisma.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    metadata: { count: 3 },
  }) });
});
```

- [ ] **Step 2: Verify RED**

Run: `cd backend; npm test -- audit.service.spec.ts --runInBand`

Expected: FAIL because audit service and Prisma model do not exist.

- [ ] **Step 3: Add enums and relations**

Add `allowViewerComments Boolean @default(false)` to `Workspace`. Add enums `RevisionStatus { CREATING PUBLISHED FAILED }` and `AuditAction` values for generation, comment, comparison, download, restoration, member role update/removal, and policy update. Add models and unique/index constraints from the spec, including `@@unique([revisionId, path])`, `GeneratedCode.revisionId String? @unique`, and all inverse relations required by Prisma.

- [ ] **Step 4: Create exact SQL migration and regenerate client**

Run: `cd backend; npx prisma format; npx prisma validate; npx prisma generate`

Expected: schema valid and client generated.

- [ ] **Step 5: Implement bounded audit metadata**

`record` accepts primitive/JSON-safe metadata, removes keys matching `token`, `password`, `secret`, `path`, `storageKey`, `audio`, and `content`, serializes at most 8 KB, then calls `prisma.auditEvent.create`.

- [ ] **Step 6: Verify GREEN**

Run: `cd backend; npm test -- audit.service.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma backend/src/audit
git commit -m "feat: add revision and audit data model"
```

### Task 3: Local artifact storage and safe path inspection

**Files:**
- Create: `backend/src/artifact-storage/artifact-storage.ts`
- Create: `backend/src/artifact-storage/local-artifact-storage.service.ts`
- Create: `backend/src/artifact-storage/local-artifact-storage.service.spec.ts`
- Create: `backend/src/artifact-storage/project-file-scanner.ts`
- Create: `backend/src/artifact-storage/project-file-scanner.spec.ts`
- Create: `backend/src/artifact-storage/artifact-storage.module.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: `ARTIFACT_STORAGE`, `ArtifactStorage.put/read/exists/delete`, `ProjectFileScanner.scan(root)` returning normalized file descriptors.

- [ ] **Step 1: Write failing storage and traversal tests**

```ts
it('round-trips bytes through an opaque key', async () => {
  await storage.put('w1/r1/src/App.ts', Buffer.from('ok'));
  await expect(storage.read('w1/r1/src/App.ts')).resolves.toEqual(Buffer.from('ok'));
});

it.each(['../secret', '/absolute/file', 'C:\\secret'])('rejects unsafe path %s', async unsafe => {
  await expect(storage.put(unsafe, Buffer.from('x'))).rejects.toThrow(UnprocessableEntityException);
});

it('rejects symbolic links while scanning', async () => {
  await expect(scanner.scan(fixtureWithSymlink)).rejects.toThrow(UnprocessableEntityException);
});
```

- [ ] **Step 2: Verify RED**

Run: `cd backend; npm test -- artifact-storage --runInBand`

Expected: FAIL because storage classes do not exist.

- [ ] **Step 3: Implement contract and local adapter**

```ts
export interface ArtifactStorage {
  put(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
export const ARTIFACT_STORAGE = Symbol('ARTIFACT_STORAGE');
```

Resolve keys under `ARTIFACT_STORAGE_PATH` (default `./artifacts`), compare `path.relative` against the root, and use recursive directory creation. Scanner uses `lstat`, accepts regular files only, returns slash-normalized relative paths, SHA-256, size, MIME, and binary detection based on NUL bytes/UTF-8 decoding.

- [ ] **Step 4: Verify GREEN**

Run: `cd backend; npm test -- artifact-storage --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/artifact-storage backend/.env.example
git commit -m "feat: add safe local artifact storage"
```

### Task 4: Publish immutable revisions

**Files:**
- Create: `backend/src/code-repository/code-repository.types.ts`
- Create: `backend/src/code-repository/code-repository.service.ts`
- Create: `backend/src/code-repository/code-repository.service.spec.ts`
- Create: `backend/src/code-repository/code-repository.module.ts`

**Interfaces:**
- Consumes: `AuthorizationService`, `AuditService`, `ProjectFileScanner`, `ArtifactStorage`.
- Produces: `publishGeneratedProject(input): Promise<RevisionSummaryDto>`.

- [ ] **Step 1: Write failing publication tests**

```ts
it('publishes one immutable revision with every scanned file', async () => {
  scanner.scan.mockResolvedValue([{ path: 'src/App.ts', bytes: Buffer.from('x'), checksum: 'abc', size: 1, mimeType: 'text/plain', isBinary: false }]);
  const result = await service.publishGeneratedProject({ workspaceId: 'w1', diagramId: 'd1', modelVersion: 4, authorId: 'u1', projectType: ProjectType.SPRING_BOOT, generator: 'spring-ejs@1', rootPath: '/tmp/p1' });
  expect(result.status).toBe(RevisionStatus.PUBLISHED);
  expect(prisma.revisionFile.createMany).toHaveBeenCalledTimes(1);
});

it('marks revision failed when artifact write fails', async () => {
  storage.put.mockRejectedValue(new Error('disk full'));
  await expect(service.publishGeneratedProject(validInput)).rejects.toThrow('disk full');
  expect(prisma.codeRevision.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: RevisionStatus.FAILED } }));
});
```

- [ ] **Step 2: Verify RED**

Run: `cd backend; npm test -- code-repository.service.spec.ts --runInBand`

Expected: FAIL because repository service does not exist.

- [ ] **Step 3: Implement publication transaction**

Require `repository:generate`, create `CREATING`, scan, store each object under `<workspace>/<revision>/<checksum>`, insert metadata, mark `PUBLISHED` with `publishedAt`, and audit `REVISION_PUBLISHED`. On error, mark `FAILED`, delete newly written objects idempotently, audit failure, then rethrow. DTO excludes `storageKey` and physical roots.

- [ ] **Step 4: Verify GREEN**

Run: `cd backend; npm test -- code-repository.service.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/code-repository
git commit -m "feat: publish generated code revisions"
```

### Task 5: Read repository, comments, compare, restore, and download

**Files:**
- Create: `backend/src/code-repository/dto/create-comment.dto.ts`
- Create: `backend/src/code-repository/dto/compare-revisions.dto.ts`
- Create: `backend/src/code-repository/code-repository.controller.ts`
- Modify: `backend/src/code-repository/code-repository.service.ts`
- Modify: `backend/src/code-repository/code-repository.service.spec.ts`
- Modify: `backend/src/code-repository/code-repository.module.ts`

**Interfaces:**
- Produces every REST route listed in spec section 9 and service methods `list`, `get`, `tree`, `readFile`, `compare`, `download`, `restore`, `listComments`, `createComment`.

- [ ] **Step 1: Add failing behavior tests**

Cover: members can list/open; binary reads return metadata without bytes; unified text diff is deterministic and size-limited; restore creates a new `PUBLISHED` revision with `restoredFromId`; ZIP paths are normalized; comments reject line zero/blank/over-limit bodies; viewer policy is enforced.

Representative assertion:

```ts
it('restores by creating a new revision without changing the source', async () => {
  const restored = await service.restore('w1', 'r1', 'u1');
  expect(restored.id).not.toBe('r1');
  expect(prisma.codeRevision.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r1' } }));
  expect(restored.restoredFromId).toBe('r1');
});
```

- [ ] **Step 2: Verify RED**

Run: `cd backend; npm test -- code-repository.service.spec.ts --runInBand`

Expected: new tests FAIL because methods are absent.

- [ ] **Step 3: Implement REST behavior**

Every method calls `AuthorizationService.require`. Text responses decode UTF-8 only below configured limit. Comparison emits `{ path, kind, patch? }`, where kind is `ADDED|REMOVED|MODIFIED|UNCHANGED|BINARY_MODIFIED`. Download returns `{ stream, filename, cleanup }`; controller registers cleanup for `finish`, `close`, and `error`. Restore copies existing storage references into a new immutable revision. Comment DTO uses `@IsString`, `@MaxLength(4000)`, `@IsInt`, `@Min(1)`, and optional line.

- [ ] **Step 4: Verify GREEN and controller compilation**

Run: `cd backend; npm test -- code-repository.service.spec.ts --runInBand; npm run build`

Expected: PASS and Nest build exits 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/code-repository
git commit -m "feat: expose repository review workflows"
```

### Task 6: Integrate code generation and secure legacy downloads

**Files:**
- Modify: `backend/src/code-generation/code-generation.service.ts`
- Modify: `backend/src/code-generation/code-generation.controller.ts`
- Modify: `backend/src/code-generation/code-generation.module.ts`
- Create: `backend/src/code-generation/code-generation.service.spec.ts`

**Interfaces:**
- Consumes: `CodeRepositoryService.publishGeneratedProject` and authorization.
- Produces: generation responses containing `revisionId`; legacy downloads scoped to authorized workspace membership.

- [ ] **Step 1: Write failing integration tests**

```ts
it('publishes exactly one revision after successful Spring generation', async () => {
  const result = await service.generateSpringBootProject('d1', 'u1');
  expect(repository.publishGeneratedProject).toHaveBeenCalledTimes(1);
  expect(result.revisionId).toBe('r1');
});

it('denies legacy download to users outside the generated code workspace', async () => {
  authorization.require.mockRejectedValue(new ForbiddenException());
  await expect(service.downloadProject('g1', 'intruder')).rejects.toThrow(ForbiddenException);
});
```

- [ ] **Step 2: Verify RED**

Run: `cd backend; npm test -- code-generation.service.spec.ts --runInBand`

Expected: FAIL because publication and authorization are not wired.

- [ ] **Step 3: Implement integration**

Load diagram with `workspaceId` and `version`, require generation capability before filesystem work, publish after templates finish, create/update `GeneratedCode` with `revisionId`, return revision metadata, and pass authenticated `userId` to legacy download. Preserve old ZIP behavior only for existing records without revisions.

- [ ] **Step 4: Verify GREEN**

Run: `cd backend; npm test -- code-generation.service.spec.ts --runInBand; npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/code-generation
git commit -m "feat: preserve generated projects as revisions"
```

### Task 7: Member management and repository policy

**Files:**
- Create: `backend/src/workspace/dto/update-member.dto.ts`
- Create: `backend/src/workspace/dto/update-repository-policy.dto.ts`
- Modify: `backend/src/workspace/workspace.controller.ts`
- Modify: `backend/src/workspace/workspace.service.ts`
- Create: `backend/src/workspace/workspace.service.spec.ts`
- Modify: `backend/src/workspace/workspace.module.ts`

**Interfaces:**
- Produces: `GET/PATCH/DELETE /workspaces/:workspaceId/members` and `PATCH /workspaces/:workspaceId/repository-policy`.

- [ ] **Step 1: Write failing ownership tests**

Cover owner-only role change/removal/policy; reject `OWNER` as collaborator role; owner cannot be removed; response lists owner plus collaborators and effective capabilities.

- [ ] **Step 2: Verify RED**

Run: `cd backend; npm test -- workspace.service.spec.ts --runInBand`

Expected: FAIL because member APIs are absent.

- [ ] **Step 3: Implement DTOs and service methods**

`UpdateMemberDto.role` accepts only `EDITOR|VIEWER`; policy DTO validates a boolean. Use `AuthorizationService.require(..., 'members:manage'|'policy:manage')`. Apply update/delete with workspace-scoped composite lookup and record audit events.

- [ ] **Step 4: Verify GREEN**

Run: `cd backend; npm test -- workspace.service.spec.ts --runInBand; npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/workspace
git commit -m "feat: manage workspace repository permissions"
```

### Task 8: Authenticate collaboration sockets and publish comment events

**Files:**
- Create: `backend/src/collaboration/socket-auth.service.ts`
- Create: `backend/src/collaboration/socket-auth.service.spec.ts`
- Modify: `backend/src/collaboration/collaboration.gateway.ts`
- Modify: `backend/src/collaboration/collaboration.service.ts`
- Modify: `backend/src/collaboration/collaboration.module.ts`
- Modify: `backend/src/auth/auth.module.ts`
- Modify: `frontend/hooks/useSocket.ts`

**Interfaces:**
- Produces: authenticated `client.data.user`; `join_revision`; server event `review_comment_created` is named `review_comment_created` in code.

- [ ] **Step 1: Write failing handshake tests**

```ts
it('rejects a socket without a valid bearer token', async () => {
  jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
  await expect(service.authenticate(socketWithoutToken)).rejects.toThrow(WsException);
});

it('ignores client supplied identity and uses JWT subject', async () => {
  jwt.verifyAsync.mockResolvedValue({ userId: 'jwt-user', email: 'a@b.com' });
  await expect(service.authenticate(socketWithToken)).resolves.toMatchObject({ userId: 'jwt-user' });
});
```

- [ ] **Step 2: Verify RED**

Run: `cd backend; npm test -- socket-auth.service.spec.ts --runInBand`

Expected: FAIL because socket auth service does not exist.

- [ ] **Step 3: Implement handshake and authorized rooms**

Read token from `socket.handshake.auth.token` or Bearer header, verify using Nest `JwtService`, assign only verified identity to `client.data.user`, and disconnect unauthorized clients. Remove `userId`/`userName` from diagram message DTOs. `join_revision` verifies repository read permission and joins `workspace:<workspaceId>:revision:<revisionId>`. After comment creation, gateway emits sanitized comment DTO to that room.

- [ ] **Step 4: Send browser token in handshake**

Update `useSocket` to pass `auth: { token: localStorage.getItem('token') }`; keep reconnection behavior and never send identity in events.

- [ ] **Step 5: Verify GREEN**

Run: `cd backend; npm test -- socket-auth.service.spec.ts --runInBand; npm run build; cd ../frontend; npm run type-check`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth backend/src/collaboration frontend/hooks/useSocket.ts
git commit -m "fix: authenticate realtime collaboration"
```

### Task 9: Frontend repository domain and file tree

**Files:**
- Create: `frontend/types/repository.ts`
- Create: `frontend/lib/repository-tree.ts`
- Create: `frontend/tests/repository-tree.test.mjs`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/components/repository/FileTree.tsx`
- Create: `frontend/components/repository/FileViewer.tsx`
- Create: `frontend/components/repository/RevisionCompare.tsx`
- Create: `frontend/components/repository/CommentPanel.tsx`
- Create: `frontend/components/repository/CodeRepositoryPanel.tsx`

**Interfaces:**
- Produces typed `repositoryAPI`, deterministic `buildRepositoryTree(files)`, and `CodeRepositoryPanel({ workspaceId, role, allowViewerComments })`.

- [ ] **Step 1: Write failing tree tests**

```js
test('builds sorted nested folders from normalized paths', () => {
  assert.deepEqual(buildRepositoryTree([
    file('src/z.ts'), file('README.md'), file('src/a.ts'),
  ]), [
    { kind: 'file', name: 'README.md', path: 'README.md' },
    { kind: 'directory', name: 'src', path: 'src', children: [
      { kind: 'file', name: 'a.ts', path: 'src/a.ts' },
      { kind: 'file', name: 'z.ts', path: 'src/z.ts' },
    ] },
  ]);
});
```

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm test`

Expected: repository tree test FAIL because module does not exist.

- [ ] **Step 3: Implement types, API, and tree utility**

Define `RevisionSummary`, `RevisionFile`, `RevisionTree`, `FileContent`, `RevisionDiff`, `ReviewComment`, and role capability helpers matching backend DTOs. Add list/get/tree/read/compare/download/restore/comment methods to `repositoryAPI`; use blob response for downloads.

- [ ] **Step 4: Implement focused read-only components**

`FileTree` handles keyboard selection and nested disclosure. `FileViewer` shows numbered escaped text or binary metadata. `RevisionCompare` renders per-file status and unified patch in `<pre>`. `CommentPanel` validates 1–4000 trimmed characters and respects viewer policy. `CodeRepositoryPanel` owns loading/error/empty/selection states and subscribes to `review_comment_created`.

- [ ] **Step 5: Verify GREEN**

Run: `cd frontend; npm test; npm run type-check; npm run build`

Expected: tests, TypeScript, and Next build pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/types/repository.ts frontend/lib frontend/tests frontend/components/repository
git commit -m "feat: add generated code repository interface"
```

### Task 10: Workspace tabs and owner controls

**Files:**
- Modify: `frontend/types/workspace.ts`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/stores/workspace.ts`
- Create: `frontend/components/workspace/MemberManagement.tsx`
- Modify: `frontend/app/workspace/[workspaceId]/page.tsx`
- Create: `frontend/tests/repository-capabilities.test.mjs`

**Interfaces:**
- Consumes: repository components and member/policy endpoints.
- Produces: workspace `Diagramas|Código|Miembros` tabs; owner-only member administration.

- [ ] **Step 1: Write failing capability tests**

```js
test('viewer can read and conditionally comment but cannot restore', () => {
  assert.equal(capabilities('VIEWER', false).canRead, true);
  assert.equal(capabilities('VIEWER', false).canComment, false);
  assert.equal(capabilities('VIEWER', true).canComment, true);
  assert.equal(capabilities('VIEWER', true).canRestore, false);
});
```

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm test`

Expected: capability test FAIL because helper is absent.

- [ ] **Step 3: Implement workspace role/policy state**

Extend workspace DTO with `ownerId`, `currentUserRole`, `allowViewerComments`, and effective capabilities. Add API/store methods for role update, removal, and policy update, always refreshing current workspace after mutation.

- [ ] **Step 4: Integrate tabs and controls**

Keep current diagram cards under `Diagramas`; render `CodeRepositoryPanel` under `Código`; render `MemberManagement` under `Miembros`. Owner sees role selectors, remove actions, and viewer-comment toggle. Editor/viewer sees read-only member list. Preserve responsive layout, theme tokens, focus rings, and Spanish labels.

- [ ] **Step 5: Verify GREEN**

Run: `cd frontend; npm test; npm run type-check; npm run build`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/workspace frontend/components/workspace frontend/lib/api.ts frontend/stores frontend/types frontend/tests
git commit -m "feat: integrate repository and member controls"
```

### Task 11: Full verification and operational documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `.gitignore`
- Modify: `docs/superpowers/plans/2026-09-12-internal-code-repository-implementation.md`

**Interfaces:**
- Produces: reproducible local setup, artifact storage configuration, migration command, and checked completion list.

- [ ] **Step 1: Run complete backend verification**

Run: `cd backend; npx prisma format; npx prisma validate; npm test -- --runInBand; npm run build`

Expected: all exit 0 with no failed tests.

- [ ] **Step 2: Run complete frontend verification**

Run: `cd frontend; npm test; npm run type-check; npm run build`

Expected: all exit 0.

- [ ] **Step 3: Inspect repository hygiene**

Run: `git diff --check; git status --short; git check-ignore backend/artifacts/probe.bin`

Expected: no whitespace errors; generated artifacts ignored; only intended files changed.

- [ ] **Step 4: Document exact startup**

README documents `DATABASE_URL`, `JWT_SECRET`, `ARTIFACT_STORAGE_PATH`, `npx prisma migrate deploy`, backend/frontend startup, repository permission matrix, and legacy ZIP compatibility. It explicitly states that GCS, XMI, mobile, offline AI, and deployment remain later documented phases.

- [ ] **Step 5: Mark completed plan checkboxes and commit**

```bash
git add README.md docs/README.md .gitignore docs/superpowers/plans/2026-09-12-internal-code-repository-implementation.md
git commit -m "docs: document internal repository workflow"
```

- [ ] **Step 6: Review final diff against spec**

Run: `git diff origin/main...HEAD --stat; git log --oneline origin/main..HEAD`

Expected: every changed file maps to Tasks 1–11 and every spec acceptance criterion has implementation and test evidence.
