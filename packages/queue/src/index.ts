import { Queue, type JobsOptions, type QueueOptions } from 'bullmq';
import IORedis, { type RedisOptions } from 'ioredis';

export type QueueConnectionOptions = Pick<RedisOptions, 'host' | 'port' | 'password'>;

export const createRedisConnection = (options: QueueConnectionOptions) => {
  return new IORedis({
    ...options,
    maxRetriesPerRequest: null,
  });
};

export const createQueue = <TData = unknown>(
  name: string,
  connectionOptions: QueueConnectionOptions,
  defaultJobOptions?: JobsOptions,
) => {
  const connection = createRedisConnection(connectionOptions);
  const queueOptions: QueueOptions = {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
      ...defaultJobOptions,
    },
  };

  return new Queue<TData>(name, queueOptions);
};
