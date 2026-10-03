// Must stay identical to src/utils/enums/NotificationChannel.enum.ts in notification-service:
// these are the values that travel inside the queue payload.
export enum NotificationChannel {
    EMAIL = 'EMAIL',
    WHATSAPP = 'WHATSAPP'
}
