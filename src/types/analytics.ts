
export type TimeRange = 7 | 30 | 90;

export interface AnalyticsOverviewResponse {
    totalMembers: number;
    newMembers: number;
    memberGrowth: number;
    totalViews: number;
    viewGrowth: number;
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    engagementRate: number;
}

export interface MemberGrowthData {
    _id: string;
    count: number;
}

export interface MembersResponse {
    dailyGrowth: MemberGrowthData[];
}

export interface PostSanitized {
    _id: string;
    caption: string;
    mediaAttachments: { type: 'image' | 'video'; url: string }[];
    viewCount: number;
    likeCount: number;
    commentCount: number;
    publishedAt: Date | null;
}

export interface PostsResponse {
    topPosts: PostSanitized[];
    recentPosts: PostSanitized[];
}

export interface EngagementResponse {
    breakdown: {
        likes: number;
        comments: number;
        views: number;
    };
    percentages: {
        likes: number | string;
        comments: number | string;
    };
}
