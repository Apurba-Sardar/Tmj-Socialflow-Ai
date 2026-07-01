import { PrismaClient } from '@prisma/client';

export const createPrismaClient = () => {
  return new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });
};

export type SocialFlowPrismaClient = ReturnType<typeof createPrismaClient>;
