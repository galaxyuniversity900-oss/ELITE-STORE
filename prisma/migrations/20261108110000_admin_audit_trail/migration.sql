CREATE TABLE "admin_audit_logs" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" VARCHAR(255) NOT NULL,
  "resourceType" VARCHAR(80) NOT NULL,
  "resourceId" VARCHAR(128),
  "method" VARCHAR(12) NOT NULL,
  "route" VARCHAR(500) NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "requestId" VARCHAR(128),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_audit_logs_actorId_createdAt_idx" ON "admin_audit_logs"("actorId", "createdAt");
CREATE INDEX "admin_audit_logs_resourceType_resourceId_createdAt_idx" ON "admin_audit_logs"("resourceType", "resourceId", "createdAt");
CREATE INDEX "admin_audit_logs_action_createdAt_idx" ON "admin_audit_logs"("action", "createdAt");
