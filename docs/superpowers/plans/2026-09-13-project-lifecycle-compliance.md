# Project Lifecycle PUDS Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete CU-02, CU-05, CU-06, CU-09, and CU-19 locally with pending invitations, editable workspace settings, logical diagram archiving, filtering, role administration, ownership transfer, and audit evidence.

**Architecture:** Prisma remains the source of truth. A dedicated invitation service owns pending invitations and automatic claiming at registration; workspace and diagram services expose explicit lifecycle operations guarded by the existing authorization layer. Next.js adds owner-only settings, archived-diagram management, filtering, and pending-invitation feedback without changing repository or UML data contracts.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Jest, Next.js 14, React, TypeScript, Node test runner.

**Spec:** `docs/Primer_Parcial_PUDS_ProyectoSOFTWARE1.pdf` — CU-02, CU-05, CU-06, CU-09, CU-19; RF-02, RF-05, RF-06, RF-09, RF-21, RF-24.

## Global Constraints

- Diagram removal is logical: archive and restore must preserve diagram data, revisions, and audit events.
- Unregistered email addresses create pending invitations that are claimed automatically after registration.
- Only the current OWNER may update workspace settings, manage invitations, or transfer ownership.
- Ownership transfer is transactional and leaves exactly one workspace owner.
- OWNER, EDITOR, and VIEWER remain the only persisted roles.
- Every authorization decision remains server-side; hidden controls are not security boundaries.
- Every user-facing string is available in English and Spanish.
- No Google Cloud dependency is introduced in this local-first phase.

---

### Task 1: Persist lifecycle and invitation state

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260913_project_lifecycle/migration.sql`
- Modify: `backend/src/audit/audit.service.spec.ts`

**Interfaces:**
- Produces: `Diagram.archivedAt: DateTime?`, `InvitationStatus`, `WorkspaceInvitation`, and audit actions `WORKSPACE_UPDATED`, `WORKSPACE_OWNERSHIP_TRANSFERRED`, `INVITATION_CREATED`, `INVITATION_CLAIMED`, `DIAGRAM_ARCHIVED`, `DIAGRAM_RESTORED`.
- Consumes: existing `User`, `Workspace`, `Diagram`, `Role`, and `AuditEvent` models.

- [ ] **Step 1: Write failing schema-contract assertions**

Extend the backend schema test surface with assertions that the Prisma schema contains `archivedAt DateTime?`, a unique pending invitation identity for workspace and normalized email, and the six audit actions listed above.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd backend && npm test -- --runInBand src/audit/audit.service.spec.ts`

Expected: FAIL because lifecycle fields and actions do not exist.

- [ ] **Step 3: Add schema and SQL migration**

Define:

```prisma
enum InvitationStatus {
  PENDING
  ACCEPTED
  REVOKED
}

model WorkspaceInvitation {
  id          String           @id @default(cuid())
  workspaceId String
  email       String
  role        Role             @default(VIEWER)
  status      InvitationStatus @default(PENDING)
  invitedById String
  acceptedById String?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  workspace  Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  invitedBy  User      @relation("InvitationAuthor", fields: [invitedById], references: [id], onDelete: Cascade)
  acceptedBy User?     @relation("InvitationRecipient", fields: [acceptedById], references: [id], onDelete: SetNull)

  @@unique([workspaceId, email])
  @@index([email, status])
}
```

Use `onDelete: SetNull` for `acceptedBy`; add inverse relations to `User` and `Workspace`; add `archivedAt DateTime?` plus an index on `[workspaceId, archivedAt]` to `Diagram`.

- [ ] **Step 4: Generate Prisma client and verify migration**

Run: `cd backend && npx prisma generate && npx prisma validate && npm run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/audit/audit.service.spec.ts
git commit -m "feat: persist project lifecycle state"
```

---

### Task 2: Pending invitation service and automatic claim

**Files:**
- Create: `backend/src/invitation/invitation.module.ts`
- Create: `backend/src/invitation/invitation.service.ts`
- Create: `backend/src/invitation/invitation.service.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/auth/auth.service.ts`
- Modify: `backend/src/workspace/workspace.module.ts`
- Modify: `backend/src/workspace/workspace.service.ts`
- Modify: `backend/src/workspace/workspace.controller.ts`

