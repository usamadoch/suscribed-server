/**
 * Post Access Control - Backend-Enforced Content Gatekeeping
 * 
 * This module handles sanitizing post data based on user authorization.
 * It ensures locked content is never delivered to unauthorized users.
 */

import { IPost, MediaAttachment, ImageAttachment, VideoAttachment, PostVisibility } from '../types/index.js';
import { generateBlurredImageUrl, generateBlurredVideoThumbnail } from './cloudinaryTransforms.js';
import { Types } from 'mongoose';

// ============================================================================
// ACCESS CONTEXT TYPES
// ============================================================================

/**
 * Context for determining user access to a post.
 * Used by sanitization functions to make access decisions.
 */
export interface AccessContext {
    userId: string | null;
    isOwner: boolean;
    isMember: boolean;
}

// ============================================================================
// SANITIZED POST TYPES (Response Shapes)
// ============================================================================

/**
 * Base media attachment structure for locked content.
 * Original URLs are nulled out, only blurred previews are provided.
 */
interface LockedImageAttachment {
    type: 'image';
    url: null;
    thumbnailUrl: string | null;
    filename: string;
    fileSize: number;
    mimeType: string;
    dimensions?: { width: number; height: number };
}

interface LockedVideoAttachment {
    type: 'video';
    url: null;
    thumbnailUrl: string | null;
    filename: string;
    fileSize: number;
    mimeType: string;
    dimensions?: { width: number; height: number };
    muxPlaybackId: null;
    muxAssetId: null;
    duration?: number;
    status?: string;
}

type LockedMediaAttachment = LockedImageAttachment | LockedVideoAttachment;

/**
 * Post with full access - all content is visible
 */
export interface UnlockedPostResponse {
    _id: Types.ObjectId | string;
    creatorId: Types.ObjectId | string | { _id: Types.ObjectId | string; displayName?: string; username?: string; avatarUrl?: string | null };
    pageId: Types.ObjectId | string;
    postType: 'text' | 'image' | 'video';
    caption: string;
    mediaAttachments: MediaAttachment[];
    visibility: PostVisibility;
    status: 'draft' | 'scheduled' | 'published';
    tags: string[];
    publishedAt: Date | null;
    scheduledFor: Date | null;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    allowComments: boolean;
    isPinned: boolean;
    createdAt: Date;
    updatedAt: Date;
    isLocked: false;
}

/**
 * Post with locked access - sensitive content is redacted
 */
export interface LockedPostResponse {
    _id: Types.ObjectId | string;
    creatorId: Types.ObjectId | string | { _id: Types.ObjectId | string; displayName?: string; username?: string; avatarUrl?: string | null };
    pageId: Types.ObjectId | string;
    postType: 'text' | 'image' | 'video';
    caption: null;                      // Redacted
    teaser: string;                     // Short preview or static message
    mediaAttachments: LockedMediaAttachment[];
    visibility: PostVisibility;
    status: 'draft' | 'scheduled' | 'published';
    tags: string[];
    publishedAt: Date | null;
    scheduledFor: Date | null;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    allowComments: boolean;
    isPinned: boolean;
    createdAt: Date;
    updatedAt: Date;
    isLocked: true;
}

export type SanitizedPost = UnlockedPostResponse | LockedPostResponse;

// ============================================================================
// ACCESS DECISION LOGIC
// ============================================================================

/**
 * Determines if a user has access to view the full content of a post.
 */
export function hasAccessToPost(
    post: Pick<IPost, 'visibility' | 'creatorId'>,
    ctx: AccessContext
): boolean {
    // Owners always have access
    if (ctx.isOwner) return true;

    // Public posts are accessible to everyone
    if (post.visibility === 'public') return true;

    // Members-only posts require active membership
    if (post.visibility === 'members' && ctx.isMember) return true;

    return false;
}

// ============================================================================
// CONTENT SANITIZATION
// ============================================================================

/**
 * Generates a teaser from the caption.
 * Returns first 80 characters or a static message if no caption.
 */
function generateTeaser(caption: string | null | undefined): string {
    if (!caption || caption.trim().length === 0) {
        return 'Exclusive content for members only';
    }
    const maxLength = 80;
    return caption.length > maxLength
        ? caption.substring(0, maxLength).trim() + '...'
        : caption;
}

