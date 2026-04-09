ALTER TABLE "properties" ADD COLUMN "business_email" text;
ALTER TABLE "properties" ADD COLUMN "business_email_verified" boolean NOT NULL DEFAULT false;
ALTER TABLE "properties" ADD COLUMN "business_email_token" text;
ALTER TABLE "properties" ADD COLUMN "business_email_token_expires" timestamptz;

CREATE UNIQUE INDEX "properties_business_email_token_idx" ON "properties" ("business_email_token") WHERE "business_email_token" IS NOT NULL;
