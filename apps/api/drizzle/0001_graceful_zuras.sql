CREATE TYPE "public"."summary_source" AS ENUM('ai', 'heuristic');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "summary_source" "summary_source" DEFAULT 'heuristic' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "content_hash" text;