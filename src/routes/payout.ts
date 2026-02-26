import { Router, RequestHandler } from 'express';
import { protect, requireCreator } from '../middleware/auth.js';
import { getMyPayoutMethod, submitPayoutMethod } from '../controllers/payoutController.js';

const router = Router();

// Get the creator's current payout method
router.get('/me', protect, requireCreator, getMyPayoutMethod as RequestHandler);

// Submit or update payout method
router.post('/', protect, requireCreator, submitPayoutMethod as RequestHandler);
router.put('/', protect, requireCreator, submitPayoutMethod as RequestHandler); // Alias for update

export default router;
