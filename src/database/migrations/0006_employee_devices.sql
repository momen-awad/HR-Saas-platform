-- src/database/migrations/0006_employee_devices.sql

CREATE TABLE "employee_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"device_name" varchar(255),
	"device_os" varchar(50),
	"fcm_token" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_employee_devices_tenant_employee_device_unique"
  ON "employee_devices" USING btree ("tenant_id","employee_id","device_id");--> statement-breakpoint
CREATE INDEX "idx_employee_devices_employee"
  ON "employee_devices" USING btree ("tenant_id","employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_devices_device_lookup"
  ON "employee_devices" USING btree ("tenant_id","device_id");
