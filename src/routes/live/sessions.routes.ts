import { RequestHandler, Router } from 'express';
import { protect, optionalAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createSessionSchema } from '../../validators/live.validators.js';
import * as sessionsController from '../../controllers/live/sessions.controller.js';

const router = Router();

// Sessions
router.post('/sessions', protect, validate(createSessionSchema), sessionsController.createSession as RequestHandler);
router.get('/sessions', protect, sessionsController.listSessions as RequestHandler);
router.get('/sessions/superchat-tiers', sessionsController.getSuperChatTiers as RequestHandler);
router.get('/safepay/wallet-status', protect, sessionsController.getWalletStatus as RequestHandler);
router.get('/sessions/:sessionId', optionalAuth, sessionsController.getPublicSession as RequestHandler);
router.get('/sessions/:sessionId/control', protect, sessionsController.getSession as RequestHandler);
router.patch('/sessions/:sessionId', protect, sessionsController.updateSession as RequestHandler);
router.post('/sessions/:sessionId/start', protect, sessionsController.startLive as RequestHandler);
router.post('/sessions/:sessionId/end', protect, sessionsController.endLive as RequestHandler);
router.delete('/sessions/:sessionId', protect, sessionsController.deleteSession as RequestHandler);

// YouTube Integration
router.get('/youtube/detect', protect, sessionsController.detectActiveBroadcast);
router.get('/youtube/validate-url', protect, sessionsController.validateYouTubeUrl);

export default router;
