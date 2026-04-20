CREATE TYPE "public"."event_level" AS ENUM('junior', 'mid', 'senior', 'all');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('meetup', 'eventbrite', 'gdg', 'community');--> statement-breakpoint
CREATE TYPE "public"."user_event_type" AS ENUM('favorite', 'rsvp');--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"country" text NOT NULL,
	"city" text NOT NULL,
	"source" "event_source" NOT NULL,
	"url" text NOT NULL,
	"link" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"level" "event_level" DEFAULT 'all' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"trending" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_source_url_unique" UNIQUE("source","url")
);
--> statement-breakpoint
CREATE TABLE "user_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"type" "user_event_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_events_user_event_type_unique" UNIQUE("user_id","event_id","type")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_sub" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "events_country_city_idx" ON "events" USING btree ("country","city");--> statement-breakpoint
CREATE INDEX "user_events_user_idx" ON "user_events" USING btree ("user_id");