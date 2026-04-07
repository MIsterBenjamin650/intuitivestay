CREATE TABLE "ai_daily_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"date" date NOT NULL,
	"narrative" text NOT NULL,
	"focus_points" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_daily_summaries_property_id_date_unique" UNIQUE("property_id","date")
);
--> statement-breakpoint
CREATE TABLE "property_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"current_tier" text DEFAULT 'member' NOT NULL,
	"pending_tier" text,
	"pending_direction" text,
	"pending_from" date,
	"last_evaluated_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "property_tiers_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "adjectives" text;--> statement-breakpoint
ALTER TABLE "ai_daily_summaries" ADD CONSTRAINT "ai_daily_summaries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_tiers" ADD CONSTRAINT "property_tiers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;