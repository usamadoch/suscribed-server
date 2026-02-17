import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Membership from '../models/Membership.js';
import { Server as SocketIOServer } from 'socket.io';

// Get user's conversations
export const getConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId,
            isActive: true,
        })
            .populate('creatorId', 'displayName username avatarUrl')
            .populate('memberId', 'displayName username avatarUrl')
            .sort({ updatedAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await Conversation.countDocuments({
            participants: userId,
            isActive: true,
        });

        res.json({
            success: true,
            data: { conversations },
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

// Start or get existing conversation
export const createConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { recipientId } = req.body;
        const userId = req.user._id;

        // Check if conversation already exists
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, recipientId] },
        });

        if (conversation) {
            res.json({
                success: true,
                data: { conversation, isNew: false },
            });
            return;
        }

        // Check membership relationship
        const membership = await Membership.findOne({
            $or: [
                { memberId: userId, creatorId: recipientId, status: 'active' },
                { memberId: recipientId, creatorId: userId, status: 'active' },
            ],
        });

        if (!membership) {
            res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Must be a member to start conversation' },
            });
            return;
        }

        // Create new conversation
        conversation = await Conversation.create({
            participants: [userId, recipientId],
            creatorId: membership.creatorId,
            memberId: membership.memberId,
            unreadCounts: { [recipientId.toString()]: 0, [userId.toString()]: 0 },
        });

        await conversation.populate('creatorId', 'displayName username avatarUrl');
        await conversation.populate('memberId', 'displayName username avatarUrl');

        res.status(201).json({
            success: true,
            data: { conversation, isNew: true },
        });
    } catch (error) {
        next(error);
    }
};

// Get conversation messages
export const getConversationMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page, limit = 20, cursor } = req.query;
        const userId = req.user._id;

        // Verify user is participant
        const conversation = await Conversation.findOne({
            _id: req.params.id,
            participants: userId,
        });

        if (!conversation) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Conversation not found' },
            });
            return;
        }

        const query: any = {
            conversationId: req.params.id,
            isDeleted: false,
        };

        if (cursor) {
            query.createdAt = { $lt: cursor };
        }

        const messages = await Message.find(query)
            .populate('senderId', 'displayName username avatarUrl')
            .sort({ createdAt: -1 })
            .limit(Number(limit));

        const total = await Message.countDocuments({
            conversationId: req.params.id,
            isDeleted: false,
        });

        // Reset unread count for current user
        const unreadKey = `unreadCounts.${userId.toString()}`;
        await Conversation.updateOne(
            { _id: req.params.id },
            { $set: { [unreadKey]: 0 } }
        );

        const nextCursor = messages.length > 0 ? messages[messages.length - 1].createdAt : null;
        const hasMore = messages.length === Number(limit);

        res.json({
            success: true,
            data: {
                messages, // Returns Newest -> Oldest
                nextCursor
            },
            meta: {
                pagination: {
                    limit: Number(limit),
                    totalItems: total,
                    cursor: nextCursor,
                    hasNextPage: hasMore
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Send message
export const sendMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user._id;
        const conversationId = req.params.id as string;

        // Verify user is participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
        });

        if (!conversation) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Conversation not found' },
            });
            return;
        }

        // Create message
        const message = await Message.create({
            conversationId,
            senderId: userId,
            content: req.body.content,
            contentType: req.body.contentType || 'text',
        });

        await message.populate('senderId', 'displayName username avatarUrl');

        // Update conversation
        const recipientId = conversation.participants.find(
            (p) => p.toString() !== userId.toString()
        );
        const unreadKey = `unreadCounts.${recipientId?.toString()}`;

        await Conversation.updateOne(
            { _id: conversationId },
            {
                $set: {
                    lastMessage: {
                        content: req.body.content,
                        senderId: userId,
                        sentAt: new Date(),
                    },
                },
                $inc: { [unreadKey]: 1 },
            }
        );

        // Emit socket event for real-time updates (if socket server is available)
        const io: SocketIOServer | undefined = req.app.get('io');
        if (io) {
            // Emit to conversation room for real-time message display
            io.to(`conversation:${conversationId}`).emit('new_message', message);
            // Emit to recipient's user room for unread count update in sidebar
            io.to(`user:${recipientId?.toString()}`).emit('new_message_notification', {
                conversationId,
                message,
            });
        }

        // NOTE: No push notification for messages - sidebar unread badge is sufficient

        res.status(201).json({
            success: true,
            data: { message },
        });
    } catch (error) {
        next(error);
    }
};

// Mark message as read
export const markMessageAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user._id;

        // Verify user is participant in conversation
        const conversation = await Conversation.findOne({
            _id: req.params.conversationId,
            participants: userId,
        });

        if (!conversation) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Conversation not found' },
            });
            return;
        }

        // Verify message belongs to this conversation
        const message = await Message.findOneAndUpdate(
            {
                _id: req.params.messageId,
                conversationId: req.params.conversationId,
            },
            { status: 'read', readAt: new Date() },
            { new: true }
        );

        if (!message) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Message not found' },
            });
            return;
        }

        // Emit socket event (if socket server is available)
        const io: SocketIOServer | undefined = req.app.get('io');
        if (io) {
            io.to(`conversation:${req.params.conversationId}`).emit('message_read', {
                messageId: message._id,
                readAt: message.readAt,
            });
        }

        res.json({
            success: true,
            data: { message },
        });
    } catch (error) {
        next(error);
    }
};

// Get total unread message count across all conversations
export const getUnreadMessageCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user._id.toString();

        // Aggregate unread counts from all user's conversations
        // unreadCounts is stored as a Map, so we need to convert and filter
        const result = await Conversation.aggregate([
            {
                $match: {
                    participants: req.user._id,
                    isActive: true,
                },
            },
            {
                // Convert the Map to an array of key-value pairs
                $addFields: {
                    unreadCountsArray: { $objectToArray: '$unreadCounts' },
                },
            },
            {
                // Find the unread count for this specific user
                $addFields: {
                    userUnreadCount: {
                        $let: {
                            vars: {
                                userEntry: {
                                    $filter: {
                                        input: '$unreadCountsArray',
                                        as: 'entry',
                                        cond: { $eq: ['$$entry.k', userId] },
                                    },
                                },
                            },
                            in: {
                                $ifNull: [
                                    { $arrayElemAt: ['$$userEntry.v', 0] },
                                    0,
                                ],
                            },
                        },
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalUnread: { $sum: '$userUnreadCount' },
                },
            },
        ]);

        const totalUnread = result.length > 0 ? result[0].totalUnread : 0;

        res.json({
            success: true,
            data: { count: totalUnread },
        });
    } catch (error) {
        next(error);
    }
};
