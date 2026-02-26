import { Router, RequestHandler } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import { getPendingPayouts, reviewPayout } from '../controllers/adminController.js';

const router = Router();

// Get all pending payouts for admin review
router.get('/payouts/pending', protect, requireAdmin, getPendingPayouts as RequestHandler);

// Review (approve/reject) a payout method
router.put('/payouts/:id/review', protect, requireAdmin, reviewPayout as RequestHandler);

export default router;
