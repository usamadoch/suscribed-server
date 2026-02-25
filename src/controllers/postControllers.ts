import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../types/index.js';
import Post from '../models/Post.js';
import PostLike from '../models/PostLike.js';
import PostView from '../models/PostView.js';
import Comment from '../models/Comment.js';
import CreatorPage from '../models/CreatorPage.js';
import Membership from '../models/Membership.js';
import { NotificationService } from '../services/notificationService.js';
import { cloudinaryService } from '../services/media/cloudinaryService.js';
import { muxService } from '../services/media/muxService.js';
import { sanitizePostForClient, sanitizePostsForClient, AccessContext } from '../utils/postAccessControl.js';


// Get creator's own posts (dashboard — lean projection, no sanitization needed)
export const getMyPosts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const creatorPage = await CreatorPage.findOne({ userId: req.user._id }).select('_id');
        if (!creatorPage) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Creator page not found' },
            });
            return;
        }

        const query = { pageId: creatorPage._id, status: 'published' as const };

        const posts = await Post.find(query)
            .select('_id caption postType mediaAttachments.type mediaAttachments.url viewCount likeCount commentCount visibility publishedAt createdAt')
            .sort({ isPinned: -1, createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        const total = await Post.countDocuments(query);

        res.json({
            success: true,
            data: { posts },
            meta: {
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    totalItems: total,
                    totalPages: Math.ceil(total / Number(limit)),
                    hasNextPage: Number(page) * Number(limit) < total,
                    hasPrevPage: Number(page) > 1,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get creator's posts for public page (with access control + lean projection)
export const getCreatorPosts = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { pageSlug, limit = 100, type } = req.query;

        if (!pageSlug) {
            res.status(400).json({
                success: false,
                error: { code: 'BAD_REQUEST', message: 'pageSlug is required' },
            });
            return;
        }

        const creatorPage = await CreatorPage.findOne({ pageSlug: String(pageSlug).toLowerCase() }).select('_id');
        if (!creatorPage) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Creator page not found' },
            });
            return;
        }

        const query: Record<string, unknown> = {
            pageId: creatorPage._id,
            status: 'published',
        };

        if (type) {
            const types = String(type).split(',');
            if (types.length === 1) {
                query.postType = types[0];
            } else {
                query.postType = { $in: types };
            }
        }

        const posts = await Post.find(query)
            .select('_id caption postType visibility viewCount likeCount commentCount creatorId createdAt isPinned mediaAttachments.type mediaAttachments.url mediaAttachments.thumbnailUrl mediaAttachments.duration mediaAttachments.cloudinaryPublicId mediaAttachments.muxPlaybackId mediaAttachments.filename mediaAttachments.fileSize mediaAttachments.mimeType mediaAttachments.dimensions mediaAttachments.status')
            .sort({ isPinned: -1, createdAt: -1 })
            .limit(Number(limit));

        // Build membership map for access checking
        const membershipMap = new Map<string, boolean>();
        const likedPostIds = new Set<string>();

        if (req.user) {
            const creatorIds = [...new Set(posts.map(p => {
                const cId = p.creatorId;
                return typeof cId === 'object' && cId._id
                    ? cId._id.toString()
                    : cId.toString();
            }))];

            const memberships = await Membership.find({
                memberId: req.user._id,
                creatorId: { $in: creatorIds },
                status: 'active',
            }).select('creatorId');

            memberships.forEach(m => {
                membershipMap.set(m.creatorId.toString(), true);
            });

            const likes = await PostLike.find({
                userId: req.user._id,
                postId: { $in: posts.map(p => p._id) }
            }).select('postId');

            likes.forEach(like => {
                likedPostIds.add(like.postId.toString());
            });
        }

        // Sanitize posts based on access
        const sanitizedPosts = sanitizePostsForClient(
            posts,
            req.user?._id?.toString() || null,
            membershipMap
        );

        // Augment with isLiked status
        const postsWithLikes = sanitizedPosts.map(post => ({
            ...post,
            isLiked: likedPostIds.has(post._id.toString())
        }));

        res.json({
            success: true,
            data: { posts: postsWithLikes },
        });
    } catch (error) {
        next(error);
    }
};

