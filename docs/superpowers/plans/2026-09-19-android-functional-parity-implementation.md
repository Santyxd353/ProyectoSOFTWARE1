# Android Functional Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the complete reconstructed PUDS and deliver RF-25 through RF-32 / CU-21 through CU-25 as a locally testable Android application sharing the web system's backend contracts.

**Architecture:** Keep NestJS/PostgreSQL as the authority for authorization, invitations, versions, generated artifacts, and conflicts. Split the Flutter MVP into feature modules backed by typed REST and Socket.IO clients, a durable local store, and a single operation queue. Use a touch canvas plus forms for UML editing and a FunctionGemma adapter with a deterministic fallback only when the model is unavailable.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Jest, Next.js, Flutter/Dart, `socket_io_client`, Android app links, secure storage, system file picker/share APIs, `flutter_gemma`/LiteRT, ReportLab, pypdf, Poppler.

**Spec:** `docs/superpowers/specs/2026-09-19-android-functional-parity-design.md`

## Global Constraints

- The attached 113-page reconstructed PUDS is the editorial base; never replace it with the reduced 91-page derivative.
- Pages 1 and 2 remain identical covers with student `Sanchez Paniagua Felix Santiago`, registration `222115203`, and no group number.
- New functionality must appear in the PUDS before code is marked implemented in `docs/TRACEABILITY.md`.
- Local-only completion; do not add Google Cloud deployment changes.
- Work only on `feature/security-ai-mobile-polish`; do not merge or push `main`.
- Android is the mobile target. Keep API credentials out of the device and repository.
- New behavior follows RED-GREEN-REFACTOR; each task ends with its relevant suite and a commit.

## Review Focus

- Expired, revoked, reused, malformed, or email-bound invite tokens must not create or elevate membership; Task 2 pins each case.
- A process death while offline must not lose or double-apply an operation; Task 5 pins durable queue and idempotent replay.
- Concurrent edits to one UML field must preserve base/local/remote variants and authorship; Task 6 pins the conflict flow.
- A VIEWER must never mutate diagrams, generate/restore code, or import models even if the mobile UI is stale; Tasks 3, 5, and 7 pin server rejection and UI capabilities.
- A missing or unsupported on-device model must be reported honestly and route only supported basic commands to the deterministic fallback; Task 8 pins engine attribution and fallback behavior.

---

### Task 1: Restore and extend the complete PUDS

**Files:**
- Modify: `C:/Users/ASUS/Desktop/FICCT/Software1/tmp/pdfs/rebuild/content.py`
- Modify: `C:/Users/ASUS/Desktop/FICCT/Software1/tmp/pdfs/rebuild/layout.py`
- Modify: `C:/Users/ASUS/Desktop/FICCT/Software1/tmp/pdfs/rebuild/diagram_generator.py`
- Modify: `C:/Users/ASUS/Desktop/FICCT/Software1/tmp/pdfs/rebuild/build_puds.py`
- Modify: `C:/Users/ASUS/Desktop/FICCT/Software1/tmp/pdfs/rebuild/verify_puds.py`
- Modify: `C:/Users/ASUS/Desktop/FICCT/Software1/tmp/pdfs/rebuild/test_layout.py`
- Create: `C:/Users/ASUS/Desktop/FICCT/Software1/tmp/pdfs/rebuild/test_mobile_parity_content.py`
- Replace: `docs/Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf`

**Interfaces:**
- Consumes: `page_plan()`, `REQUIREMENTS`, `CASES`, and `diagram_manifest()` from the existing reproducible builder.
- Produces: a 118-125 page PDF containing RF-01..RF-32, CU-01..CU-25, detailed CU-21..CU-25 specifications, corresponding analysis/design diagrams, clickable contents, and truthful implementation status.

- [ ] **Step 1: Write failing document-contract tests**

