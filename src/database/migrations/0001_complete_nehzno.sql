CREATE TABLE "outbox_processed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"handler_name" varchar(200) NOT NULL,
	"event_type" varchar(200),
	"tenant_id" uuid,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_processed_event_handler_unique" ON "outbox_processed_events" USING btree ("event_id","handler_name");--> statement-breakpoint
CREATE INDEX "idx_processed_event_id" ON "outbox_processed_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_processed_at" ON "outbox_processed_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "idx_processed_tenant_processed_at" ON "outbox_processed_events" USING btree ("tenant_id","processed_at");