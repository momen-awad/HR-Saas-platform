import { uuid, timestamp, varchar, boolean } from 'drizzle-orm/pg-core';

export const primaryId = {
  id: uuid('id').primaryKey().defaultRandom(),
};

export const tenantId = {
  tenantId: uuid('tenant_id').notNull(),
};

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export function statusColumn(defaultValue: string = 'active') {
  return {
    status: varchar('status', { length: 50 }).notNull().default(defaultValue),
  };
}

export const activeFlag = {
  isActive: boolean('is_active').notNull().default(true),
};
