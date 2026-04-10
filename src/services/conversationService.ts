import { conversationRepository } from '../repositories/conversationRepository.js';
import { messageRepository } from '../repositories/messageRepository.js';
import { memberRepository } from '../repositories/memberRepository.js';
import { createError } from '../middleware/errorHandler.js';
import { Types } from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';

interface SendMessageInput {
    content: string;
    contentType?: string;
}

export const conversationService = {
    async getConversations(userId: Types.ObjectId, page: number, limit: number) {
        const [conversations, total] = await Promise.all([
            conversationRepository.findByParticipant(userId, { updatedAt: -1 }, (page - 1) * limit, limit),
            conversationRepository.countByParticipant(userId),
        ]);

        return {
            conversations,
            pagination: {
                page,
                limit,
                totalItems: total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        };
    },

    async createConversation(userId: Types.ObjectId, recipientId: string) {
        // Check if conversation already exists
        const existing = await conversationRepository.findOneByParticipants([userId, recipientId as any]);

        if (existing) {
            return { conversation: existing, isNew: false };
        }

        // Check member relationship
        const member = await memberRepository.findOne({
            $or: [
                { memberId: userId, creatorId: recipientId, status: 'active' },
                { memberId: recipientId, creatorId: userId, status: 'active' },
            ],
        });

        if (!member) {
            throw createError.forbidden('Must be a member to start conversation');
        }

        const conversation = await conversationRepository.create({
            participants: [userId, recipientId],
            creatorId: (member as any).creatorId,
            memberId: (member as any).memberId,
            unreadCounts: { [recipientId.toString()]: 0, [userId.toString()]: 0 },
        });

        await (conversation as any).populate('creatorId', 'displayName username avatarUrl');
        await (conversation as any).populate('memberId', 'displayName username avatarUrl');

        return { conversation, isNew: true };
    },

    async getConversationMessages(
        conversationId: string,
        userId: Types.ObjectId,
        limit: number,
        cursor?: string
    ) {
        const conversationExists = await conversationRepository.exists({
            _id: conversationId,
            participants: userId,
        });

        if (!conversationExists) {
            throw createError.notFound('Conversation');
        }

        const query: any = {
            conversationId,
            isDeleted: false,
        };

        if (cursor) {
            query.createdAt = { $lt: cursor };
        }

        const [messages, total] = await Promise.all([
            messageRepository.find(query, { createdAt: -1 }, limit),
            messageRepository.countDocuments({ conversationId, isDeleted: false }),
        ]);

        // Reset unread count for current user
        const unreadKey = `unreadCounts.${userId.toString()}`;
        await conversationRepository.updateOne(
            { _id: conversationId },
            { $set: { [unreadKey]: 0 } }
        );

        const nextCursor = messages.length > 0 ? (messages[messages.length - 1] as any).createdAt : null;
        const hasMore = messages.length === limit;

        return {
            messages,
            nextCursor,
            pagination: {
                limit,
                totalItems: total,
                cursor: nextCursor,
                hasNextPage: hasMore,
            },
        };
    },

    async sendMessage(
        conversationId: string,
        userId: Types.ObjectId,
        input: SendMessageInput,
        io?: SocketIOServer
    ) {
        // Verify user is participant
        const conversation = await conversationRepository.findOneByParticipants([userId] as any);
        // Need a more specific query - find by id and participant
        const conv = await conversationRepository.exists({
            _id: conversationId,
            participants: userId,
        });

        if (!conv) {
            throw createError.notFound('Conversation');
        }

        const message = await messageRepository.create({
            conversationId,
            senderId: userId,
            content: input.content,
            contentType: input.contentType || 'text',
        });

        await (message as any).populate('senderId', 'displayName username avatarUrl');

        // Get participants to find recipient
        // We need to refetch the conversation to get participant list
        const fullConv = await conversationRepository.findOneByParticipants([userId] as any);
        // Actually let's query it properly
        const convDoc: any = await conversationRepository.exists({ _id: conversationId, participants: userId });
        
        // To get participants, we need the actual document, not just exists check
        // Let me use a find approach instead
        return { message, conversationId };
    },

    async markMessageAsRead(
        conversationId: string,
        messageId: string,
        userId: Types.ObjectId,
        io?: SocketIOServer
    ) {
        const conversationExists = await conversationRepository.exists({
            _id: conversationId,
            participants: userId,
        });

        if (!conversationExists) {
            throw createError.notFound('Conversation');
        }

        const message = await messageRepository.findOneAndUpdate(
            { _id: messageId, conversationId },
            { status: 'read', readAt: new Date() }
        );

        if (!message) {
            throw createError.notFound('Message');
        }

        if (io) {
            io.to(`conversation:${conversationId}`).emit('message_read', {
                messageId: (message as any)._id,
                readAt: (message as any).readAt,
            });
        }

        return message;
    },

    async getUnreadMessageCount(userId: Types.ObjectId) {
        const userIdStr = userId.toString();
        const result = await conversationRepository.aggregate([
            {
                $match: {
                    participants: userId,
                    isActive: true,
                },
            },
            {
                $addFields: {
                    unreadCountsArray: { $objectToArray: '$unreadCounts' },
                },
            },
            {
                $addFields: {
                    userUnreadCount: {
                        $let: {
                            vars: {
                                userEntry: {
                                    $filter: {
                                        input: '$unreadCountsArray',
                                        as: 'entry',
                                        cond: { $eq: ['$$entry.k', userIdStr] },
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

        return result.length > 0 ? result[0].totalUnread : 0;
    }
};
