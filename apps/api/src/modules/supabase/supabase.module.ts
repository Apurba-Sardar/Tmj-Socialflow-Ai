import { Module } from '@nestjs/common';

import { SupabaseController } from './supabase.controller.js';
import { SupabaseService } from './supabase.service.js';

@Module({
  controllers: [SupabaseController],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
// NestJS module classes are declarative containers.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SupabaseModule {}
