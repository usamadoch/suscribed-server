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

// Get posts (with filters)
export const getPosts = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            creatorId,
            pageSlug,
            status = 'published',
            page = 1,
            limit = 10,
            visibility,
        } = req.query;

        const query: Record<string, unknown> = { status };

        if (creatorId) {
            query.creatorId = creatorId;
        }

        if (pageSlug) {
            const creatorPage = await CreatorPage.findOne({ pageSlug: String(pageSlug).toLowerCase() });
            if (creatorPage) {
                query.pageId = creatorPage._id;
            }
        }

        // Handle visibility based on membership
        if (visibility === 'members' && req.user && query.creatorId) {
            // Check membership
            const membership = await Membership.findOne({
                memberId: req.user._id, // Safe access: req.user is guarded
                creatorId: String(query.creatorId),
                status: 'active',
            });

            if (!membership) {
                query.visibility = 'public';
            }
        } else if (visibility === 'members' && !req.user) {
            // Unauthenticated user requesting members-only posts
            res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
            });
            return;
        } else if (!req.user || visibility === 'public') {
            query.visibility = 'public';
        }

        // Temporary simplification: if no specific filters, show all published posts
        // In real app, this should filter by what the user follows/subscribes to

        // const posts = await Post.find(query)
        const posts = await Post.find({}) // Show everything for now to debug
            .populate('creatorId', 'displayName username avatarUrl')
            .sort({ isPinned: -1, createdAt: -1 }) // Sort by createdAt for now as publishedAt might be null
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        // const total = await Post.countDocuments(query);
        const total = await Post.countDocuments({});

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

// Get single post
export const getPostById = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('creatorId', 'displayName username avatarUrl');

        if (!post) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Post not found' },
            });
            return;
        }

        // Check access for members-only posts
        if (post.visibility === 'members' && post.status === 'published') {
            const isOwner = req.user?._id.toString() === post.creatorId._id.toString();

            if (!isOwner) {
                const membership = await Membership.findOne({
                    memberId: req.user?._id,
                    creatorId: post.creatorId._id,
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

        // Track view
        const sessionId = req.cookies?.sessionId || req.ip || 'anonymous';
        await PostView.updateOne(
            { postId: post._id, sessionId },
            {
                $set: { viewedAt: new Date() },
                $setOnInsert: { userId: req.user?._id || null }, // Optional access: req.user might be undefined
            },
            { upsert: true }
        );

        // Increment view count
        await Post.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } });

        // Check if user liked the post
        let isLiked = false;
        if (req.user) {
            const like = await PostLike.findOne({ postId: post._id, userId: req.user._id });
            isLiked = !!like;
        }

        res.json({
            success: true,
            data: { post: { ...post.toObject(), viewCount: post.viewCount + 1 }, isLiked },
        });
    } catch (error) {
        next(error);
    }
};

// Create post (creator only)
export const createPost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const creatorPage = await CreatorPage.findOne({ userId: req.user._id });

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
                                const videoTrack = asset.tracks.find((t: any) => t.type === 'video') as any;
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
            const page = await CreatorPage.findById(post.pageId);
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

// Like / Unlike post
export const toggleLikePost = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;

        const existingLike = await PostLike.findOne({ postId, userId });

        if (existingLike) {
            // Unlike
            await PostLike.deleteOne({ _id: existingLike._id });
            await Post.updateOne({ _id: postId }, { $inc: { likeCount: -1 } });

            res.json({
                success: true,
                data: { liked: false },
            });
        } else {
            // Like
            await PostLike.create({ postId, userId });
            const post = await Post.findByIdAndUpdate(
                postId,
                { $inc: { likeCount: 1 } },
                { new: true }
            );

            // Notify creator
            if (post && post.creatorId.toString() !== userId.toString()) {
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
                data: { liked: true },
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

        const post = await Post.findById(req.params.id);

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

        // Get replies for each comment
        const commentsWithReplies = await Promise.all(
            comments.map(async (comment) => {
                const replies = await Comment.find({
                    parentId: comment._id,
                    isHidden: false,
                })
                    .populate('authorId', 'displayName username avatarUrl')
                    .sort({ createdAt: 1 })
                    .limit(3);

                return { ...comment.toObject(), replies };
            })
        );

        const total = await Comment.countDocuments({
            postId: req.params.id,
            parentId: null,
            isHidden: false,
        });

        res.json({
            success: true,
            data: { comments: commentsWithReplies },
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
