ALTER TABLE "MadarWorkTask" ADD COLUMN "repeatEvery" TEXT, ADD COLUMN "repeatUntil" TIMESTAMP(3), ADD COLUMN "nextDueAt" TIMESTAMP(3), ADD COLUMN "occurrenceKey" TEXT;
ALTER TABLE "MadarWorkTask" ADD CONSTRAINT "MadarWorkTask_repeat_check" CHECK ("repeatEvery" IS NULL OR "repeatEvery" IN ('DAILY','WEEKLY','MONTHLY','YEARLY'));
CREATE UNIQUE INDEX "MadarWorkTask_occurrenceKey_key" ON "MadarWorkTask"("occurrenceKey");
CREATE INDEX "MadarWorkTask_nextDueAt_idx" ON "MadarWorkTask"("nextDueAt");
CREATE TABLE "MadarWorkTaskFile" ("id" TEXT NOT NULL,"taskId" TEXT NOT NULL,"authorId" TEXT NOT NULL,"fileName" TEXT NOT NULL,"sha256" TEXT NOT NULL,"bytes" BYTEA NOT NULL,"sizeBytes" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "MadarWorkTaskFile_pkey" PRIMARY KEY ("id"),CONSTRAINT "MadarWorkTaskFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MadarWorkTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,CONSTRAINT "MadarWorkTaskFile_size_check" CHECK ("sizeBytes">0 AND "sizeBytes"<=1000000));
CREATE UNIQUE INDEX "MadarWorkTaskFile_taskId_sha256_key" ON "MadarWorkTaskFile"("taskId","sha256");
