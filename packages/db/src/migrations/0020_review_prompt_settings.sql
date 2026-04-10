ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "review_prompt_threshold" integer NOT NULL DEFAULT 8;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "review_prompt_platforms" text NOT NULL DEFAULT 'google,tripadvisor';
