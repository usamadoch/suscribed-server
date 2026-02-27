import { Router, RequestHandler } from 'express';
import { protect, optionalAuth } from '../middleware/auth.js';
import {
    getMember,
    getMyMembers,
    joinCreator,
    leaveCreator,
    checkMembership
} from '../controllers/memberController.js';

const router = Router();


// Get user's members (as member)
router.get('/', protect, getMember as RequestHandler);

// Get creator's members (as creator)
router.get('/my-members', protect, getMyMembers as RequestHandler);

// Join a creator (become a member)
router.post('/', protect, joinCreator as RequestHandler);

// Leave a creator (cancel member)
router.delete('/:id', protect, leaveCreator as RequestHandler);

// Check member status for a page
router.get('/check/:pageId', protect, checkMembership as RequestHandler);

export default router;
