ALTER TABLE "Notification" ADD COLUMN "automationKey" TEXT;
CREATE UNIQUE INDEX "Notification_automationKey_key" ON "Notification"("automationKey");
