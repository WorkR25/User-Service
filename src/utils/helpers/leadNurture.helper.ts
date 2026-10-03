import { notificationConfig } from '../../configs/server.config';

/**
 * Only 'Working Professional' signups enter the WorkR nurture. Anything else
 * (Student, missing, unexpected value) is excluded, i.e. this fails closed.
 */
export const isWorkingProfessional = (details?: string | null): boolean => {
    return typeof details === 'string' && details.trim().toLowerCase() === 'working professional';
};

/** 10-digit Indian mobile -> +91XXXXXXXXXX, anything else -> null */
export const toE164Phone = (phoneNo: string): string | null => {
    const digits = phoneNo.replace(/\D/g, '');
    return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
};

export const buildReadinessLink = (step: string): string => {
    const url = new URL(notificationConfig.READINESS_LINK_BASE_URL);
    url.searchParams.set('utm_source', 'workr');
    url.searchParams.set('utm_medium', 'email');
    url.searchParams.set('utm_campaign', 'workr_nurture');
    url.searchParams.set('utm_content', step.toLowerCase());
    return url.toString();
};
