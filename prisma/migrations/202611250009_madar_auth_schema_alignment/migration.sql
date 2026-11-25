-- Preserve existing authentication preferences and passkeys. Only add missing objects.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sidebarHue" INTEGER NOT NULL DEFAULT 270;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "currentChallenge" TEXT;
CREATE TABLE IF NOT EXISTS "BiometricCredential" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "credentialID" TEXT NOT NULL,
 "publicKey" BYTEA NOT NULL, "counter" BIGINT NOT NULL DEFAULT 0,
 "deviceType" TEXT, "backedUp" BOOLEAN NOT NULL DEFAULT false, "transports" TEXT[],
 "deviceName" TEXT, "lastUsedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "BiometricCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BiometricCredential_credentialID_key" ON "BiometricCredential"("credentialID");
CREATE INDEX IF NOT EXISTS "BiometricCredential_userId_idx" ON "BiometricCredential"("userId");
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='"BiometricCredential"'::regclass AND conname='BiometricCredential_userId_fkey') THEN
  ALTER TABLE "BiometricCredential" ADD CONSTRAINT "BiometricCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;
