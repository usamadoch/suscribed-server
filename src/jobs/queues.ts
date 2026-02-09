import { Queue, Worker, Job } from 'bullmq';
import config from '../config/index.js';
import { logger } from '../config/logger.js';

// Queue names
export const QUEUE_NAMES = {
    NOTIFICATIONS: 'notifications',
    ANALYTICS: 'analytics',
} as const;

// Job types
export interface NotificationJobData {
    type: 'new_member' | 'new_comment' | 'new_message' | 'post_liked' | 'new_post';
    recipientId: string;
    title: string;
    body: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Record<string, unknown>;
}

export interface AnalyticsJobData {
    type: 'aggregate_daily' | 'aggregate_weekly' | 'update_post_stats';
    data: Record<string, unknown>;
}

// Queue instances
let notificationQueue: Queue<NotificationJobData> | null = null;
let analyticsQueue: Queue<AnalyticsJobData> | null = null;

// Get Redis connection options for BullMQ
const getRedisConnection = () => {
    if (!config.redis.ioRedisUrl) {
        return undefined;
    }
    // BullMQ can accept a connection URL string directly
    return config.redis.ioRedisUrl;
};

// Initialize queues
export const initializeQueues = (): void => {
    if (!config.features.useBackgroundJobs) {
        logger.info('Background jobs disabled, skipping queue initialization');
        return;
    }

    const connection = getRedisConnection();
    if (!connection) {
        logger.warn('No Redis URL configured, background jobs will not run');
        return;
    }

    notificationQueue = new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS, {
        connection: { url: connection },
        defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
        },
    });

    analyticsQueue = new Queue<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS, {
        connection: { url: connection },
        defaultJobOptions: {
            removeOnComplete: 50,
            removeOnFail: 10,
            attempts: 2,
        },
    });

    logger.info('BullMQ queues initialized');
};

// Get queue instances
export const getNotificationQueue = (): Queue<NotificationJobData> | null => notificationQueue;
export const getAnalyticsQueue = (): Queue<AnalyticsJobData> | null => analyticsQueue;

// Add notification job
export const addNotificationJob = async (data: NotificationJobData): Promise<Job<NotificationJobData> | null> => {
    if (!notificationQueue) {
        // Fallback: process synchronously if queues not available
        logger.debug('Queue not available, notification will be created synchronously');
        return null;
    }

    return notificationQueue.add(`notification:${data.type}`, data);
};

// Add analytics job
export const addAnalyticsJob = async (data: AnalyticsJobData): Promise<Job<AnalyticsJobData> | null> => {
    if (!analyticsQueue) {
        return null;
    }

    return analyticsQueue.add(`analytics:${data.type}`, data);
};

// Close queues gracefully
export const closeQueues = async (): Promise<void> => {
    const closePromises: Promise<void>[] = [];

    if (notificationQueue) {
        closePromises.push(notificationQueue.close());
    }
    if (analyticsQueue) {
        closePromises.push(analyticsQueue.close());
    }

    await Promise.all(closePromises);
    logger.info('BullMQ queues closed');
};

export { Queue, Worker, Job };
