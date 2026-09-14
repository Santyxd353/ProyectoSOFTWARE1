ALTER TABLE "diagrams" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "diagrams_workspaceId_archivedAt_idx"
ON "diagrams"("workspaceId", "archivedAt");

ALTER TYPE "AuditAction" ADD VALUE 'DIAGRAM_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'DIAGRAM_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE 'WORKSPACE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'WORKSPACE_OWNERSHIP_TRANSFERRED';
ALTER TYPE "AuditAction" ADD VALUE 'INVITATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVITATION_CLAIMED';
ALTER TYPE "AuditAction" ADD VALUE 'INVITATION_REVOKED';

CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

CREATE TABLE "workspace_invitations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_invitations_workspaceId_email_key"
ON "workspace_invitations"("workspaceId", "email");

CREATE INDEX "workspace_invitations_email_status_idx"
ON "workspace_invitations"("email", "status");

ALTER TABLE "workspace_invitations"
ADD CONSTRAINT "workspace_invitations_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
ADD CONSTRAINT "workspace_invitations_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
ADD CONSTRAINT "workspace_invitations_acceptedById_fkey"
FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
