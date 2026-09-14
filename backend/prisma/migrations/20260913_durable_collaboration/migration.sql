ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DIAGRAM_OPERATION_APPLIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SYNC_CONFLICT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SYNC_CONFLICT_RESOLVED';

CREATE TYPE "DiagramOperationStatus" AS ENUM ('APPLIED', 'CONFLICT');
CREATE TYPE "SyncConflictStatus" AS ENUM ('PENDING', 'RESOLVED');

CREATE TABLE "diagram_operations" (
    "id" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "clientSequence" INTEGER NOT NULL,
    "serverSequence" INTEGER NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "resultVersion" INTEGER NOT NULL,
    "operation" JSONB NOT NULL,
    "beforeData" JSONB NOT NULL,
    "afterData" JSONB NOT NULL,
    "status" "DiagramOperationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagram_operations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_conflicts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "baseData" JSONB NOT NULL,
    "localData" JSONB NOT NULL,
    "remoteData" JSONB NOT NULL,
    "resolution" JSONB,
    "status" "SyncConflictStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "diagram_operations_deviceId_clientSequence_key"
ON "diagram_operations"("deviceId", "clientSequence");
CREATE UNIQUE INDEX "diagram_operations_diagramId_serverSequence_key"
ON "diagram_operations"("diagramId", "serverSequence");
CREATE INDEX "diagram_operations_diagramId_createdAt_idx"
ON "diagram_operations"("diagramId", "createdAt");
CREATE UNIQUE INDEX "sync_conflicts_operationId_key"
ON "sync_conflicts"("operationId");
CREATE INDEX "sync_conflicts_workspaceId_status_createdAt_idx"
ON "sync_conflicts"("workspaceId", "status", "createdAt");
CREATE INDEX "sync_conflicts_diagramId_status_idx"
ON "sync_conflicts"("diagramId", "status");

ALTER TABLE "diagram_operations" ADD CONSTRAINT "diagram_operations_diagramId_fkey"
FOREIGN KEY ("diagramId") REFERENCES "diagrams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagram_operations" ADD CONSTRAINT "diagram_operations_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_diagramId_fkey"
FOREIGN KEY ("diagramId") REFERENCES "diagrams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_operationId_fkey"
FOREIGN KEY ("operationId") REFERENCES "diagram_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
