import { ConnectionOptions } from 'bullmq';

import { redisConfig } from './server.config';

/**
 * Shared BullMQ connection options. Import this wherever a Queue (or Worker) is created.
 *
 * Plain options are used (not an ioredis instance) so BullMQ creates and owns its connections.
 * BullMQ 6 loads the app's own `ioredis` package as an optional peer, so `ioredis` must stay in
 * package.json even though nothing imports it directly.
 */
export const bullMqConnection: ConnectionOptions = {
    host: redisConfig.REDIS_HOST,
    port: redisConfig.REDIS_PORT,
    password: redisConfig.REDIS_PASSWORD,
    db: redisConfig.REDIS_DB,
    ...(redisConfig.REDIS_TLS ? { tls: {} } : {}),
    // Producer inside an HTTP request: fail fast when Redis is down instead of buffering commands.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: (times: number) => Math.min(times * 500, 5000)
};
