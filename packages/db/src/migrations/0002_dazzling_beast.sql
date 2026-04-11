CREATE TABLE "dashboard_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"days" integer NOT NULL,
	"stats" jsonb NOT NULL,
	"gcs_history" jsonb NOT NULL,
	"word_cloud" jsonb NOT NULL,
	"staff_bubbles" jsonb NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_fingerprints" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_members" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"user_id" text,
	"invited_email" text NOT NULL,
	"display_name" text,
	"role" text DEFAULT 'staff' NOT NULL,
	"permissions" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invite_token" text NOT NULL,
	"invite_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	CONSTRAINT "property_members_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "online_reviews_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"source" text NOT NULL,
	"avg_rating" numeric(3, 1),
	"review_count" integer DEFAULT 0 NOT NULL,
	"pillar_resilience" numeric(4, 2),
	"pillar_empathy" numeric(4, 2),
	"pillar_anticipation" numeric(4, 2),
	"pillar_recognition" numeric(4, 2),
	"last_scraped_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_cache" (
	"city" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text NOT NULL,
	"property_id" text NOT NULL,
	"email_verification_token" text,
	"email_verification_token_expires_at" timestamp,
	"email_verified_at" timestamp,
	"activated_at" timestamp,
	"stripe_payment_intent_id" text,
	"removed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_property_email_unique" UNIQUE("property_id","email"),
	CONSTRAINT "staff_profiles_verification_token_unique" UNIQUE("email_verification_token")
);
--> statement-breakpoint
CREATE TABLE "staff_commendations" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_profile_id" text NOT NULL,
	"property_id" text NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "organisations" ALTER COLUMN "plan" SET DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "guest_email" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "is_uniform_score" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "seen_by_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "staff_profile_id" text;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "postcode" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "admin_notes" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "is_vip" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "payment_status" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "tripadvisor_url" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "google_place_id" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "review_prompt_threshold" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "review_prompt_platforms" text DEFAULT 'google,tripadvisor' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "staff_invite_token" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "business_email" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "business_email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "business_email_token" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "business_email_token_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "business_website" text;--> statement-breakpoint
ALTER TABLE "dashboard_cache" ADD CONSTRAINT "dashboard_cache_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_fingerprints" ADD CONSTRAINT "feedback_fingerprints_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_members" ADD CONSTRAINT "property_members_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_members" ADD CONSTRAINT "property_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_reviews_cache" ADD CONSTRAINT "online_reviews_cache_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_commendations" ADD CONSTRAINT "staff_commendations_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_commendations" ADD CONSTRAINT "staff_commendations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_cache_propertyId_idx" ON "dashboard_cache" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "feedback_fingerprints_property_fingerprint_idx" ON "feedback_fingerprints" USING btree ("property_id","fingerprint");--> statement-breakpoint
CREATE INDEX "property_members_propertyId_idx" ON "property_members" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_members_userId_idx" ON "property_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "online_reviews_cache_property_source_idx" ON "online_reviews_cache" USING btree ("property_id","source");--> statement-breakpoint
CREATE INDEX "staff_profiles_property_id_idx" ON "staff_profiles" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "staff_commendations_staff_profile_id_idx" ON "staff_commendations" USING btree ("staff_profile_id");--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_propertyId_submittedAt_idx" ON "feedback" USING btree ("property_id","submitted_at");--> statement-breakpoint
CREATE INDEX "feedback_submittedAt_idx" ON "feedback" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "feedback_gcs_idx" ON "feedback" USING btree ("gcs");--> statement-breakpoint
CREATE INDEX "feedback_propertyId_seen_idx" ON "feedback" USING btree ("property_id","seen_by_owner");--> statement-breakpoint
CREATE INDEX "properties_organisationId_idx" ON "properties" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "properties_city_idx" ON "properties" USING btree ("city");--> statement-breakpoint
CREATE INDEX "properties_status_idx" ON "properties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "properties_city_status_idx" ON "properties" USING btree ("city","status");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_staff_invite_token_unique" UNIQUE("staff_invite_token");