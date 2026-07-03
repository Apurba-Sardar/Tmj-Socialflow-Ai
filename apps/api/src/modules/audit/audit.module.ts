import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditInterceptor } from './audit.interceptor.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuditModule {}
