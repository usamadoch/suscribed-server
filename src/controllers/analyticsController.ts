import { Response, NextFunction } from 'express';
import {
    AuthenticatedRequest,
    TimeRange,
    AnalyticsOverviewResponse,
    MembersResponse,
    PostsResponse,
    EngagementResponse,
    MemberGrowthData,
    PostSanitized
} from '../types/index.js';
import Membership from '../models/Membership.js';
import Post from '../models/Post.js';
import PostView from '../models/PostView.js';
import CreatorPage from '../models/CreatorPage.js';


const isValidTimeRange = (days: unknown): days is TimeRange => {
    return Number(days) === 7 || Number(days) === 30 || Number(days) === 90;
};

export const getOverview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const creatorId = req.user._id; // Guaranteed by AuthenticatedRequest
        const { days = 30 } = req.query;

        // Domain invariant: days must be a valid TimeRange
        if (!isValidTimeRange(days)) {
            res.status(400).json({
                success: false,
                error: { code: 'INVALID_PARAM', message: 'Days must be 7, 30, or 90' }
            });
            return;
        }

        const daysCount = Number(days);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);

        const previousStartDate = new Date();
        previousStartDate.setDate(previousStartDate.getDate() - daysCount * 2);

        // Get page
        const page = await CreatorPage.findOne({ userId: creatorId });
        if (!page) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Page not found' },
            });
            return;
        }

        // Current period stats
        const [currentMembers, previousMembers] = await Promise.all([
            Membership.countDocuments({
                creatorId,
                joinedAt: { $gte: startDate },
                status: 'active',
            }),
            Membership.countDocuments({
                creatorId,
                joinedAt: { $gte: previousStartDate, $lt: startDate },
                status: 'active',
            }),
        ]);

        // Post views
        const postIds = await Post.find({ creatorId }).distinct('_id');

        const [currentViews, previousViews] = await Promise.all([
            PostView.countDocuments({
                postId: { $in: postIds },
                viewedAt: { $gte: startDate },
            }),
            PostView.countDocuments({
                postId: { $in: postIds },
                viewedAt: { $gte: previousStartDate, $lt: startDate },
            }),
        ]);

        // Engagement (likes + comments)
        const posts = await Post.find({ creatorId });
        const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
        const totalComments = posts.reduce((sum, p) => sum + p.commentCount, 0);
        const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);

        const engagementRate = totalViews > 0
            ? Number(((totalLikes + totalComments) / totalViews * 100).toFixed(1))
            : 0;

        // Calculate percentage changes
        const memberGrowth = previousMembers > 0
            ? Number((((currentMembers - previousMembers) / previousMembers) * 100).toFixed(1))
            : (currentMembers > 0 ? 100 : 0);

        const viewGrowth = previousViews > 0
            ? Number((((currentViews - previousViews) / previousViews) * 100).toFixed(1))
            : (currentViews > 0 ? 100 : 0);

        const responseData: AnalyticsOverviewResponse = {
            totalMembers: page.memberCount,
            newMembers: currentMembers,
            memberGrowth,
            totalViews: currentViews,
            viewGrowth,
            totalPosts: page.postCount,
            totalLikes,
            totalComments,
            engagementRate,
        };

        res.json({
            success: true,
            data: responseData,
        });
    } catch (error) {
        next(error);
    }
};

export const getMembers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const creatorId = req.user._id;
        const { days = 30 } = req.query;

        if (!isValidTimeRange(days)) {
            res.status(400).json({
                success: false,
                error: { code: 'INVALID_PARAM', message: 'Days must be 7, 30, or 90' }
            });
            return;
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - Number(days));

        // Daily member growth
        const membersByDay = await Membership.aggregate([
            {
                $match: {
                    creatorId,
                    joinedAt: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$joinedAt' },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const responseData: MembersResponse = {
            dailyGrowth: membersByDay as MemberGrowthData[], // Aggregate result cast
        };

        res.json({
            success: true,
            data: responseData,
        });
    } catch (error) {
        next(error);
    }
};

export const getPosts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const creatorId = req.user._id;

        // Top performing posts
        const topPosts = await Post.find({ creatorId, status: 'published' })
            .sort({ viewCount: -1 })
            .limit(10)
            .select('caption mediaAttachments viewCount likeCount commentCount publishedAt')
            .lean();

        // Recent posts performance
        const recentPosts = await Post.find({ creatorId, status: 'published' })
            .sort({ publishedAt: -1 })
            .limit(10)
            .select('caption mediaAttachments viewCount likeCount commentCount publishedAt')
            .lean();

        // Cast to ensure it matches sanitized response (removing extra mongoose methods)
        const responseData: PostsResponse = {
            topPosts: topPosts as unknown as PostSanitized[],
            recentPosts: recentPosts as unknown as PostSanitized[],
        };

        res.json({
            success: true,
            data: responseData,
        });
    } catch (error) {
        next(error);
    }
};

export const getEngagement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const creatorId = req.user._id;

        const posts = await Post.find({ creatorId, status: 'published' });

        const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
        const totalComments = posts.reduce((sum, p) => sum + p.commentCount, 0);
        const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);

        const responseData: EngagementResponse = {
            breakdown: {
                likes: totalLikes,
                comments: totalComments,
                views: totalViews,
            },
            percentages: {
                likes: totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : '0',
                comments: totalViews > 0 ? ((totalComments / totalViews) * 100).toFixed(1) : '0',
            },
        };

        res.json({
            success: true,
            data: responseData,
        });
    } catch (error) {
        next(error);
    }
};
