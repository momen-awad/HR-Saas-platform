CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"module" varchar(50) NOT NULL,
	"category" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"slug" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "employee_roles" (
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid,
	CONSTRAINT "employee_roles_employee_id_role_id_pk" PRIMARY KEY("employee_id","role_id")
);
--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
DROP TABLE "refresh_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "password_reset_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_permissions_code_unique" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_permissions_module" ON "permissions" USING btree ("module");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roles_tenant_slug_unique" ON "roles" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roles_tenant_name_unique" ON "roles" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "idx_roles_tenant" ON "roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_role" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_permission" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "idx_employee_roles_employee" ON "employee_roles" USING btree ("tenant_id","employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_roles_role" ON "employee_roles" USING btree ("tenant_id","role_id");