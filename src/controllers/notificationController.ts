import { Request, Response, NextFunction } from 'express';

import { AuthenticatedRequest } from '../types/index.js';
import Notification from '../models/Notification.js';

interface GetNotificationsQuery {
    page?: string;
    limit?: string;
    unreadOnly?: string;
}

// Get notifications
export const getNotifications = async (req: AuthenticatedRequest & Request<any, any, any, GetNotificationsQuery>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        const unreadOnly = req.query.unreadOnly === 'true';
        const userId = req.user._id;

        const query: Record<string, any> = { recipientId: userId };

        if (unreadOnly) {
            query.isRead = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ recipientId: userId, isRead: false });

        res.json({
            success: true,
            data: { notifications, unreadCount },
            meta: {
                pagination: {
                    page,
                    limit,
                    totalItems: total,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: page * limit < total,
                    hasPrevPage: page > 1,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get unread count
export const getUnreadCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const count = await Notification.countDocuments({
            recipientId: req.user._id,
            isRead: false,
        });

        res.json({
            success: true,
            data: { count },
        });
    } catch (error) {
        next(error);
    }
};

// Mark as read
export const markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipientId: req.user._id },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Notification not found' },
            });
            return;
        }

        res.json({
            success: true,
            data: { notification },
        });
    } catch (error) {
        next(error);
    }
};

// Mark all as read
export const markAllAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        await Notification.updateMany(
            { recipientId: req.user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.json({
            success: true,
            data: { message: 'All notifications marked as read' },
        });
    } catch (error) {
        next(error);
    }
};

// Delete notification
export const deleteNotification = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            recipientId: req.user._id,
        });

        if (!notification) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Notification not found' },
            });
            return;
        }

        res.json({
            success: true,
            data: { message: 'Notification deleted' },
        });
    } catch (error) {
        next(error);
    }
};
