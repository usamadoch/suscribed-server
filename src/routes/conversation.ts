import { Router, RequestHandler } from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendMessageSchema } from '../utils/validators.js';
import * as conversationController from '../controllers/conversationController.js';

const router = Router();

// Get user's conversations
router.get('/', protect, conversationController.getConversations as RequestHandler);

// Get total unread message count (for sidebar badge)
router.get('/unread-count', protect, conversationController.getUnreadMessageCount as RequestHandler);

// Start or get existing conversation
router.post('/', protect, conversationController.createConversation as RequestHandler);

// Get conversation messages
router.get('/:id/messages', protect, conversationController.getConversationMessages as RequestHandler);

// Send message
router.post(
    '/:id/messages',
    protect,
    validate(sendMessageSchema),
    conversationController.sendMessage as RequestHandler
);

// Mark message as read
router.put('/:conversationId/messages/:messageId/read', protect, conversationController.markMessageAsRead as RequestHandler);

export default router;
