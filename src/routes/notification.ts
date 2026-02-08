import { Router, RequestHandler } from 'express';
import { protect } from '../middleware/auth.js';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from '../controllers/notificationController.js';

const router = Router();

// Get notifications
router.get('/', protect, getNotifications as RequestHandler);

// Get unread count
router.get('/unread-count', protect, getUnreadCount as RequestHandler);

// Mark as read
router.put('/:id/read', protect, markAsRead as RequestHandler);

// Mark all as read
router.put('/read-all', protect, markAllAsRead as RequestHandler);

// Delete notification
router.delete('/:id', protect, deleteNotification as RequestHandler);

export default router;
