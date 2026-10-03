import { Queue } from 'bullmq';

import { bullMqConnection } from '../configs/bullMq.config';
import logger from '../configs/logger.config';
import { notificationConfig } from '../configs/server.config';
import { LeadNurturePayload } from '../types/LeadNurturePayload';

let queue: Queue<LeadNurturePayload> | null = null;

/**
 * Lazily creates the producer-side queue (one per process, shared by all requests).
 *
 * Connection options come from configs/bullMq.config.ts.
 */
export const getLeadNurtureQueue = (): Queue<LeadNurturePayload> => {
    if (queue) {
        return queue;
    }

    queue = new Queue<LeadNurturePayload>(notificationConfig.LEAD_NURTURE_QUEUE_NAME, {
        connection: bullMqConnection,
        defaultJobOptions: {
            // Same retry policy as notification-service's own queues (5 attempts, 30s exponential back-off).
            attempts: 5,
            backoff: { type: 'exponential', delay: 30 * 1000 },
            // Delete the job from Redis as soon as the consumer finishes it successfully.
            removeOnComplete: true,
            // Keep failed jobs for 1 day so they can be inspected or retried (Bull Board), then purge.
            removeOnFail: { age: 24 * 3600, count: 5000 }
        }
    });

    // Without a listener an 'error' event (e.g. ECONNREFUSED) would crash the process.
    queue.on('error', (error) => {
        logger.error('Lead nurture queue error', { message: error.message });
    });

    return queue;
};
