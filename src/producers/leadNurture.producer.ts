import logger from '../configs/logger.config';
import { notificationConfig } from '../configs/server.config';
import { getLeadNurtureQueue } from '../queues/leadNurture.queue';
import { LeadNurturePayload } from '../types/LeadNurturePayload';
import { withTimeout } from '../utils/helpers/promise.helper';

/**
 * Adds one lead-nurture job. Never throws: a notification problem must not break signup.
 * `jobId` makes the add idempotent (a repeated add with the same id is ignored by BullMQ),
 * so a retry or a late completion after a timeout cannot produce a second email.
 *
 * @returns true when the job is in the queue, false when it could not be enqueued
 */
export const enqueueLeadNurture = async (payload: LeadNurturePayload, jobId: string): Promise<boolean> => {
    try {
        const job = await withTimeout(
            getLeadNurtureQueue().add(notificationConfig.LEAD_NURTURE_JOB_NAME, payload, { jobId }),
            notificationConfig.ENQUEUE_TIMEOUT_MS,
            'Lead nurture enqueue'
        );
        logger.info('Lead nurture job enqueued', { jobId, queueJobId: job.id, userId: payload.userId, channels: payload.channels });
        return true;
    } catch (error) {
        // userId/jobId are enough to replay this lead later; no PII in the log line.
        logger.error('Failed to enqueue lead nurture job', {
            jobId,
            userId: payload.userId,
            message: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
};
