-- src/database/migrations/0004_departments.sql

CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_id" uuid,
	"manager_employee_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_departments_tenant_name_unique" ON "departments" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "idx_departments_tenant" ON "departments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_departments_parent" ON "departments" USING btree ("tenant_id","parent_id");--> statement-breakpoint
CREATE INDEX "idx_departments_manager" ON "departments" USING btree ("tenant_id","manager_employee_id");
