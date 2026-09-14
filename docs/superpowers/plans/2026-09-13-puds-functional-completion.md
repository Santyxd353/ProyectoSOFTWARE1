# PUDS Functional Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining locally testable gaps between `Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf` and the web, API, and Android applications.

**Architecture:** PostgreSQL remains the source of truth for ordered collaboration events, offline operations, conflicts, audit records, and immutable code revisions. REST handles durable synchronization and artifact interchange; Socket.IO broadcasts already-persisted events. The browser and Flutter clients consume the same role and version contracts.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Socket.IO, Jest, Next.js/React, Node test runner, Flutter/Dart.

**Spec:** `docs/Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf`, especially RF-04, RF-10, RF-14 through RF-20, RF-24 and CU-04, CU-10, CU-14 through CU-18.

## Global Constraints

- Local execution is completed before Google Cloud deployment work.
- Mobile delivery targets Android only.
- OWNER and EDITOR can modify; VIEWER is read-only except for comments when project policy permits.
- Published repository revisions are immutable; restore always creates a new revision.
- AI proposals and imports require explicit human confirmation before persistence.
- Offline operations remain stored until the server confirms them.
- Import code is never executed, XML entities are rejected, and unsupported elements are reported.

---

### Task 1: Durable diagram collaboration and offline synchronization

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260913_durable_collaboration/migration.sql`
- Create: `backend/src/collaboration/collaboration-operation.service.ts`
- Create: `backend/src/collaboration/collaboration-operation.service.spec.ts`
- Modify: `backend/src/collaboration/collaboration.gateway.ts`
- Modify: `backend/src/collaboration/collaboration.module.ts`
- Modify: `backend/src/collaboration/collaboration.service.ts`
- Modify: `backend/src/diagram/diagram.controller.ts`

**Interfaces:**
- Consumes: canonical diagram JSON and `AuthorizationService.require(workspaceId, userId, 'diagram:edit')`.
- Produces: `apply(input): { status: 'APPLIED' | 'DUPLICATE' | 'CONFLICT'; sequence: number; version: number; conflictId?: string }` and `eventsAfter(diagramId, userId, sequence)`.

- [x] **Step 1: Write failing service tests** for sequential persistence, idempotency by `(deviceId, clientSequence)`, rejection of stale base versions with both variants stored, and ordered replay.
- [x] **Step 2: Run `npm test -- collaboration-operation.service.spec.ts --runInBand`** and verify failures are caused by the absent service/models.
- [x] **Step 3: Add `DiagramOperation` and `SyncConflict` models** with per-diagram server sequence, client idempotency key, base version, before/after JSON, author/device/timestamps, and explicit status.
- [x] **Step 4: Implement atomic apply/replay/resolve methods** so applying updates the diagram and creates an audit event in one transaction; stale versions create a conflict without overwriting either variant.
- [x] **Step 5: Persist before broadcasting in the gateway** and return acknowledgement data; add replay and conflict-resolution REST endpoints.
- [x] **Step 6: Run focused and complete backend tests** and commit the independently working server synchronization contract.

### Task 2: Confirmed JSON, ZIP, and XMI model interchange

**Files:**
- Modify: `backend/src/diagram-interchange/diagram-interchange.service.ts`
- Modify: `backend/src/diagram-interchange/diagram-interchange.service.spec.ts`
- Modify: `backend/src/diagram/diagram.controller.ts`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/workspace/[workspaceId]/page.tsx`
- Modify: `frontend/lib/i18n/catalogs/es.ts`
- Modify: `frontend/lib/i18n/catalogs/en.ts`

**Interfaces:**
- Consumes: XMI 2.1/2.5.1 XML, canonical JSON, or product ZIP containing `manifest.json` and `diagram.json`.
- Produces: `previewImport(...)` with canonical diagram, accepted/warning/unsupported lists and opaque signed preview token; `confirmImport(token, userId)` persists exactly once.

