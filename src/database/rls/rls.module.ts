// rls.module.ts
import { Module, Global } from '@nestjs/common';
import { RlsService } from './rls.service';
import { DatabaseModule } from '../database.module';

@Global()
@Module({
  imports: [DatabaseModule],  // ✅ مهم جدًا
  providers: [RlsService],
  exports: [],
})
export class RlsModule {}
