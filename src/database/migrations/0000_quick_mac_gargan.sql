CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"plan_type" varchar(50) DEFAULT 'free' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"default_locale" varchar(10) DEFAULT 'en' NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"max_employees" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(200) NOT NULL,
	"event_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"tenant_id" uuid,
	"triggered_by" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 5 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"processing_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_tenants_status" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tenants_slug" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_outbox_pending" ON "event_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_processed_cleanup" ON "event_outbox" USING btree ("status","processed_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_event_id" ON "event_outbox" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_outbox_tenant" ON "event_outbox" USING btree ("tenant_id","created_at");