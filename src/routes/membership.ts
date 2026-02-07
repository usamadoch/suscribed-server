import { Router, RequestHandler } from 'express';
import { protect } from '../middleware/auth.js';
import {
    getMemberships,
    getMyMembers,
    joinCreator,
    leaveCreator,
    checkMembership
} from '../controllers/membershipController.js';

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

export default router;
