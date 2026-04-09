import { Router, RequestHandler } from 'express';
import { protect, optionalAuth } from '../middleware/auth.js';
import {
    createPlan,
    getCreatorPlans,
    getMyPlans,
    updatePlan,
    updatePlanPrice,
    subscribeToPlan,
    confirmSubscription
} from '../controllers/tierController.js';

const router = Router();

// Create a new member plan
router.post('/', protect, createPlan as RequestHandler);

// Get creator's own member plans
router.get('/me', protect, getMyPlans as RequestHandler);

// Get a creator's published member plans (public/optional auth)
router.get('/creator/:creatorId', optionalAuth, getCreatorPlans as RequestHandler);

// Update a member plan (Metadata)
router.put('/:id', protect, updatePlan as RequestHandler);

// Update tier price (New)
router.put('/:id/price', protect, updatePlanPrice as RequestHandler);

// Subscription to a plan via checkout
router.post('/:tierId/subscribe', protect, subscribeToPlan as RequestHandler);

// Confirm subscription after Safepay redirects back
router.post('/:tierId/confirm', protect, confirmSubscription as RequestHandler);

export default router;
