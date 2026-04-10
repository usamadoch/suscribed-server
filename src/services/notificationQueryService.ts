import { notificationRepository } from '../repositories/notificationRepository.js';
import { createError } from '../middleware/errorHandler.js';
import { Types } from 'mongoose';

interface GetNotificationsOptions {
    page: number;
    limit: number;
    unreadOnly: boolean;
}

export const notificationQueryService = {
    async getNotifications(userId: Types.ObjectId, options: GetNotificationsOptions) {
        const { page, limit, unreadOnly } = options;
        const query: Record<string, any> = { recipientId: userId };

        if (unreadOnly) {
            query.isRead = false;
        }

        const [notifications, total, unreadCount] = await Promise.all([
            notificationRepository.find(query, { createdAt: -1 }, (page - 1) * limit, limit),
            notificationRepository.countDocuments(query),
            notificationRepository.countDocuments({ recipientId: userId, isRead: false }),
        ]);

        return {
            notifications,
            unreadCount,
            pagination: {
                page,
                limit,
                totalItems: total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        };
    },

    async getUnreadCount(userId: Types.ObjectId) {
        const count = await notificationRepository.countDocuments({
            recipientId: userId,
            isRead: false,
        });
        return count;
    },

    async markAsRead(notificationId: string, userId: Types.ObjectId) {
        const notification = await notificationRepository.findOneAndUpdate(
            { _id: notificationId, recipientId: userId },
            { isRead: true, readAt: new Date() }
        );

        if (!notification) {
            throw createError.notFound('Notification');
        }

        return notification;
    },

    async markAllAsRead(userId: Types.ObjectId) {
        await notificationRepository.updateMany(
            { recipientId: userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );
    },

    async deleteNotification(notificationId: string, userId: Types.ObjectId) {
        const notification = await notificationRepository.findOneAndDelete({
            _id: notificationId,
            recipientId: userId,
        });

        if (!notification) {
            throw createError.notFound('Notification');
        }

        return notification;
    }
};
