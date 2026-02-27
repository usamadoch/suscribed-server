import { Router, RequestHandler } from 'express';
import { protect, optionalAuth } from '../middleware/auth.js';
import {
    createPlan,
    getCreatorPlans,
    getMyPlans,
    updatePlan,
    subscribeMock
} from '../controllers/tierController.js';

const router = Router();

// Create a new member plan
router.post('/', protect, createPlan as RequestHandler);

// Get creator's own member plans
router.get('/me', protect, getMyPlans as RequestHandler);

// Get a creator's published member plans (public/optional auth)
router.get('/creator/:creatorId', optionalAuth, getCreatorPlans as RequestHandler);

// Update a member plan
router.put('/:id', protect, updatePlan as RequestHandler);

// Mock subscription to a plan
router.post('/:planId/subscribe', protect, subscribeMock as RequestHandler);

export default router;
