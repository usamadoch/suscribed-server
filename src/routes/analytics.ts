import { Router, RequestHandler } from 'express';
import { protect, requireCreator } from '../middleware/auth.js';
import {
    getOverview,
    getMembers,
    getPosts,
    getEngagement
} from '../controllers/analyticsController.js';

const router = Router();

// Get analytics overview (creator only)
router.get('/overview', protect, requireCreator, getOverview as unknown as RequestHandler);

// Get member analytics
router.get('/members', protect, requireCreator, getMembers as unknown as RequestHandler);

// Get post analytics
router.get('/posts', protect, requireCreator, getPosts as unknown as RequestHandler);

// Get engagement breakdown
router.get('/engagement', protect, requireCreator, getEngagement as unknown as RequestHandler);

export default router;
