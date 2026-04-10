import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { notificationQueryService } from '../services/notificationQueryService.js';

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

        const result = await notificationQueryService.getNotifications(req.user._id, { page, limit, unreadOnly });

        res.json({
            success: true,
            data: { notifications: result.notifications, unreadCount: result.unreadCount },
            meta: { pagination: result.pagination },
        });
    } catch (error) {
        next(error);
    }
};

// Get unread count
export const getUnreadCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const count = await notificationQueryService.getUnreadCount(req.user._id);
        res.json({ success: true, data: { count } });
    } catch (error) {
        next(error);
    }
};

// Mark as read
export const markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const notification = await notificationQueryService.markAsRead(String(req.params.id), req.user._id);
        res.json({ success: true, data: { notification } });
    } catch (error) {
        next(error);
    }
};

// Mark all as read
export const markAllAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        await notificationQueryService.markAllAsRead(req.user._id);
        res.json({ success: true, data: { message: 'All notifications marked as read' } });
    } catch (error) {
        next(error);
    }
};

// Delete notification
export const deleteNotification = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        await notificationQueryService.deleteNotification(String(req.params.id), req.user._id);
        res.json({ success: true, data: { message: 'Notification deleted' } });
    } catch (error) {
        next(error);
    }
};
