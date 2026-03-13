// src/common/common.module.ts

import { Module, Global } from '@nestjs/common';
import { EncryptionService } from './utils/encryption.util';

/**
 * CommonModule registers all shared services as global providers.
 * Services that require DI (like EncryptionService which depends on ConfigService)
 * are registered here.
 *
 * Pure utility classes (Money, DateUtil, HashUtil, PaginationHelper)
 * are used as static imports, not DI providers.
 */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class CommonModule {}
