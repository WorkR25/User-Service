import logger from '../configs/logger.config';
import { notificationConfig } from '../configs/server.config';
import { enqueueLeadNurture } from '../producers/leadNurture.producer';
import { LeadNurturePayload, WorkrSignupInput } from '../types/LeadNurturePayload';
import { NotificationChannel } from '../utils/enums/NotificationChannel.enum';
import { buildReadinessLink, isWorkingProfessional, toE164Phone } from '../utils/helpers/leadNurture.helper';

// Product company readiness check: email + WhatsApp sent after a Working Professional signs up on WorkR.
const READINESS_CHECK_STEP = 'PRODUCT_COMPANY_READINESS';
const READINESS_CHECK_SUBJECT = 'Why are you applying but still not getting interview calls?';
const READINESS_CHECK_TEMPLATE_KEYS: Record<NotificationChannel, string> = {
    [NotificationChannel.EMAIL]: 'ProblemDiagnosisWorkr',
    [NotificationChannel.WHATSAPP]: 'ProblemDiagnosisWorkr'
};

class LeadNurtureService {
    /**
     * Called after a WorkR signup has been committed. Enqueues the product company readiness check email + WhatsApp only for
     * Working Professionals. Never throws.
     */
    async handleWorkrSignup(input: WorkrSignupInput): Promise<void> {
        try {
            if (!notificationConfig.NOTIFICATIONS_ENABLED) {
                logger.info('Lead nurture skipped: NOTIFICATIONS_ENABLED is not true', { userId: input.userId });
                return;
            }

            if (!isWorkingProfessional(input.details)) {
                logger.info('Lead nurture skipped: not a working professional', { userId: input.userId, details: input.details ?? null });
                return;
            }

            const candidatePhone = toE164Phone(input.phoneNo);
            // WhatsApp needs a usable number; without one the email still goes out.
            const channels = candidatePhone
                ? [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP]
                : [NotificationChannel.EMAIL];

            const payload: LeadNurturePayload = {
                userId: input.userId,
                candidateName: input.fullName.trim(),
                candidateEmail: input.email,
                candidatePhone: candidatePhone ?? '',
                readinessLink: buildReadinessLink(READINESS_CHECK_STEP),
                subject: READINESS_CHECK_SUBJECT,
                channels,
                templateKeys: READINESS_CHECK_TEMPLATE_KEYS,
                details: input.details as string,
                domain: input.domain ?? null,
                graduationYear: input.graduationYear ?? null,
                signedUpAt: (input.signedUpAt ?? new Date()).toISOString()
            };

            await enqueueLeadNurture(payload, `workr-readiness-check-${input.userId}`);
        } catch (error) {
            logger.error('Lead nurture handling failed', {
                userId: input.userId,
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

export default new LeadNurtureService();
