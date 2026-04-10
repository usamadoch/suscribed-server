import { creatorPageRepository } from '../repositories/creatorPageRepository.js';
import { memberRepository } from '../repositories/memberRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { postViewRepository } from '../repositories/postViewRepository.js';
import { createError } from '../middleware/errorHandler.js';
import { Types } from 'mongoose';
import {
    TimeRange,
    AnalyticsOverviewResponse,
    MembersResponse,
    PostsResponse,
    EngagementResponse,
    MemberGrowthData,
    PostSanitized
} from '../types/index.js';

const isValidTimeRange = (days: unknown): days is TimeRange => {
    return Number(days) === 7 || Number(days) === 30 || Number(days) === 90;
};

export const analyticsService = {
    validateTimeRange(days: unknown): number {
        if (!isValidTimeRange(days)) {
            throw createError.invalidInput('Days must be 7, 30, or 90');
        }
        return Number(days);
    },

    async getOverview(creatorId: Types.ObjectId, days: number): Promise<AnalyticsOverviewResponse> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const previousStartDate = new Date();
        previousStartDate.setDate(previousStartDate.getDate() - days * 2);

        // Get page
        const page = await creatorPageRepository.findOne({ userId: creatorId });
        if (!page) {
            throw createError.notFound('Page');
        }

        // Current period stats
        const [currentMembers, previousMembers] = await Promise.all([
            memberRepository.countDocuments({
                creatorId,
                joinedAt: { $gte: startDate },
                status: 'active',
            }),
            memberRepository.countDocuments({
                creatorId,
                joinedAt: { $gte: previousStartDate, $lt: startDate },
                status: 'active',
            }),
        ]);

        // Post views
        const postIds = await postRepository.distinct('_id', { creatorId });

        const [currentViews, previousViews] = await Promise.all([
            postViewRepository.countDocuments({
                postId: { $in: postIds },
                viewedAt: { $gte: startDate },
            }),
            postViewRepository.countDocuments({
                postId: { $in: postIds },
                viewedAt: { $gte: previousStartDate, $lt: startDate },
            }),
        ]);

        // Engagement (likes + comments)
        const posts = await postRepository.findNotLean({ creatorId });
        const totalLikes = posts.reduce((sum: number, p: any) => sum + p.likeCount, 0);
        const totalComments = posts.reduce((sum: number, p: any) => sum + p.commentCount, 0);
        const totalViews = posts.reduce((sum: number, p: any) => sum + p.viewCount, 0);

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

        return {
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
    },

    async getMembers(creatorId: Types.ObjectId, days: number): Promise<MembersResponse> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const membersByDay = await memberRepository.aggregate([
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

        return {
            dailyGrowth: membersByDay as MemberGrowthData[],
        };
    },

    async getPosts(creatorId: Types.ObjectId): Promise<PostsResponse> {
        const selectFields = 'caption mediaAttachments viewCount likeCount commentCount publishedAt';

        const [topPosts, recentPosts] = await Promise.all([
            postRepository.findLean(
                { creatorId, status: 'published' },
                selectFields,
                { viewCount: -1 },
                10
            ),
            postRepository.findLean(
                { creatorId, status: 'published' },
                selectFields,
                { publishedAt: -1 },
                10
            ),
        ]);

        return {
            topPosts: topPosts as unknown as PostSanitized[],
            recentPosts: recentPosts as unknown as PostSanitized[],
        };
    },

    async getEngagement(creatorId: Types.ObjectId): Promise<EngagementResponse> {
        const posts = await postRepository.findNotLean({ creatorId, status: 'published' });

        const totalLikes = posts.reduce((sum: number, p: any) => sum + p.likeCount, 0);
        const totalComments = posts.reduce((sum: number, p: any) => sum + p.commentCount, 0);
        const totalViews = posts.reduce((sum: number, p: any) => sum + p.viewCount, 0);

        return {
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
    }
};
