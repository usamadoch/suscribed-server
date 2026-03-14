import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../types/index.js';
import { postService } from '../services/postService.js';
import { feedService } from '../services/feedService.js';
import { commentService } from '../services/commentService.js';
import { createError } from '../middleware/errorHandler.js';

export const getMyPosts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const result = await postService.getMyPosts(req.user._id, Number(page), Number(limit));
        
        res.json({
            success: true,
            data: { posts: result.posts },
            meta: result.meta
        });
    } catch (error) {
        next(error);
    }
};

export const getCreatorPosts = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { pageSlug, limit = 100, type } = req.query;
        
        if (!pageSlug) {
            throw createError.invalidInput('pageSlug is required');
        }

        const posts = await postService.getCreatorPosts(
            String(pageSlug),
            Number(limit),
            type ? String(type) : undefined,
            req.user?._id
        );

        res.json({
            success: true,
            data: { posts },
        });
    } catch (error) {
        next(error);
    }
};

export const getPostById = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const sessionId = req.cookies?.sessionId || req.ip || 'anonymous';
        const result = await postService.getPostById(req.params.id as string, req.user?._id?.toString() || null, sessionId);
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const createPost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await postService.createPost(req.user._id, req.body, req.app.get('io'));
        
        res.status(201).json({
            success: true,
            data: { post },
        });
    } catch (error) {
        next(error);
    }
};

export const updatePost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await postService.updatePost(req.user._id, req.params.id as string, req.body, req.app.get('io'));
        
        res.json({
            success: true,
            data: { post },
        });
    } catch (error) {
        next(error);
    }
};

export const deletePost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        await postService.deletePost(req.user._id, req.params.id as string);
        
        res.json({
            success: true,
            data: { message: 'Post deleted successfully' },
        });
    } catch (error) {
        next(error);
    }
};

export const toggleLikePost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await postService.toggleLikePost(req.user._id, req.params.id as string, req.user.displayName, req.app.get('io'));
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const getPostComments = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await commentService.getPostComments(req.params.id as string, Number(page), Number(limit), req.user?._id);
        
        res.json({
            success: true,
            data: { comments: result.comments },
            meta: result.meta
        });
    } catch (error) {
        next(error);
    }
};

export const addPostComment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const comment = await commentService.addPostComment(
            req.user._id,
            req.user.displayName,
            req.params.id as string,
            req.body.content,
            req.body.parentId,
            req.app.get('io')
        );
        
        res.status(201).json({
            success: true,
            data: { comment },
        });
    } catch (error) {
        next(error);
    }
};

export const getRecentVideos = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { pageSlug, limit = 5 } = req.query;
        
        if (!pageSlug) {
            throw createError.invalidInput('pageSlug is required');
        }

        const posts = await postService.getRecentVideos(String(pageSlug), Number(limit));
        
        res.json({
            success: true,
            data: { posts },
        });
    } catch (error) {
        next(error);
    }
};

export const getHomeFeed = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { cursor, limit = 10 } = req.query;
        const result = await feedService.getHomeFeed(req.user._id, cursor ? String(cursor) : undefined, Number(limit));
        
        res.json({
            success: true,
            data: { posts: result.posts },
            meta: { hasNextPage: result.hasNextPage, nextCursor: result.nextCursor },
        });
    } catch (error) {
        next(error);
    }
};
