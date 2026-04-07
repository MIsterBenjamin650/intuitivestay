ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "admin_notes" text;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "is_vip" boolean DEFAULT false NOT NULL;