/**
 * Sanitizes a media attachment for locked content.
 * Removes original URLs and provides blurred previews.
 */
function sanitizeLockedMedia(attachment: MediaAttachment): LockedMediaAttachment {
    if (attachment.type === 'image') {
        const imageAtt = attachment as ImageAttachment;
        return {
            type: 'image',
            url: null,
            thumbnailUrl: generateBlurredImageUrl(imageAtt.cloudinaryPublicId),
            filename: attachment.filename,
            fileSize: attachment.fileSize,
            mimeType: attachment.mimeType,
            dimensions: attachment.dimensions,
        };
    }

    // Video attachment
    const videoAtt = attachment as VideoAttachment;
    return {
        type: 'video',
        url: null,
        thumbnailUrl: generateBlurredVideoThumbnail(videoAtt.muxPlaybackId),
        filename: attachment.filename,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        dimensions: attachment.dimensions,
        muxPlaybackId: null,
        muxAssetId: null,
        duration: videoAtt.duration,
        status: videoAtt.status,
    };
}

// ============================================================================
// MAIN SANITIZATION FUNCTION
// ============================================================================

/**
 * Sanitizes a post for client response based on access context.
 * 
 * If the user has access, returns the full post.
 * If locked, redacts sensitive content (caption, media URLs) and provides
 * blurred previews instead.
 * 
 * @param post - The raw post document (plain object or mongoose document)
 * @param ctx - The access context for the current user
 * @returns Sanitized post with isLocked flag
 */
export function sanitizePostForClient(
    post: IPost | Record<string, unknown>,
    ctx: AccessContext
): SanitizedPost {
    // Handle both mongoose documents and plain objects
    const postData = 'toObject' in post && typeof post.toObject === 'function'
        ? post.toObject()
        : post;

    // Build the base post structure (common fields)
    const basePost = {
        _id: postData._id,
        creatorId: postData.creatorId,
        pageId: postData.pageId,
        postType: postData.postType,
        visibility: postData.visibility,
        status: postData.status,
        tags: postData.tags || [],
        publishedAt: postData.publishedAt,
        scheduledFor: postData.scheduledFor,
        viewCount: postData.viewCount || 0,
        likeCount: postData.likeCount || 0,
        commentCount: postData.commentCount || 0,
        allowComments: postData.allowComments ?? true,
        isPinned: postData.isPinned ?? false,
        createdAt: postData.createdAt,
        updatedAt: postData.updatedAt,
    };

    // Access decision
    const postForAccessCheck = {
        visibility: postData.visibility as PostVisibility,
        creatorId: postData.creatorId,
    };
    const hasAccess = hasAccessToPost(postForAccessCheck, ctx);

    if (hasAccess) {
        // Full access - return unredacted content
        return {
            ...basePost,
            caption: postData.caption || '',
            mediaAttachments: postData.mediaAttachments || [],
            isLocked: false,
        } as UnlockedPostResponse;
    }

    // Locked - redact sensitive content
    const lockedMedia = (postData.mediaAttachments || []).map(
        (att: MediaAttachment) => sanitizeLockedMedia(att)
    );

    return {
        ...basePost,
        caption: null,
        teaser: generateTeaser(postData.caption),
        mediaAttachments: lockedMedia,
        isLocked: true,
    } as LockedPostResponse;
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Sanitizes multiple posts with a membership lookup map for efficiency.
 * 
 * @param posts - Array of posts to sanitize
 * @param userId - Current user's ID (or null if unauthenticated)
 * @param membershipMap - Map of creatorId -> boolean (has active membership)
 * @returns Array of sanitized posts
 */
export function sanitizePostsForClient(
    posts: (IPost | Record<string, unknown>)[],
    userId: string | null,
    membershipMap: Map<string, boolean>
): SanitizedPost[] {
    return posts.map(post => {
        const postData = 'toObject' in post && typeof post.toObject === 'function'
            ? post.toObject()
            : post;

        // Extract creator ID (handle populated vs non-populated)
        const creatorId = typeof postData.creatorId === 'object' && postData.creatorId?._id
            ? postData.creatorId._id.toString()
            : postData.creatorId?.toString() || '';

        const ctx: AccessContext = {
            userId,
            isOwner: userId !== null && userId === creatorId,
            isMember: membershipMap.get(creatorId) ?? false,
        };

        return sanitizePostForClient(post, ctx);
    });
}
