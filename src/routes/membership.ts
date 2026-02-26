import { Router, RequestHandler } from 'express';
import { protect, optionalAuth } from '../middleware/auth.js';
import {
    getMemberships,
    getMyMembers,
    joinCreator,
    leaveCreator,
    checkMembership
} from '../controllers/membershipController.js';

import {
    createPlan,
    getCreatorPlans,
    getMyPlans,
    updatePlan,
    subscribeMock
} from '../controllers/membershipPlanController.js';

const router = Router();


// Get user's memberships (as member)
router.get('/', protect, getMemberships as RequestHandler);

// Get creator's members (as creator)
router.get('/my-members', protect, getMyMembers as RequestHandler);

// Join a creator (become a member)
router.post('/', protect, joinCreator as RequestHandler);

// Leave a creator (cancel membership)
router.delete('/:id', protect, leaveCreator as RequestHandler);

// Check membership status for a page
router.get('/check/:pageId', protect, checkMembership as RequestHandler);

// --- Membership Plans (Tiers) ---

// Create a new membership plan
router.post('/plans', protect, createPlan as RequestHandler);

// Get creator's own membership plans
router.get('/my-plans', protect, getMyPlans as RequestHandler);

// Get a creator's published membership plans (public/optional auth)
router.get('/plans/:creatorId', optionalAuth, getCreatorPlans as RequestHandler);

// Update a membership plan
router.put('/plans/:id', protect, updatePlan as RequestHandler);

// Mock subscription to a plan
router.post('/subscribe/:planId', protect, subscribeMock as RequestHandler);

export default router;
