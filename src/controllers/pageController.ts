import { Response, NextFunction, Request } from 'express';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../types/index.js';
import { UpdatePageInput } from '../utils/validators.js';
import CreatorPage from '../models/CreatorPage.js';
import Post from '../models/Post.js';
import Membership from '../models/Membership.js';

// Get all public pages (for explore)
export const getPublicPages = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const pages = await CreatorPage.find({ isPublic: true, status: 'published' })
            .select('pageSlug displayName tagline avatarUrl bannerUrl memberCount postCount theme')
            .sort({ memberCount: -1, createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            data: { pages },
        });
    } catch (error) {
        next(error);
    }
};

// Get current user's page (creator only)
export const getMyPage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // AuthenticatedRequest guarantees user is present
        const page = await CreatorPage.findOne({ userId: req.user._id });

        if (!page) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Page not found' },
            });
            return;
        }

        res.json({
            success: true,
            data: { page },
        });
    } catch (error) {
        next(error);
    }
};

// Update page (creator only)
export const updateMyPage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Safe to access user._id directly as it's an AuthenticatedRequest
        const userId = req.user._id;
        const updateData = req.body as UpdatePageInput;

        const page = await CreatorPage.findOneAndUpdate(
            { userId },
            {
                $set: updateData,
                $setOnInsert: { userId }
            },
            { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json({
            success: true,
            data: { page },
        });
    } catch (error) {
        next(error);
    }
};

// Get page by slug (public)
export const getPageBySlug = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const slug = String(req.params.slug);
        const page = await CreatorPage.findOne({ pageSlug: slug.toLowerCase() })
            .populate('userId', 'displayName username avatarUrl');

        if (!page) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Page not found' },
            });
            return;
        }

        // Check if private and user not logged in or not a member
        let isMember = false;
        let isOwner = false;

        // Auto-fix post count if out of sync
        const realPostCount = await Post.countDocuments({
            pageId: page._id,
            status: 'published'
        });

        if (page.postCount !== realPostCount) {
            console.log(`[Page] Fixing post count for ${page.pageSlug}: ${page.postCount} -> ${realPostCount}`);
            page.postCount = realPostCount;
            await page.save();
        }

        if (req.user) {
            isOwner = page.userId._id.toString() === req.user._id.toString();

            if (!isOwner) {
                const membership = await Membership.findOne({
                    memberId: req.user._id,
                    creatorId: page.userId._id,
                    status: 'active',
                });
                isMember = !!membership;
            }
        }

        // If draft and not owner, return 404 (strictly hide existence or content)
        if (page.status === 'draft' && !isOwner) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_PUBLISHED', message: 'Page is not published yet' },
            });
            return;
        }

        // If private page and not owner/member, return limited info
        if (!page.isPublic && !isOwner && !isMember) {
            res.json({
                success: true,
                data: {
                    page: {
                        _id: page._id,
                        pageSlug: page.pageSlug,
                        displayName: page.displayName,
                        tagline: page.tagline,
                        avatarUrl: page.avatarUrl,
                        bannerUrl: page.bannerUrl,
                        memberCount: page.memberCount,
                        isPublic: page.isPublic,
                    },
                    isOwner: false,
                    isMember: false,
                    isRestricted: true,
                },
            });
            return;
        }

        res.json({
            success: true,
            data: { page, isOwner, isMember, isRestricted: false },
        });
    } catch (error) {
        next(error);
    }
};

// Get posts by page ID (with visibility filtering)
export const getPagePosts = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { pageId } = req.params;

        // Find the page
        const page = await CreatorPage.findById(pageId);
        if (!page) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Page not found' },
            });
            return;
        }

        // Check membership
        let isMember = false;
        let isOwner = false;

        if (req.user) {
            isOwner = page.userId.toString() === req.user._id.toString();

            if (!isOwner) {
                const membership = await Membership.findOne({
                    memberId: req.user._id,
                    pageId: page._id,
                    status: 'active',
                });
                isMember = !!membership;
            }
        }

        // Build query based on access
        const query: Record<string, unknown> = {
            pageId: page._id,
            status: 'published',
        };

        // If not owner or member, only show public posts
        if (!isOwner && !isMember) {
            query.visibility = 'public';
        }

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('creatorId', 'displayName username avatarUrl');

        res.json({
            success: true,
            data: { posts },
        });
    } catch (error) {
        next(error);
    }
};
