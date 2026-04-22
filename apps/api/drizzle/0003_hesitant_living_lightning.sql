CREATE TYPE "public"."api_key_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "api_key_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" text NOT NULL,
	"website" text,
	"email" text NOT NULL,
	"use_case" text NOT NULL,
	"status" "api_key_request_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"api_key_id" uuid,
	"requester_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_key_requests" ADD CONSTRAINT "api_key_requests_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_requests_status_idx" ON "api_key_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "api_key_requests_email_idx" ON "api_key_requests" USING btree ("email");