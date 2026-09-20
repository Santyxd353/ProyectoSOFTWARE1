-- Portable invitation secrets are stored only as SHA-256 hashes.
DROP INDEX IF EXISTS "workspace_invitations_workspaceId_email_key";

ALTER TABLE "workspace_invitations"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "tokenHash" TEXT,
  ADD COLUMN "shortCodeHash" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "workspace_invitations_tokenHash_key"
  ON "workspace_invitations"("tokenHash");
CREATE UNIQUE INDEX "workspace_invitations_shortCodeHash_key"
  ON "workspace_invitations"("shortCodeHash");
CREATE INDEX "workspace_invitations_workspaceId_status_idx"
  ON "workspace_invitations"("workspaceId", "status");
