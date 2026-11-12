CREATE TYPE "ConsentType" AS ENUM (
  'MARKETING_EMAIL',
  'MARKETING_WHATSAPP',
  'ANALYTICS',
  'PERSONALIZATION'
);

CREATE TABLE "consent_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "consentType" "ConsentType" NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT FALSE,
  "policyVersion" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ACCOUNT_SETTINGS',
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consent_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consent_preferences_userId_consentType_key"
  ON "consent_preferences"("userId", "consentType");
CREATE INDEX "consent_preferences_consentType_granted_decidedAt_idx"
  ON "consent_preferences"("consentType", "granted", "decidedAt");

ALTER TABLE "consent_preferences"
  ADD CONSTRAINT "consent_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
