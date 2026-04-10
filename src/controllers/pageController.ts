import { Response, NextFunction, Request } from 'express';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../types/index.js';
import { UpdatePageInput } from '../utils/validators.js';
import { pageService } from '../services/pageService.js';

// Get all public pages (for explore)
export const getPublicPages = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const pages = await pageService.getPublicPages();
        res.json({
            success: true,
            data: { pages },
        });
    } catch (error) {
        next(error);
    }
};

// Get current user's page (creator only)
export const getMyPage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const page = await pageService.getMyPage(req.user._id);
        res.json({
            success: true,
            data: { page },
        });
    } catch (error) {
        next(error);
    }
};

// Update page (creator only)
export const updateMyPage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const updateData = req.body as UpdatePageInput;
        const page = await pageService.updateMyPage(req.user._id, updateData);
        res.json({
            success: true,
            data: { page },
        });
    } catch (error) {
        next(error);
    }
};

// Get page by slug (public)
export const getPageBySlug = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const slug = String(req.params.slug);
        const data = await pageService.getPageBySlug(slug, req.user?._id);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

// Get posts by page ID (with visibility filtering)
export const getPagePosts = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const pageId = String(req.params.pageId);
        const posts = await pageService.getPagePosts(pageId, req.user?._id);
        res.json({
            success: true,
            data: { posts },
        });
    } catch (error) {
        next(error);
    }
};
