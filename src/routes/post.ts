import { Router, RequestHandler } from 'express';
import { protect, optionalAuth, requireCreator } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createPostSchema, updatePostSchema, createCommentSchema } from '../utils/validators.js';
import {
    getPosts,
    getPostById,
    createPost,
    updatePost,
    deletePost,
    toggleLikePost,
    getPostComments,
    addPostComment
} from '../controllers/postControllers.js';

const router = Router();

// Get posts (with filters)
router.get('/', optionalAuth, getPosts as RequestHandler);

// Get single post
router.get('/:id', optionalAuth, getPostById as RequestHandler);

// Create post (creator only)
router.post(
    '/',
    protect,
    requireCreator,
    validate(createPostSchema),
    createPost as RequestHandler
);

// Update post
router.put(
    '/:id',
    protect,
    requireCreator,
    validate(updatePostSchema),
    updatePost as RequestHandler
);

// Delete post
router.delete('/:id', protect, requireCreator, deletePost as RequestHandler);

// Like / Unlike post
router.post('/:id/like', protect, toggleLikePost as RequestHandler);

// Get comments
router.get('/:id/comments', optionalAuth, getPostComments as RequestHandler);

// Add comment
router.post(
    '/:id/comments',
    protect,
    validate(createCommentSchema),
    addPostComment as RequestHandler
);

export default router;