// Get single post
export const getPostById = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('creatorId', 'displayName username avatarUrl')
            .populate('pageId', 'pageSlug displayName avatarUrl');

        if (!post) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Post not found' },
            });
            return;
        }

        // Extract creator ID (handle populated vs non-populated)
        const creatorId = typeof post.creatorId === 'object' && post.creatorId._id
            ? post.creatorId._id.toString()
            : post.creatorId.toString();

        // Build access context
        const userId = req.user?._id?.toString() || null;
        const isOwner = userId !== null && userId === creatorId;

        // Check membership for member-only posts
        let isMember = false;
        if (post.visibility === 'members' && !isOwner && req.user) {
            const hasMembership = await Membership.exists({
                memberId: req.user._id,
                creatorId: creatorId,
                status: 'active',
            });
            isMember = !!hasMembership;
        }

        const ctx: AccessContext = { userId, isOwner, isMember };

        // Track view (always, even for locked posts)
        const sessionId = req.cookies?.sessionId || req.ip || 'anonymous';

        const [_, __, likeExists] = await Promise.all([
            PostView.updateOne(
                { postId: post._id, sessionId },
                {
                    $set: { viewedAt: new Date() },
                    $setOnInsert: { userId: req.user?._id || null },
                },
                { upsert: true }
            ),
            Post.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } }),
            req.user ? PostLike.exists({ postId: post._id, userId: req.user._id }) : Promise.resolve(null)
        ]);

        const isLiked = !!likeExists;

        // Sanitize the post based on access
        const sanitizedPost = sanitizePostForClient(post, ctx);

        res.json({
            success: true,
            data: {
                post: { ...sanitizedPost, viewCount: (post.viewCount || 0) + 1, isLiked },
                isLiked,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Create post (creator only)
export const createPost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const creatorPage = await CreatorPage.findOne({ userId: req.user._id }).select('_id displayName');

        if (!creatorPage) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Creator page not found' },
            });
            return;
        }

        const attachments = req.body.mediaAttachments || [];
        // Check for Mux uploads that might be ready
        for (const attachment of attachments) {
            if (attachment.type === 'video' && attachment.muxUploadId && !attachment.url) {
                try {
                    const upload = await muxService.getUpload(attachment.muxUploadId);
                    if (upload && upload.status === 'asset_created' && upload.asset_id) {
                        const asset = await muxService.getAsset(upload.asset_id);
                        if (asset.status === 'ready') {
                            attachment.status = 'ready';
                            attachment.muxAssetId = asset.id;
                            attachment.duration = asset.duration;

                            const playbackId = asset.playback_ids?.[0]?.id;
                            if (playbackId) {
                                attachment.muxPlaybackId = playbackId;
                                attachment.url = `https://stream.mux.com/${playbackId}.m3u8`;
                                attachment.thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.png`;
                            }

                            if (asset.tracks && Array.isArray(asset.tracks)) {
                                interface MuxTrack {
                                    type: string;
                                    width?: number;
                                    height?: number;
                                    max_width?: number;
                                    max_height?: number;
                                }
                                const videoTrack = (asset.tracks as MuxTrack[]).find(t => t.type === 'video');
                                if (videoTrack) {
                                    const width = videoTrack.width || videoTrack.max_width;
                                    const height = videoTrack.height || videoTrack.max_height;
                                    if (width && height) {
                                        attachment.dimensions = { width, height };
                                    }
                                }
                            }
                        } else if (asset.status === 'errored') {
                            attachment.status = 'errored';
                        }
                    }
                } catch (muxError) {
                    console.error('Error pre-fetching Mux asset:', muxError);
                    // Continue with default creation if Mux check fails
                }
            }
        }

        const post = await Post.create({
            ...req.body,
            mediaAttachments: attachments,
            creatorId: req.user._id,
            pageId: creatorPage._id,
            publishedAt: req.body.status === 'published' ? new Date() : null,
        });

        // Update post count
        if (post.status === 'published') {
            await CreatorPage.updateOne(
                { _id: creatorPage._id },
                { $inc: { postCount: 1 } }
            );

            // Notify all members about the new post
            const memberships = await Membership.find({
                creatorId: req.user._id,
                status: 'active',
            }).select('memberId');

            if (memberships.length > 0) {
                const recipientIds = memberships.map(m => m.memberId.toString());

                await NotificationService.sendMassNotification(
                    recipientIds,
                    'new_post',
                    'New post!',
                    `${creatorPage.displayName} posted: ${post.caption ? post.caption.substring(0, 80) + (post.caption.length > 80 ? '...' : '') : 'Active check it out!'}`,
                    {
                        actionUrl: `/posts/${post._id}`,
                        actionLabel: 'View post',
                        metadata: { postId: post._id, creatorId: req.user._id },
                        io: req.app.get('io')
                    }
                );
            }
        }

        res.status(201).json({
            success: true,
            data: { post },
        });
    } catch (error) {
        next(error);
    }
};

// Update post
export const updatePost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await Post.findOne({ _id: req.params.id, creatorId: req.user._id });

        if (!post) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Post not found' },
            });
            return;
        }

        const wasPublished = post.status === 'published';
        Object.assign(post, req.body);

        // If publishing for first time
        if (!wasPublished && post.status === 'published') {
            post.publishedAt = new Date();
            const page = await CreatorPage.findById(post.pageId).select('_id displayName');
            if (page) {
                await CreatorPage.updateOne({ _id: page._id }, { $inc: { postCount: 1 } });

                // Notify all members about the new post
                const memberships = await Membership.find({
                    creatorId: req.user._id,
                    status: 'active',
                }).select('memberId');

                if (memberships.length > 0) {
                    const recipientIds = memberships.map(m => m.memberId.toString());

                    await NotificationService.sendMassNotification(
                        recipientIds,
                        'new_post',
                        'New post!',
                        `${page.displayName} posted: ${post.caption ? post.caption.substring(0, 80) + (post.caption.length > 80 ? '...' : '') : 'Active check it out!'}`,
                        {
                            actionUrl: `/posts/${post._id}`,
                            actionLabel: 'View post',
                            metadata: { postId: post._id, creatorId: req.user._id },
                            io: req.app.get('io')
                        }
                    );
                }
            }
        }

        await post.save();

        res.json({
            success: true,
            data: { post },
        });
    } catch (error) {
        next(error);
    }
};

// Delete post
export const deletePost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await Post.findOneAndDelete({ _id: req.params.id, creatorId: req.user._id });

        if (!post) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Post not found' },
            });
            return;
        }

        // Update post count
        if (post.status === 'published') {
            await CreatorPage.updateOne({ _id: post.pageId }, { $inc: { postCount: -1 } });
        }

        // Delete related data first (comments, likes, views)
        await Promise.all([
            PostLike.deleteMany({ postId: post._id }),
            PostView.deleteMany({ postId: post._id }),
            Comment.deleteMany({ postId: post._id }),
        ]);

        // Cleanup media assets
        // We do this non-blocking or concurrently so it doesn't fail the request if something slips
        if (post.mediaAttachments && post.mediaAttachments.length > 0) {
            post.mediaAttachments.forEach(attachment => {
                if (attachment.type === 'image' && attachment.cloudinaryPublicId) {
                    cloudinaryService.deleteImage(attachment.cloudinaryPublicId);
                } else if (attachment.type === 'video' && attachment.muxAssetId) {
                    muxService.deleteAsset(attachment.muxAssetId);
                }
            });
        }

        res.json({
            success: true,
            data: { message: 'Post deleted successfully' },
        });
    } catch (error) {
        next(error);
    }
};

// Like / Unlike post (idempotent — safe against race conditions & double-clicks)
export const toggleLikePost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;

        const existingLike = await PostLike.exists({ postId, userId });

        if (existingLike) {
            // Unlike — only decrement if we actually deleted a record
            const deleted = await PostLike.findOneAndDelete({ postId, userId });
            if (deleted) {
                // Guard: never decrement below 0
                await Post.updateOne(
                    { _id: postId, likeCount: { $gt: 0 } },
                    { $inc: { likeCount: -1 } }
                );
            }

            const post = await Post.findById(postId).select('likeCount');
            res.json({
                success: true,
                data: { liked: false, likeCount: post?.likeCount ?? 0 },
            });
        } else {
            // Like — use try/catch to handle duplicate key (idempotent)
            let isNewLike = false;
            try {
                await PostLike.create({ postId, userId });
                isNewLike = true;
            } catch (err: any) {
                // Duplicate key error (11000) means already liked — no-op
                if (err.code !== 11000) throw err;
            }

            let post;
            if (isNewLike) {
                post = await Post.findByIdAndUpdate(
                    postId,
                    { $inc: { likeCount: 1 } },
                    { new: true }
                );
            } else {
                post = await Post.findById(postId).select('likeCount creatorId');
            }

            // Notify creator (only for genuinely new likes)
            if (isNewLike && post && post.creatorId.toString() !== userId.toString()) {
                await NotificationService.sendNotification(
                    post.creatorId.toString(),
                    'post_liked',
                    'Post liked',
                    `${req.user.displayName} liked your post`,
                    {
                        actionUrl: `/posts/${postId}`,
                        actionLabel: 'View post',
                        metadata: { postId, userId },
                        io: req.app.get('io')
                    }
                );
            }

            res.json({
                success: true,
                data: { liked: true, likeCount: post?.likeCount ?? 0 },
            });
        }
    } catch (error) {
        next(error);
    }
};

// Get comments
export const getPostComments = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const post = await Post.findById(req.params.id).select('visibility status creatorId');

        if (!post) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Post not found' },
            });
            return;
        }

        // Check access for members-only posts
        if (post.visibility === 'members' && post.status === 'published') {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Authentication required to view comments' },
                });
                return;
            }

            const isOwner = req.user._id.toString() === post.creatorId.toString();

            if (!isOwner) {
                const membership = await Membership.findOne({
                    memberId: req.user._id,
                    creatorId: post.creatorId,
                    status: 'active',
                });

                if (!membership) {
                    res.status(403).json({
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Members only content' },
                    });
                    return;
                }
            }
        }

        const comments = await Comment.find({
            postId: req.params.id,
            parentId: null,
            isHidden: false,
        })
            .populate('authorId', 'displayName username avatarUrl')
            .sort({ isPinned: -1, createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await Comment.countDocuments({
            postId: req.params.id,
            parentId: null,
            isHidden: false,
        });

        res.json({
            success: true,
            data: { comments },
            meta: {
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    totalItems: total,
                    totalPages: Math.ceil(total / Number(limit)),
                    hasNextPage: Number(page) * Number(limit) < total,
                    hasPrevPage: Number(page) > 1,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Add comment
export const addPostComment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Post not found' },
            });
            return;
        }

        if (!post.allowComments) {
            res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Comments are disabled for this post' },
            });
            return;
        }

        let depth = 0;
        if (req.body.parentId) {
            const parent = await Comment.findById(req.body.parentId);
            if (parent) {
                depth = Math.min(parent.depth + 1, 3);
            }
        }

        const comment = await Comment.create({
            postId: req.params.id,
            authorId: req.user._id,
            content: req.body.content,
            parentId: req.body.parentId || null,
            depth,
        });

        // Update reply count on parent
        if (req.body.parentId) {
            await Comment.updateOne(
                { _id: req.body.parentId },
                { $inc: { replyCount: 1 } }
            );
        }

        // Update comment count on post
        await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });

        // Notify post creator
        if (post.creatorId.toString() !== req.user._id.toString()) {
            await NotificationService.sendNotification(
                post.creatorId.toString(),
                'new_comment',
                'New comment',
                `${req.user.displayName} commented on your post`,
                {
                    actionUrl: `/posts/${post._id}#comment-${comment._id}`,
                    actionLabel: 'View comment',
                    metadata: { postId: post._id, commentId: comment._id },
                    io: req.app.get('io')
                }
            );
        }

        await comment.populate('authorId', 'displayName username avatarUrl');

        res.status(201).json({
            success: true,
            data: { comment },
        });
    } catch (error) {
        next(error);
    }
};

// Get recent videos for a creator page
export const getRecentVideos = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { pageSlug, limit = 5 } = req.query;

        if (!pageSlug) {
            res.status(400).json({
                success: false,
                error: { code: 'BAD_REQUEST', message: 'pageSlug is required' },
            });
            return;
        }

        const creatorPage = await CreatorPage.findOne({ pageSlug: String(pageSlug).toLowerCase() }).select('_id');
        if (!creatorPage) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Creator page not found' },
            });
            return;
        }

        const query = {
            pageId: creatorPage._id,
            postType: 'video',
            status: 'published'
        };

        // Fetch only required fields, excluding sensitive video URLs
        const posts = await Post.find(query)
            .select('caption teaser mediaAttachments.thumbnailUrl mediaAttachments.duration mediaAttachments.type publishedAt createdAt _id')
            .sort({ publishedAt: -1, createdAt: -1 })
            .limit(Number(limit));

        res.json({
            success: true,
            data: { posts },
        });
    } catch (error) {
        next(error);
    }
};