**Interfaces:**
- Produces: `InvitationService.invite(workspaceId, actorId, email, role)`, `claimForUser(userId, email)`, `list(workspaceId, actorId)`, and `revoke(workspaceId, actorId, invitationId)`.
- Consumes: `AuthorizationService`, `AuditService`, normalized lowercase email, and Prisma transaction APIs.

- [ ] **Step 1: Write failing invitation tests**

Cover registered-user immediate membership, unregistered-user pending invitation, duplicate pending invitation rejection, automatic claim after registration, OWNER-role rejection, owner-only listing, and revocation with audit recording.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd backend && npm test -- --runInBand src/invitation/invitation.service.spec.ts`

Expected: FAIL because `InvitationService` does not exist.

- [ ] **Step 3: Implement invitation transactions**

`invite` must lowercase and trim email, require `members:manage`, reject OWNER, create a collaborator immediately when the user exists, otherwise upsert a PENDING invitation. `claimForUser` must atomically create missing collaborations and mark all matching PENDING invitations ACCEPTED.

- [ ] **Step 4: Claim invitations during registration**

After creating the user and before returning the token, call `claimForUser(created.id, created.email)`. A claim failure must roll back registration by using one Prisma transaction boundary.

- [ ] **Step 5: Expose invitation endpoints**

Add owner-protected routes:

```text
POST   /workspaces/:id/invitations
GET    /workspaces/:id/invitations
DELETE /workspaces/:id/invitations/:invitationId
```

Keep `POST /workspaces/:id/collaborators` as a compatibility alias to `invite`.

- [ ] **Step 6: Verify backend**

Run: `cd backend && npm test -- --runInBand && npm run build`

Expected: all tests PASS and Nest build exits 0.

- [ ] **Step 7: Commit**

```bash
git add backend/src backend/prisma
git commit -m "feat: add pending workspace invitations"
```

---

### Task 3: Workspace settings, ownership transfer, and project listing

**Files:**
- Create: `backend/src/workspace/dto/update-workspace.dto.ts`
- Create: `backend/src/workspace/dto/transfer-ownership.dto.ts`
- Modify: `backend/src/workspace/workspace.controller.ts`
- Modify: `backend/src/workspace/workspace.service.ts`
- Modify: `backend/src/workspace/workspace.service.spec.ts`

**Interfaces:**
- Produces: `updateWorkspace(workspaceId, actorId, input)`, `transferOwnership(workspaceId, actorId, input)`, and query-aware `getUserWorkspaces(userId, { search, sort })`.
- Consumes: current OWNER identity, a collaborator membership id, and audit services.

- [ ] **Step 1: Write failing service tests**

Require owner-only metadata update; trimmed non-empty names; search over name and description; `updatedAt`/name sorting; transactional transfer that changes `ownerId`, removes the new owner collaboration, creates or updates the previous owner as EDITOR, and records an audit event.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd backend && npm test -- --runInBand src/workspace/workspace.service.spec.ts`

Expected: FAIL on missing methods.

- [ ] **Step 3: Implement service operations and routes**

Add:

```text
PATCH /workspaces/:id
POST  /workspaces/:id/transfer-ownership
GET   /workspaces?search=<text>&sort=updated_desc|updated_asc|name_asc|name_desc
```

The transfer DTO requires `memberId` and `confirmationName`; the latter must exactly match the current workspace name after trimming.

- [ ] **Step 4: Verify backend**

