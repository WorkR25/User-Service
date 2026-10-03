import { NotificationChannel } from '../utils/enums/NotificationChannel.enum';

/**
 * Job payload for notification-service's `workr-signup-notification-queue`.
 * Field names follow the other notification-service payloads (candidateName, candidateEmail,
 * candidatePhone, subject, channels, templateKeys) so the consumer can treat them alike.
 */
export type LeadNurturePayload = {
    /** WorkR user id (the consumer derives its idempotency key from it) */
    userId: number
    candidateName: string
    candidateEmail: string
    /** E.164 (+91XXXXXXXXXX); empty string when the number is not a valid 10-digit Indian mobile */
    candidatePhone: string
    readinessLink: string
    subject: string
    channels: NotificationChannel[]
    /** Template per channel. Keys follow the handbook naming: EMAIL_IC_[STAGE]_[NUMBER]_[PURPOSE] / WA_IC_... */
    templateKeys: Record<NotificationChannel, string>
    details: string
    domain: string | null
    graduationYear: string | null
    signedUpAt: string
};

export type WorkrSignupInput = {
    userId: number
    fullName: string
    email: string
    phoneNo: string
    details?: string | null
    domain?: string | null
    graduationYear?: string | null
    signedUpAt?: Date
};
