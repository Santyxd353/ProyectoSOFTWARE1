# PUDS Gap Closure and Google Cloud Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the identified CU-08, CU-15, CU-16, CU-18 and CU-25 gaps, align the PUDS status, and prepare a reproducible Google Cloud deployment without deploying or pushing to main.

**Architecture:** Keep the existing NestJS/Next.js/Flutter clients. Use a server-verified three-way merge for independent concurrent UML edits; make AI proposals selectively applicable; resume a durable Android queue after interactive reauthentication. Prepare a single-VM Google Cloud release package because current artifacts use local filesystem storage and Socket.IO is single-instance.

**Tech Stack:** NestJS, Prisma, Jest, Next.js, Node test runner, Flutter, PUDS PDF, Compute Engine deployment scripts.

**Spec:** `docs/Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf` pages 46, 53-56, 63, 106-108, 119-120, 124; `docs/TRACEABILITY.md`.

## Global Constraints

- Preserve all existing user changes in the dirty `feature/security-ai-mobile-polish` worktree.
- Do not push or merge to `main`, create Google Cloud resources, or expose API keys.
- Keep incompatible edits as explicit conflicts with both variants; never trust client-supplied base data as authority for automatic merge.
- Keep Android's offline queue durable until the server confirms application.
- Do not claim Gemini generation is available while Google responds 403.

## Review Focus

**Ruling:** Una respuesta incompleta de IA no se interpreta como solicitud de borrado. La vista de diferencias y selección permite altas/modificaciones; la eliminación permanece en el editor con confirmación destructiva. Esto evita que una omisión del modelo elimine trabajo previo, a costa de no incluir eliminaciones en la propuesta automática.

- A forged stale base must not overwrite a remote edit; resolve the baseline from server history.
- A deleted class and a concurrent relation to it must not auto-merge into an invalid model.
- Selecting no AI changes must never mutate a diagram or publish a revision.
- A 401 during offline replay must preserve the queued operation, and login must resume it once.
- A restarted deployment must retain the database and published revision files.

---

### Task 1: Deterministic concurrent-edit merge

**Files:** Create `backend/src/collaboration/diagram-three-way-merge.ts` and `.spec.ts`; modify `backend/src/collaboration/collaboration-operation.service.ts` and `.spec.ts`.

**Interfaces:** `mergeDiagram(base, local, remote): { merged: Record<string, unknown> } | null`; the service retrieves a trusted snapshot at `baseVersion` from persisted operations, and returns APPLIED for disjoint edits or CONFLICT for overlapping/unsafe edits.

- [ ] Write tests for disjoint class additions, independent attributes, same-field edits, delete-vs-reference, and absent trusted baseline.
- [ ] Run focused Jest tests and observe failure.
- [ ] Implement pure merge and service integration, preserving existing audit and operation contracts.
- [ ] Re-run focused tests, full backend tests and backend build.

### Task 2: Selective AI proposals and visible differences

**Files:** Create `frontend/lib/uml-proposal.ts` and `frontend/tests/uml-proposal.test.mjs`; modify `frontend/components/chat/AIChatInterface.tsx`, `frontend/components/editor/UMLEditor.tsx`, `frontend/components/code-generation/CodeGenerationPanel.tsx`; modify `backend/src/ai-chat/backend-refinement.service.ts`, controller/DTO as needed, and tests.

**Interfaces:** The UML proposal preview accepts a subset of class/relation IDs and merges only selected changes into the current diagram. Backend confirmation accepts an optional nonempty subset of features already signed into the proposal token.

- [ ] Write failing tests for added/modified/removed UML diff, partial UML apply, empty selection rejection, tampered backend-feature selection and valid subset confirmation.
- [ ] Run focused frontend/backend tests and observe failure.
- [ ] Implement selection UI and server-side subset verification; do not change published revisions in place.
- [ ] Run frontend tests/type-check/build and backend tests/build.

### Task 3: Android reconnect after expired session

**Files:** Modify `mobile/lib/app_controller.dart` and `mobile/test/app_controller_sync_test.dart` (and API contracts only if the test proves necessary).

**Interfaces:** After interactive login obtains a new JWT, the existing durable queue resumes automatically; a 401 leaves its operations intact. No silent refresh token is introduced without a server-side rotation design.

- [ ] Write a failing controller test for 401, retained queue, login, exactly-once replay.
- [ ] Run the focused Flutter test and observe failure.
- [ ] Add resumed replay after successful login, guarded against duplicate concurrent sync.
- [ ] Run all Flutter tests and `flutter analyze`.

### Task 4: Reconcile the PUDS and traceability

**Files:** Modify `docs/Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf`, `docs/TRACEABILITY.md`, and the existing PDF update script or a follow-up script.

**Interfaces:** Page 106, 119 and 120 status labels match actual Android/repository evidence; page 124 distinguishes external Gemini 403, optional on-device model verification, and Google Cloud preparation. The SQL sketch is explicitly illustrative and mapped to actual Prisma table names.

- [ ] Extract and compare affected PDF pages and traceability rows.
- [ ] Update text in the existing design without disturbing links, duplicated cover, pagination or diagrams.
- [ ] Render and inspect each changed page; extract text and verify 124 pages and live TOC annotations.

### Task 5: Google Cloud deployment preparation, no remote mutation

**Files:** Create `deploy/gce/README.md`, `deploy/gce/` service/reverse-proxy templates or scripts; modify `README.md` and `.env.example` only if needed.

**Interfaces:** One Compute Engine VM runs PostgreSQL, backend and frontend behind HTTPS; persistent data/artifacts are outside the checkout, only ports 80/443 public, migrations run once, and rollback restores a prior application release without deleting data.

- [ ] Write a read-only validation script/test for required environment variables, ports, persistent paths and secret absence in tracked files; observe failure.
- [ ] Add deployment templates and a step-by-step runbook for project/billing/domain prerequisites, build, migrations, services, HTTPS, backups, smoke tests and rollback.
- [ ] Run validation, builds and test suites; do not deploy while Gemini access is denied or required credentials/domain are unavailable.
