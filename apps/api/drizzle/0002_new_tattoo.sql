CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" text NOT NULL,
	"label" text,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"rate_limit_per_hour" text DEFAULT '1000' NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE INDEX "api_keys_owner_idx" ON "api_keys" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "api_keys_revoked_idx" ON "api_keys" USING btree ("revoked");