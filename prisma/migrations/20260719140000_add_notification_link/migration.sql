-- Adds a deep-link target URL to Notification so clicking a notification can
-- navigate straight to the record it's about (approval card, employee
-- profile, etc.) instead of always dropping the user on the generic list.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "link" TEXT;