- [ ] **Step 1: Add failing tests** for JSON round-trip, ZIP round-trip, XMI preview without writes, confirmation persistence, token tampering/expiry, path traversal rejection, and unsupported-element warnings.
- [ ] **Step 2: Run the focused Jest test** and observe the expected missing-contract failures.
- [ ] **Step 3: Implement canonical exports and bounded parsers** with a 5 MB input limit, normalized paths, no entity expansion, no executable content, and a signed short-lived preview token.
- [ ] **Step 4: Replace direct import with preview then confirmation** in API and bilingual UI.
- [ ] **Step 5: Run backend/frontend tests and builds** and commit interoperable confirmed import/export.

### Task 3: API test artifacts stored with backend revisions

**Files:**
- Create: `backend/src/code-generation/api-artifacts.ts`
- Create: `backend/src/code-generation/api-artifacts.spec.ts`
- Modify: `backend/src/code-generation/code-generation.service.ts`
- Modify: `frontend/components/code-generation/CodeGenerationPanel.tsx`
- Modify: `frontend/lib/i18n/catalogs/es.ts`
- Modify: `frontend/lib/i18n/catalogs/en.ts`

**Interfaces:**
- Consumes: normalized UML classes and a sample base URL variable.
- Produces: valid OpenAPI 3.0 JSON and Postman Collection 2.1 JSON containing CRUD requests, example bodies, status assertions, and no credentials.

- [ ] **Step 1: Write failing pure-function tests** that validate schema versions, CRUD coverage, safe variables, examples, and test assertions.
- [ ] **Step 2: Run the focused test** and verify it fails because the artifact generator is absent.
- [ ] **Step 3: Implement deterministic artifact generation** and write both files into every Spring Boot project before repository publication.
- [ ] **Step 4: Surface the included artifacts in the bilingual generation panel.**
- [ ] **Step 5: Run all affected tests/builds** and commit the test artifact capability.

### Task 4: Confirmed AI backend refinement

**Files:**
- Create: `backend/src/ai-chat/backend-refinement.service.ts`
- Create: `backend/src/ai-chat/backend-refinement.service.spec.ts`
- Create: `backend/src/ai-chat/dto/backend-refinement.dto.ts`
- Modify: `backend/src/ai-chat/ai-chat.controller.ts`
- Modify: `backend/src/ai-chat/ai-chat.module.ts`
- Modify: `frontend/components/code-generation/CodeGenerationPanel.tsx`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/i18n/catalogs/es.ts`
- Modify: `frontend/lib/i18n/catalogs/en.ts`

**Interfaces:**
- Consumes: authorized diagram snapshot, sanitized instruction, technical restrictions, and configured cloud AI service.
- Produces: validated structured plan/diff proposal and a confirmation token; confirmation invokes deterministic generation and records model version, summarized prompt, and engine in the immutable revision manifest.

- [ ] **Step 1: Write failing tests** for secret redaction, schema rejection, no mutation during proposal, token authorization/expiry, and manifest traceability after confirmation.
- [ ] **Step 2: Run the focused test** and confirm the missing behavior failure.
- [ ] **Step 3: Implement proposal and confirmation endpoints** without allowing the model to write repository files directly.
- [ ] **Step 4: Add bilingual review/apply/discard UI** to backend generation.
- [ ] **Step 5: Run backend/frontend suites and builds** and commit the refinement flow.

### Task 5: Local integration evidence and traceability closure

**Files:**
- Modify: `README.md`
- Modify: `mobile/README.md`
- Create: `docs/TRACEABILITY.md`
- Modify: `INICIAR_LOCAL.cmd`
- Modify: `DETENER_LOCAL.cmd`

**Interfaces:**
- Consumes: the implemented REST, WebSocket, frontend, PostgreSQL, and Android contracts.
- Produces: one-command local startup, deterministic migration instructions, physical-phone LAN instructions, and RF/CU-to-code/test evidence.

- [ ] **Step 1: Apply all Prisma migrations to the local PostgreSQL instance** and verify a clean deploy.
- [ ] **Step 2: Start API and web clients, then exercise authentication, project, diagram, generation, repository, import/export, and synchronization endpoints.**
- [ ] **Step 3: Run backend tests/build, frontend tests/typecheck/build, Flutter analyze/test/APK build, and record exact commands/results.**
- [ ] **Step 4: Update local launch scripts and documentation** only from verified runtime behavior.
- [ ] **Step 5: Review every RF-01 through RF-24 and CU-01 through CU-20** against concrete files/tests; fix any remaining local-only gap before the final commit.
