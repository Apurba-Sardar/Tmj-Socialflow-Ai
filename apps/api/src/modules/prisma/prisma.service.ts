import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.connected = true;
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown Prisma connection error.';
      this.logger.warn(`Prisma database connection skipped for local startup: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) {
      await this.$disconnect();
    }
  }
}