```python
def test_mobile_parity_is_integrated_into_the_complete_document():
    assert list(REQUIREMENTS)[-8:] == [f"RF-{n}" for n in range(25, 33)]
    assert [case["id"] for case in CASES][-5:] == [f"CU-{n}" for n in range(21, 26)]
    plan = page_plan()
    assert plan[:2] == ["cover", "cover"]
    assert all(f"case-spec-{n:02d}" in plan for n in range(1, 26))
    assert 118 <= len(plan) <= 125
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `python -m unittest test_mobile_parity_content.py test_layout.py -v` in `tmp/pdfs/rebuild`  
Expected: FAIL because RF-25, CU-21, and the added pages do not exist.

- [ ] **Step 3: Add RF-25..RF-32, CU-21..CU-25, mobile diagrams, page builders, and dynamic index labels**

Use the same `_case(...)` contract as CU-01..CU-20. Add diagram manifests that cover CU-21..CU-25 in use-case, communication, and sequence views. Replace fixed references to 20/113 with values derived from `len(CASES)` and `len(page_plan())`.

- [ ] **Step 4: Rebuild and structurally verify the PDF**

Run: `python build_puds.py && python verify_puds.py`  
Expected: `structural_verification=PASS`, two identical covers, at least 100 valid internal links, no forbidden legacy repository/student text, and CU-01..CU-25 sufficiently represented.

- [ ] **Step 5: Render every page and inspect contact sheets plus all new/suspicious pages at full size**

Run: bundled Poppler `pdftoppm -jpeg -r 110 output/pdf/Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf tmp/pdfs/rebuild/rendered/page`  
Expected: one image per page, no clipping, overlap, broken table, unreadable diagram, or incorrect page reference.

- [ ] **Step 6: Copy the verified PDF into `docs/`, update traceability state, and commit**

```powershell
git add docs/Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf docs/README.md docs/TRACEABILITY.md
git commit -m "docs: restore complete PUDS and document Android parity"
```

### Task 2: Portable invitations by URL and code

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/*_portable_invitations/migration.sql`
- Create: `backend/src/invitation/dto/create-portable-invitation.dto.ts`
- Create: `backend/src/invitation/dto/claim-portable-invitation.dto.ts`
- Modify: `backend/src/invitation/invitation.service.ts`
- Modify: `backend/src/invitation/invitation.service.spec.ts`
- Modify: `backend/src/workspace/workspace.controller.ts`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/workspace/MemberManagement.tsx`

**Interfaces:**
- Produces: `createPortable(workspaceId, actorId, role, expiresInHours, email?)`, `claimPortable(userId, rawSecret)`, and REST routes `POST /workspaces/:id/invitations/portable`, `POST /workspaces/invitations/claim`, `DELETE /workspaces/:id/invitations/:invitationId`.
- Returns the raw URL token and short code only from creation; stores SHA-256 hashes.

- [ ] **Step 1: Add failing service tests** for seven-day default expiry, email binding, OWNER rejection, revoked/expired/reused token rejection, idempotent acceptance, and no role escalation.
- [ ] **Step 2: Run `npm test -- invitation.service.spec.ts --runInBand` and verify RED** on missing portable methods/fields.
- [ ] **Step 3: Add the Prisma migration and DTO validation**, preserving legacy email invitations while making `email` nullable and adding unique nullable token/code hashes, `expiresAt`, and `claimedAt`.
- [ ] **Step 4: Implement service methods transactionally**, using `crypto.randomBytes`, normalized short codes, `timingSafeEqual`-safe hash lookup semantics, and sanitized audit metadata.
- [ ] **Step 5: Add controller routes and web controls**, showing copyable link/code, expiration, role, and revocation without logging the secrets.
- [ ] **Step 6: Run backend tests/build and frontend tests/typecheck**, then commit with `feat: add portable workspace invitations`.

### Task 3: Flutter feature foundation, account, and project lifecycle

**Files:**
- Modify: `mobile/pubspec.yaml`
- Split: `mobile/lib/main.dart`
- Modify: `mobile/lib/core/models/models.dart`
- Modify: `mobile/lib/core/api/api_client.dart`
- Modify: `mobile/lib/core/storage/local_store.dart`
- Modify: `mobile/lib/app_controller.dart`
- Create: `mobile/lib/app.dart`
- Create: `mobile/lib/features/auth/*.dart`
- Create: `mobile/lib/features/workspaces/*.dart`
- Create: `mobile/lib/features/settings/*.dart`
- Modify/Create tests under `mobile/test/`

**Interfaces:**
- Produces typed methods for register/profile, workspace create/update, member/role/invitation listing, and diagram create/archive/restore.
- UI capability checks consume server role data and never replace server authorization.

- [ ] **Step 1: Add failing API/model/controller tests** for registration, profile, workspace creation/settings, diagram lifecycle, Spanish/English selection, theme persistence, and VIEWER-disabled mutations.
- [ ] **Step 2: Run `flutter test` and verify RED** because typed methods/screens do not exist.
- [ ] **Step 3: Introduce feature folders and typed API methods**, retaining the current secure token and configurable local API URL.
- [ ] **Step 4: Build responsive screens** for account, project list/detail, project settings, diagrams, members, language, and theme.
- [ ] **Step 5: Run `dart format`, `flutter analyze`, and `flutter test`**, then commit with `feat: add Android account and project lifecycle`.

### Task 4: Complete touch UML editor

**Files:**
- Create: `mobile/lib/features/diagrams/editor/uml_canvas.dart`
- Create: `mobile/lib/features/diagrams/editor/uml_canvas_controller.dart`
- Create: `mobile/lib/features/diagrams/editor/class_form.dart`
- Create: `mobile/lib/features/diagrams/editor/relation_form.dart`
- Create: `mobile/lib/features/diagrams/editor/diagram_operations.dart`
- Create: `mobile/test/uml_canvas_controller_test.dart`
- Create: `mobile/test/diagram_operations_test.dart`
- Create: `mobile/test/uml_editor_widget_test.dart`

**Interfaces:**
- Produces closed operations `createClass`, `moveClass`, `updateClass`, `deleteClass`, `upsertAttribute`, `upsertMethod`, `createRelation`, `updateRelation`, and `deleteRelation` serialized to the backend operation contract.

- [ ] **Step 1: Write failing operation tests** for every class/member/relation behavior, stable IDs, multiplicities, and invalid references.
- [ ] **Step 2: Verify RED with `flutter test test/diagram_operations_test.dart test/uml_canvas_controller_test.dart`**.
- [ ] **Step 3: Implement immutable operation reducers and validation**, independent from widgets.
- [ ] **Step 4: Write failing widget tests** for pan/zoom, class selection/movement, relation creation, bottom-sheet forms, and destructive confirmation.
- [ ] **Step 5: Implement `InteractiveViewer` + `CustomPainter` canvas and accessible forms**, emitting only tested operations.
- [ ] **Step 6: Run full Flutter suite/analyze**, then commit with `feat: add complete touch UML editor`.

### Task 5: Durable offline sync and process-death recovery

**Files:**
- Modify: `mobile/lib/core/sync/sync_queue.dart`
- Modify: `mobile/lib/core/storage/local_store.dart`
- Modify: `mobile/lib/app_controller.dart`
- Create: `mobile/lib/core/sync/sync_coordinator.dart`
- Modify: `mobile/test/sync_queue_test.dart`
- Modify: `mobile/test/app_controller_sync_test.dart`
- Create: `mobile/test/sync_coordinator_test.dart`

**Interfaces:**
- Produces `SyncCoordinator.start()`, `enqueue(DiagramOperation)`, `syncNow()`, and status streams `synced/pending/conflict/reviewRequired`.

- [ ] **Step 1: Add failing tests** proving write-before-render, queue reload after process death, ordered/idempotent replay, token-expiry preservation, retry backoff, and no deletion before server confirmation.
- [ ] **Step 2: Run targeted tests and verify RED**.
- [ ] **Step 3: Implement the coordinator and migrate existing queue data without loss**.
- [ ] **Step 4: Integrate lifecycle/connectivity triggers and visible status**.
- [ ] **Step 5: Run all Flutter tests/analyze**, then commit with `feat: harden Android offline synchronization`.

### Task 6: Mobile realtime collaboration, invitations, and conflict resolution

**Files:**
- Modify: `mobile/pubspec.yaml`
- Create: `mobile/lib/core/realtime/realtime_client.dart`
- Create: `mobile/lib/features/workspaces/invitations_screen.dart`
- Create: `mobile/lib/features/conflicts/conflicts_screen.dart`
- Create: `mobile/lib/features/conflicts/conflict_merge.dart`
- Create: `mobile/test/realtime_client_test.dart`
- Create: `mobile/test/invitations_screen_test.dart`
- Create: `mobile/test/conflict_merge_test.dart`

**Interfaces:**
- Consumes portable invitation endpoints and collaboration gateway events.
- Produces authenticated join/leave/replay/presence, deep-link/manual-code acceptance, and explicit local/remote/merged conflict payloads.

- [ ] **Step 1: Add failing tests** for JWT socket auth, replay after reconnect, presence, expired/revoked codes, idempotent acceptance, and three conflict resolutions retaining metadata.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement realtime client and app-link routing** without treating socket delivery as persistence.
- [ ] **Step 4: Implement invite creation/share/claim and conflict comparison/merge screens**.
- [ ] **Step 5: Run backend collaboration/invitation suites and full Flutter suite**, then commit with `feat: add Android collaboration invitations and conflicts`.

### Task 7: Mobile generation, internal repository, and interchange

**Files:**
- Modify: `mobile/pubspec.yaml`
- Extend: `mobile/lib/core/api/api_client.dart`
- Create: `mobile/lib/features/generation/*.dart`
- Create: `mobile/lib/features/repository/*.dart`
- Create: `mobile/lib/features/interchange/*.dart`
- Create tests under `mobile/test/` for generation, repository, comments, compare/restore, and interchange.

**Interfaces:**
- Consumes existing Spring Boot/Flutter/OpenAPI/Postman, revision tree/file/comment/compare/download/restore, and import preview/confirm/export endpoints.
- Produces native file save/share and picker flows with role-aware controls.

- [ ] **Step 1: Add failing API tests** for every endpoint and binary download filename/content type.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement typed API/file-transfer clients** using system picker/share APIs.
- [ ] **Step 4: Add failing widget tests and implement screens** for generation, revisions, tree/file view, comments, comparison, download, restore, import preview/confirm, and XMI/JSON/ZIP export.
- [ ] **Step 5: Run backend generation/repository/interchange suites and full Flutter suite**, then commit with `feat: add Android code and model portability`.

### Task 8: Honest on-device FunctionGemma integration

**Files:**
- Modify: `mobile/pubspec.yaml`
- Create: `mobile/lib/core/ai/local_model_runtime.dart`
- Create: `mobile/lib/core/ai/function_catalog.dart`
- Modify: `mobile/lib/core/ai/local_ai_engine.dart`
- Create: `mobile/lib/features/ai/model_manager_screen.dart`
- Modify: `mobile/test/local_ai_engine_test.dart`
- Create: `mobile/test/local_model_runtime_test.dart`
- Create: `mobile/test/function_catalog_test.dart`

**Interfaces:**
- Produces `LocalModelRuntime.load(modelPath)`, `infer(prompt, tools)`, model attribution, and validated tool calls mapped to the operation reducers from Task 4.
- Fallback supports only the explicitly tested basic deterministic commands and reports `engine=fallback`; it never impersonates FunctionGemma.

- [ ] **Step 1: Add failing tests** for model availability, tool-schema validation, unsupported/destructive calls, engine attribution, offline inference, and fallback boundaries.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Integrate the FunctionGemma runtime/model manager**, supporting explicit local model import/download, checksum, load/unload, and resource errors.
- [ ] **Step 4: Connect validated tool calls to diagram operations and text/voice chat**, preserving confirmation for destructive changes.
- [ ] **Step 5: Run Flutter tests/analyze and an Android runtime smoke test**, then commit with `feat: integrate on-device FunctionGemma`.

### Task 9: End-to-end acceptance, documentation, and APK

**Files:**
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/README.md`
- Modify: `README.md`
- Add integration tests under `mobile/integration_test/`

**Interfaces:**
- Consumes every task's public contract.
- Produces evidence for RF-25..RF-32 and CU-21..CU-25, local startup instructions, and the debug APK.

- [ ] **Step 1: Add integration journeys** for CU-21..CU-25, including two authenticated users, invite link/code, realtime edit, airplane-mode edit, reconnect/conflict resolution, generation/repository, and XMI round trip.
- [ ] **Step 2: Run backend full tests/build; frontend tests/typecheck/build; Flutter analyze/test/integration tests** and capture exact totals.
- [ ] **Step 3: Run dependency audits**, resolving high/critical findings without suppressions.
- [ ] **Step 4: Build/install the debug APK and execute the acceptance list on the Android emulator**, including process restart during offline work.
- [ ] **Step 5: Update traceability from Pending to Implemented only for evidenced rows**, list any hardware-only limitation explicitly, and commit with `test: verify Android functional parity locally`.
- [ ] **Step 6: Perform a whole-branch review and one RED-GREEN fix pass for Critical/Important findings**. Do not merge or push `main`.
