-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('CREATING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
    'REVISION_PUBLISHED',
    'REVISION_PUBLICATION_FAILED',
    'REVISION_COMPARED',
    'REVISION_DOWNLOADED',
    'REVISION_RESTORED',
    'REVIEW_COMMENT_CREATED',
    'MEMBER_ROLE_UPDATED',
    'MEMBER_REMOVED',
    'REPOSITORY_POLICY_UPDATED'
);

-- AlterTable
ALTER TABLE "workspaces"
ADD COLUMN "allowViewerComments" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "code_revisions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "modelVersion" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "projectType" "ProjectType" NOT NULL,
    "generator" TEXT NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'CREATING',
    "parentRevisionId" TEXT,
    "restoredFromId" TEXT,
    "manifest" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "code_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_files" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isBinary" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "line" INTEGER,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "generated_codes" ADD COLUMN "revisionId" TEXT;

-- CreateIndex
CREATE INDEX "code_revisions_workspaceId_createdAt_idx"
ON "code_revisions"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "code_revisions_diagramId_createdAt_idx"
ON "code_revisions"("diagramId", "createdAt");

-- CreateIndex
CREATE INDEX "revision_files_revisionId_idx"
ON "revision_files"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "revision_files_revisionId_path_key"
ON "revision_files"("revisionId", "path");

-- CreateIndex
CREATE INDEX "review_comments_revisionId_fileId_createdAt_idx"
ON "review_comments"("revisionId", "fileId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_workspaceId_createdAt_idx"
ON "audit_events"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx"
ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "generated_codes_revisionId_key"
ON "generated_codes"("revisionId");

-- AddForeignKey
ALTER TABLE "code_revisions" ADD CONSTRAINT "code_revisions_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_revisions" ADD CONSTRAINT "code_revisions_diagramId_fkey"
FOREIGN KEY ("diagramId") REFERENCES "diagrams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_revisions" ADD CONSTRAINT "code_revisions_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_revisions" ADD CONSTRAINT "code_revisions_parentRevisionId_fkey"
FOREIGN KEY ("parentRevisionId") REFERENCES "code_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_revisions" ADD CONSTRAINT "code_revisions_restoredFromId_fkey"
FOREIGN KEY ("restoredFromId") REFERENCES "code_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_files" ADD CONSTRAINT "revision_files_revisionId_fkey"
FOREIGN KEY ("revisionId") REFERENCES "code_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_revisionId_fkey"
FOREIGN KEY ("revisionId") REFERENCES "code_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_fileId_fkey"
FOREIGN KEY ("fileId") REFERENCES "revision_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_codes" ADD CONSTRAINT "generated_codes_revisionId_fkey"
FOREIGN KEY ("revisionId") REFERENCES "code_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
