import { Router, RequestHandler } from 'express';
import { protect, requireCreator } from '../middleware/auth.js';
import { getEarningsSummary, getMyPayoutMethod, submitPayoutMethod } from '../controllers/payoutController.js';

const router = Router();

// Get the creator's current payout method
router.get('/me', protect, requireCreator, getMyPayoutMethod as RequestHandler);

// Submit or update payout method
router.post('/', protect, requireCreator, submitPayoutMethod as RequestHandler);
router.put('/', protect, requireCreator, submitPayoutMethod as RequestHandler); // Alias for update

// Get earnings summary
router.get('/summary', protect, requireCreator, getEarningsSummary as RequestHandler);

export default router;
