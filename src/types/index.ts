import { Request } from 'express';
import { Types } from 'mongoose';

// User types
export type UserRole = 'member' | 'creator' | 'admin';

export type Permission =
    | 'post:create'
    | 'post:read'
    | 'post:update'
    | 'post:delete'
    | 'dashboard:view'
    | 'analytics:view'
    | 'members:view'
    | 'payouts:view'
    | 'page:manage'
    | 'explore:view'
    | 'subscriptions:view'
    | 'security:manage'
    | 'admin:access';

export interface IUser {
    _id: Types.ObjectId;
    email: string;
    passwordHash: string;
    role: UserRole;
    displayName: string;
    username: string;
    bio: string;
    avatarUrl: string | null;
    isEmailVerified: boolean;
    isActive: boolean;
    lastLoginAt: Date;
    googleId?: string;
    notificationPreferences: NotificationPreferences;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationPreferences {
    email: {
        newMembers: boolean;
        newComments: boolean;
        newMessages: boolean;
        weeklyDigest: boolean;
    };
    push: {
        newMembers: boolean;
        newPosts: boolean;
        newComments: boolean;
        newMessages: boolean;
        mentions: boolean;
    };
    inApp: {
        all: boolean;
    };
    quietHours: {
        enabled: boolean;
        startTime: string;
        endTime: string;
        timezone: string;
    };
}

// Social links
export interface SocialLink {
    platform: 'twitter' | 'instagram' | 'youtube' | 'tiktok' | 'discord' | 'website' | 'facebook' | 'linkedin' | 'pinterest' | 'x' | 'other';
    url: string;
    label?: string;
}

// Page theme
export interface PageTheme {
    primaryColor: string;
    accentColor: string;
    layout: 'default' | 'minimal' | 'featured';
}

// Creator page
export interface ICreatorPage {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    pageSlug: string;
    displayName: string;
    tagline: string;
    category: string[];
    avatarUrl: string | null;
    bannerUrl: string | null;
    about: string;
    socialLinks: SocialLink[];
    theme: PageTheme;
    isPublic: boolean;
    memberCount: number;
    postCount: number;
    status: 'draft' | 'published';
    createdAt: Date;
    updatedAt: Date;
}

// Post types
export type PostType = 'text' | 'image' | 'video'; // Audio/poll/link removed as per request
export type PostStatus = 'draft' | 'scheduled' | 'published';
export type PostVisibility = 'public' | 'members';

export interface MediaAttachment {
    type: 'image' | 'video';
    url: string;
    thumbnailUrl?: string;
    filename: string;
    fileSize: number;
    mimeType: string;
    duration?: number;
    dimensions?: { width: number; height: number };
}

export interface IPost {
    _id: Types.ObjectId;
    creatorId: Types.ObjectId;
    pageId: Types.ObjectId;
    caption: string;
    // featuredImage removed
    mediaAttachments: MediaAttachment[];
    postType: PostType;
    tags: string[];
    visibility: PostVisibility;
    status: PostStatus;
    publishedAt: Date | null;
    scheduledFor: Date | null;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    allowComments: boolean;
    isPinned: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Membership
export type MembershipStatus = 'active' | 'paused' | 'cancelled';

export interface IMembership {
    _id: Types.ObjectId;
    memberId: Types.ObjectId;
    creatorId: Types.ObjectId;
    pageId: Types.ObjectId;
    status: MembershipStatus;
    joinedAt: Date;
    cancelledAt: Date | null;
    lastVisitAt: Date;
    totalVisits: number;
}

// Messages
export interface MessageAttachment {
    type: 'image' | 'file';
    url: string;
    filename: string;
    fileSize: number;
    mimeType: string;
}

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface IMessage {
    _id: Types.ObjectId;
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    content: string;
    contentType: 'text' | 'image' | 'file';
    attachments: MessageAttachment[];
    status: MessageStatus;
    readAt: Date | null;
    isDeleted: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IConversation {
    _id: Types.ObjectId;
    participants: Types.ObjectId[];
    creatorId: Types.ObjectId;
    memberId: Types.ObjectId;
    isActive: boolean;
    lastMessage: {
        content: string;
        senderId: Types.ObjectId;
        sentAt: Date;
    } | null;
    unreadCounts: Record<string, number>;
    createdAt: Date;
    updatedAt: Date;
}

// Notifications
export type NotificationType =
    | 'new_member'
    | 'member_left'
    | 'new_post'
    | 'post_liked'
    | 'new_comment'
    | 'comment_reply'
    | 'new_message'
    | 'mention'
    | 'creator_went_live'
    | 'system';

export interface INotification {
    _id: Types.ObjectId;
    recipientId: Types.ObjectId;
    type: NotificationType;
    title: string;
    body: string;
    imageUrl: string | null;
    actionUrl: string;
    actionLabel: string;
    metadata: Record<string, unknown>;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
    expiresAt: Date | null;
}

// Comments
export interface IComment {
    _id: Types.ObjectId;
    postId: Types.ObjectId;
    authorId: Types.ObjectId;
    content: string;
    parentId: Types.ObjectId | null;
    depth: number;
    isEdited: boolean;
    isPinned: boolean;
    isHidden: boolean;
    likeCount: number;
    replyCount: number;
    createdAt: Date;
    updatedAt: Date;
}

// Auth request extension
export interface AuthenticatedRequest extends Request {
    user?: IUser;
}

// API Response types
export interface SuccessResponse<T> {
    success: true;
    data: T;
    meta?: {
        pagination?: Pagination;
        [key: string]: unknown;
    };
}

export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, string[]>;
    };
}

export interface Pagination {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

// JWT Payload
export interface JWTPayload {
    userId: string;
    email: string;
    role: UserRole;
}

// Refresh token
export interface IRefreshToken {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}
