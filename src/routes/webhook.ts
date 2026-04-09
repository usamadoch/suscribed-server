

import express, { Router } from 'express';
import { handleSafepayWebhook } from '../controllers/webhookController.js';

const router = Router();
router.post('/safepay', express.raw({ type: 'application/json' }), handleSafepayWebhook);

export default router;