-- src/database/migrations/0005_employees.sql

CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_number" varchar(50) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"department_id" uuid,
	"position" varchar(255),
	"employment_type" varchar(50) DEFAULT 'full_time' NOT NULL,
	"base_salary_encrypted" varchar(500) NOT NULL,
	"salary_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"hire_date" date NOT NULL,
	"termination_date" date,
	"timezone" varchar(100),
	"locale" varchar(10),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"bank_account_encrypted" varchar(500),
	"tax_id_encrypted" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"base_salary_encrypted" varchar(500) NOT NULL,
	"salary_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"effective_date" date NOT NULL,
	"change_reason" varchar(100) NOT NULL,
	"notes" text,
	"changed_by" uuid NOT NULL,
	"created_at" date DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_employees_tenant_user_unique" ON "employees" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_employees_tenant_number_unique" ON "employees" USING btree ("tenant_id","employee_number");--> statement-breakpoint
CREATE INDEX "idx_employees_tenant_status" ON "employees" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_employees_tenant_department" ON "employees" USING btree ("tenant_id","department_id");--> statement-breakpoint
CREATE INDEX "idx_employees_user_tenant" ON "employees" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "idx_salary_history_employee" ON "salary_history" USING btree ("tenant_id","employee_id","effective_date");--> statement-breakpoint
CREATE INDEX "idx_salary_history_tenant_date" ON "salary_history" USING btree ("tenant_id","effective_date");
