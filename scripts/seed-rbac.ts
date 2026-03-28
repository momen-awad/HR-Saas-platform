// scripts/seed-rbac.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RoleService } from '../src/modules/rbac/services/role.service';
import { TenantContext } from '../src/common/context/tenant.context';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const roleService = app.get(RoleService);

  // Replace with your test tenant ID
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('Usage: npx ts-node scripts/seed-rbac.ts <tenant-id>');
    process.exit(1);
  }

  console.log(`Seeding RBAC for tenant: ${tenantId}`);

  // Seed within tenant context
  await TenantContext.run({ tenantId }, async () => {
    await roleService.seedSystemRolesForTenant(tenantId);
  });

  console.log('✅ RBAC seeding complete');
  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});