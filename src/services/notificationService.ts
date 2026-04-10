import { userRepository } from '../repositories/userRepository.js';
import { notificationRepository } from '../repositories/notificationRepository.js';
import { NotificationType, NotificationPreferences, NewMessageMetadata, NotificationMetadata } from '../types/index.js';
import { Server } from 'socket.io';
import { logger } from '../config/logger.js';
import { INotificationDocument } from '../models/Notification.js';

interface SendNotificationOptions {
    actionUrl: string;
    actionLabel?: string;
    imageUrl?: string | null;
    metadata?: NotificationMetadata;
    io?: Server;
}

export class NotificationService {
    /**
     * Maps notification types to user preference keys
     */
    private static getPreferenceKey(type: NotificationType): string | null {
        switch (type) {
            case 'new_member': return 'newMembers';
            case 'new_post': return 'newPosts';
            case 'new_comment':
            case 'comment_reply': return 'newComments';
            case 'new_message': return 'newMessages';
            case 'mention': return 'mentions';
            // 'post_liked', 'member_left', 'creator_went_live', 'system' don't have direct mappings in current User model
            // We'll return null to imply "always allow" (or subject to global switch)
            default: return null;
        }
    }

    /**
     * Checks if a user has enabled a specific notification type
     */
    private static isNotificationEnabled(prefs: NotificationPreferences | undefined, type: NotificationType): boolean {
        if (!prefs) return true; // Default to true if no prefs

        // Check global in-app switch
        if (prefs.inApp?.all === false) return false;

        const key = this.getPreferenceKey(type);
        if (!key) return true; // No specific setting, so allow it

        // Check push/in-app specific setting
        // We use 'push' object as the source of truth for "generation" based on user request/context
        // Explicitly cast safe access since we know the key structure matches
        const pushPrefs = prefs.push as Record<string, boolean>;
        if (pushPrefs && typeof pushPrefs[key] === 'boolean') {
            return pushPrefs[key];
        }

        return true;
    }

    /**
     * Send a single notification
     */
    static async sendNotification(
        recipientId: string,
        type: NotificationType,
        title: string,
        body: string,
        options: SendNotificationOptions
    ) {
        try {
            const user = await userRepository.findById(recipientId, 'notificationPreferences');
            if (!user) {
                logger.warn(`Notification recipient not found: ${recipientId}`);
                return null;
            }

            if (!this.isNotificationEnabled(user.notificationPreferences, type)) {
                logger.debug(`Notification suppressed by user preferences`, { recipientId, type });
                return null;
            }

            // [Modified] Check for existing unread notification to aggregate
            if (type === 'new_message' && options.metadata?.conversationId) {
                const existingNotification = await notificationRepository.findOne({
                    recipientId,
                    type: 'new_message',
                    isRead: false,
                    'metadata.conversationId': options.metadata.conversationId
                }) as INotificationDocument;

                if (existingNotification) {
                    // Type guard/assertion for strict metadata usage
                    const metadata = existingNotification.metadata as unknown as NewMessageMetadata;
                    const currentCount = metadata.messageCount || 1;
                    const newCount = currentCount + 1;

                    // Use a generic summary message
                    existingNotification.body = `${newCount} new messages`;

                    // Explicitly update metadata with typed object
                    const newMetadata: NewMessageMetadata = {
                        ...(existingNotification.metadata as Record<string, unknown>),
                        conversationId: metadata.conversationId,
                        messageCount: newCount
                    };

                    existingNotification.metadata = newMetadata;
                    await existingNotification.save();

                    // Emit socket update
                    if (options.io) {
                        options.io.to(`user:${recipientId}`).emit('notification', existingNotification);
                    }
                    return existingNotification;
                }
            }

            // Create notification in DB
            const metadata = options.metadata || {};
            if (type === 'new_message') {
                metadata.messageCount = 1;
            }

            const notification = await notificationRepository.create({
                recipientId,
                type,
                title,
                body,
                actionUrl: options.actionUrl,
                actionLabel: options.actionLabel || 'View',
                imageUrl: options.imageUrl || null,
                metadata: metadata,
                isRead: false,
            });

            // Emit socket event if io is provided
            if (options.io) {
                options.io.to(`user:${recipientId}`).emit('notification', notification);
            }

            return notification;
        } catch (error) {
            logger.error('Error sending notification', { recipientId, type, error });
            throw error;
        }
    }

    /**
     * Send notification to multiple recipients (efficiently)
     */
    static async sendMassNotification(
        recipientIds: string[],
        type: NotificationType,
        title: string,
        body: string,
        options: SendNotificationOptions
    ) {
        if (recipientIds.length === 0) return [];

        try {
            // Fetch all users to check preferences
            const users = await userRepository.find({
                _id: { $in: recipientIds }
            }, '_id notificationPreferences');

            const eligibleRecipients = users.filter((user: any) =>
                this.isNotificationEnabled(user.notificationPreferences, type)
            );

            if (eligibleRecipients.length === 0) return [];

            const notificationsData = eligibleRecipients.map((user: any) => ({
                recipientId: user._id,
                type,
                title,
                body,
                actionUrl: options.actionUrl,
                actionLabel: options.actionLabel || 'View',
                imageUrl: options.imageUrl || null,
                metadata: options.metadata || {},
                isRead: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            // Bulk insert
            const notifications = await notificationRepository.insertMany(notificationsData);

            // Bulk emit
            if (options.io) {
                notifications.forEach((notification: any) => {
                    options.io!.to(`user:${notification.recipientId}`).emit('notification', notification);
                });
            }

            return notifications;
        } catch (error) {
            logger.error('Error sending mass notification', { type, count: recipientIds.length, error });
            throw error;
        }
    }
}
