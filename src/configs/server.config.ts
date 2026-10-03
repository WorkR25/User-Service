import dotenv from 'dotenv';

type ServerConfig = {
    PORT: number
    SALT :number
    JWT_SECRET : string
    JWT_EXPRIRES_IN : string
}

type AwsConfig = {
    AWS_REGION: string
    AWS_SECRET_ACCESS_KEY: string
    AWS_ACCESS_KEY_ID: string
    AWS_S3_BUCKET_NAME: string
}

type DBConfig = {
    DB_HOST: string
    DB_USER: string
    DB_PASSWORD: string
    DB_NAME: string
}

type FrontendConfig= {
    FRONTEND_URL: string
}

dotenv.config();

export const serverConfig: ServerConfig =  {
    PORT: Number(process.env.PORT) || 3000,
    SALT : Number(process.env.SALT),
    JWT_SECRET : String(process.env.JWT_SECRET),
    JWT_EXPRIRES_IN : String(process.env.JWT_EXPRIRES_IN)
};

export const dbConfig: DBConfig = {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || 'root',
    DB_NAME: process.env.DB_NAME || 'test_db'
};

export const awsConfig: AwsConfig = {
    AWS_REGION: String(process.env.AWS_REGION),
    AWS_ACCESS_KEY_ID: String(process.env.AWS_ACCESS_KEY_ID),
    AWS_SECRET_ACCESS_KEY: String(process.env.AWS_SECRET_ACCESS_KEY),
    AWS_S3_BUCKET_NAME: String(process.env.AWS_S3_BUCKET_NAME)
};

export const frontendConfig: FrontendConfig = {
    FRONTEND_URL: String(process.env.FRONTEND_URL)
};

type RedisConfig = {
    REDIS_HOST: string
    REDIS_PORT: number
    REDIS_PASSWORD: string | undefined
    REDIS_DB: number
    REDIS_TLS: boolean
}

type NotificationConfig = {
    NOTIFICATIONS_ENABLED: boolean
    LEAD_NURTURE_QUEUE_NAME: string
    LEAD_NURTURE_JOB_NAME: string
    READINESS_LINK_BASE_URL: string
    ENQUEUE_TIMEOUT_MS: number
}

export const redisConfig: RedisConfig = {
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
    REDIS_DB: Number(process.env.REDIS_DB) || 0,
    REDIS_TLS: process.env.REDIS_TLS === 'true'
};

export const notificationConfig: NotificationConfig = {
    // Master switch: when false nothing is ever enqueued (local dev, tests, rollback).
    NOTIFICATIONS_ENABLED: process.env.NOTIFICATIONS_ENABLED === 'true',
    LEAD_NURTURE_QUEUE_NAME: process.env.LEAD_NURTURE_QUEUE_NAME || 'workr-signup-notification-queue',
    LEAD_NURTURE_JOB_NAME: process.env.LEAD_NURTURE_JOB_NAME || 'payload:workr-signup-notification',
    READINESS_LINK_BASE_URL: process.env.READINESS_LINK_BASE_URL || 'https://ai-proof-engineering-readiness-chec.vercel.app/',
    // How long the background enqueue may wait for Redis before it is logged as failed (signup never waits for it).
    ENQUEUE_TIMEOUT_MS: Number(process.env.ENQUEUE_TIMEOUT_MS) || 5000
};
