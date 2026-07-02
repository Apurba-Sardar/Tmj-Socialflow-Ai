import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { WordPressModule } from './wordpress/wordpress.module.js';

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, WordPressModule, SupabaseModule],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
