ALTER TABLE "User"
  ADD COLUMN "loginEmail" TEXT,
  ADD COLUMN "loginEmailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "employeePasswordMode" TEXT NOT NULL DEFAULT 'IDENTITY_SUFFIX',
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "User_loginEmail_key" ON "User"("loginEmail");
