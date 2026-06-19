import { Router } from 'express';
import sessionsRoutes from './live/sessions.routes.js';
import messagesRoutes from './live/messages.routes.js';

const router = Router();

router.use('/', sessionsRoutes);
router.use('/', messagesRoutes);

export default router;
