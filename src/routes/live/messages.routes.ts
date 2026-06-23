import express, { RequestHandler, Router } from 'express';
import { protect } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { chatMessageSchema } from '../../validators/live.validators.js';
import * as messagesController from '../../controllers/live/messages.controller.js';

const router = Router();

// Messages
router.post('/sessions/:sessionId/messages', protect, messagesController.initiatePaidMessage as RequestHandler);
router.post('/sessions/:sessionId/setup-tracker', protect, express.json(), messagesController.setupTracker as RequestHandler);
router.post('/sessions/:sessionId/messages/:msgId/charge-saved', protect, express.json(), messagesController.chargeSavedMessage as RequestHandler);
router.post('/sessions/:sessionId/messages/confirm', protect, express.json(), messagesController.confirmPaidMessage as RequestHandler);
router.get('/sessions/:sessionId/messages', protect, messagesController.listMessages as RequestHandler);
router.patch('/sessions/:sessionId/messages/:msgId', protect, messagesController.updateMessage as RequestHandler);
router.post('/sessions/:sessionId/messages/:msgId/refund', protect, messagesController.refundMessage as RequestHandler);

// Free Chat
router.post('/sessions/:sessionId/chat', protect, validate(chatMessageSchema), messagesController.sendChatMessage as RequestHandler);
router.delete('/sessions/:sessionId/chat/:msgId', protect, messagesController.deleteChatMessage as RequestHandler);
router.post('/sessions/:sessionId/chat/timeout/:userId', protect, express.json(), messagesController.timeoutUser as RequestHandler);

export default router;
