import { Router, RequestHandler } from 'express';

import * as pageController from '../controllers/pageController.js';
import { protect, requireCreator, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updatePageSchema } from '../utils/validators.js';

const router = Router();

// Get all public pages (for explore)
router.get('/', pageController.getPublicPages);

// Get current user's page (creator only) - MUST come before /:slug
router.get('/my/page', protect, requireCreator, pageController.getMyPage as unknown as RequestHandler);

// Update page (creator only)
router.put(
    '/my/page',
    protect,
    requireCreator,
    validate(updatePageSchema),
    pageController.updateMyPage as unknown as RequestHandler
);

// Get page by slug (public)
router.get('/:slug', optionalAuth, pageController.getPageBySlug as unknown as RequestHandler);

// Get posts by page ID (with visibility filtering)
router.get('/:pageId/posts', optionalAuth, pageController.getPagePosts as unknown as RequestHandler);

export default router;