Run: `cd backend && npm test -- --runInBand src/workspace/workspace.service.spec.ts && npm run build`

Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/workspace backend/prisma
git commit -m "feat: complete workspace administration"
```

---

### Task 4: Logical diagram archive and restore

**Files:**
- Modify: `backend/src/diagram/diagram.controller.ts`
- Modify: `backend/src/diagram/diagram.service.ts`
- Create: `backend/src/diagram/diagram.service.spec.ts`
- Modify: `backend/src/workspace/workspace.service.ts`

**Interfaces:**
- Produces: `archiveDiagram(diagramId, actorId)`, `restoreDiagram(diagramId, actorId)`, and active/archived workspace diagram projections.
- Consumes: OWNER authorization and `Diagram.archivedAt`.

- [ ] **Step 1: Write failing archive tests**

Assert owner-only archive, no physical deletion, revisions retained, idempotent archive rejection, restore, active-list exclusion, archived-list inclusion, and both audit events.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd backend && npm test -- --runInBand src/diagram/diagram.service.spec.ts`

Expected: FAIL because archive operations do not exist.

- [ ] **Step 3: Implement archive routes**

Add:

```text
POST /diagrams/:id/archive
POST /diagrams/:id/restore
```

Change the legacy `DELETE /diagrams/:id` handler to call `archiveDiagram` so old clients no longer destroy data.

- [ ] **Step 4: Verify backend**

Run: `cd backend && npm test -- --runInBand src/diagram/diagram.service.spec.ts && npm run build`

Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/diagram backend/src/workspace backend/prisma
git commit -m "feat: archive diagrams without data loss"
```

---

### Task 5: Bilingual project administration UI

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/types/uml.ts`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/app/workspace/[workspaceId]/page.tsx`
- Modify: `frontend/components/workspace/MemberManagement.tsx`
- Create: `frontend/components/workspace/WorkspaceSettings.tsx`
- Create: `frontend/components/workspace/ArchivedDiagrams.tsx`
- Modify: `frontend/lib/i18n/catalogs/en.ts`
- Modify: `frontend/lib/i18n/catalogs/es.ts`
- Modify: `frontend/tests/i18n.test.mjs`

**Interfaces:**
- Consumes: lifecycle and invitation REST routes from Tasks 2–4.
- Produces: searchable/sortable dashboard, pending invitation list, settings editor, ownership transfer dialog, and archive/restore views.

- [ ] **Step 1: Write failing catalog and source contracts**

Require bilingual keys under `dashboard.search`, `dashboard.sort.*`, `workspace.settings.*`, `workspace.invitations.*`, `workspace.archive.*`, and `workspace.transfer.*`; assert destructive copy says archive rather than delete.

- [ ] **Step 2: Run frontend tests and confirm RED**

Run: `cd frontend && npm test`

Expected: FAIL on missing keys and lifecycle controls.

- [ ] **Step 3: Add API types and calls**

Add typed calls for queries, settings update, pending invitations, revocation, transfer, archive, and restore. Preserve user-created names and backend error details.

- [ ] **Step 4: Build the owner and member flows**

Render owner-only settings and transfer controls; show pending invitations separately from members; replace permanent deletion copy with archive copy; add an archived-diagrams panel with restore; add search and sort controls to the dashboard.

- [ ] **Step 5: Verify both locales and responsive layout**

Run: `cd frontend && npm test && npm run type-check && npm run build`

Expected: all tests PASS and build exits 0.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: add project lifecycle controls"
```

---

### Task 6: Runtime verification and PUDS traceability update

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Create: `docs/traceability/project-lifecycle-verification.md`

**Interfaces:**
- Consumes: all lifecycle functionality and test evidence.
- Produces: requirement-to-code evidence for CU-02, CU-05, CU-06, CU-09, and CU-19.

- [ ] **Step 1: Run complete regression suites**

Run:

```powershell
cd backend
npm test -- --runInBand
npm run build
cd ../frontend
npm test
npm run type-check
npm run build
```

Expected: zero failures.

- [ ] **Step 2: Verify the flows locally**

Use two local users to verify invitation before registration, automatic claim, role change, authorization denial, ownership transfer, archive, restore, search, sort, Spanish, and English.

- [ ] **Step 3: Document exact evidence**

Record each CU/RF, endpoint, UI location, automated test, and remaining limitation. Update README status text without claiming later phases are implemented.

- [ ] **Step 4: Run hygiene checks and commit**

```bash
git diff --check
git status --short
git add README.md docs backend frontend
git commit -m "docs: trace project lifecycle compliance"
```
