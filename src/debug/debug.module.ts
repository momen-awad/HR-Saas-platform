import { Module } from '@nestjs/common';
import { TenantDebugController } from './tenant-debug.controller';

@Module({
  controllers: [TenantDebugController],
})
export class DebugModule {}
