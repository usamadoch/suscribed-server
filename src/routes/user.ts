import { Router, RequestHandler } from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateUserSchema } from '../utils/validators.js';
import {
    getUserById,
    getUserByUsername,
    updateCurrentUser
} from '../controllers/userController.js';

const router = Router();

// Get user profile by ID
router.get('/id/:id', getUserById as RequestHandler);

// Get user profile by username
router.get('/:username', getUserByUsername as RequestHandler);

// Update current user profile
router.put(
    '/me',
    protect,
    validate(updateUserSchema),
    updateCurrentUser as RequestHandler
);

export default router;
