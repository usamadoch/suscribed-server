import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { conversationService } from '../services/conversationService.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { Server as SocketIOServer } from 'socket.io';

// Get user's conversations
export const getConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const result = await conversationService.getConversations(req.user._id, page, limit);

        res.json({
            success: true,
            data: { conversations: result.conversations },
            meta: { pagination: result.pagination },
        });
    } catch (error) {
        next(error);
    }
};

// Start or get existing conversation
export const createConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { recipientId } = req.body;
        const result = await conversationService.createConversation(req.user._id, recipientId);

        const statusCode = result.isNew ? 201 : 200;
        res.status(statusCode).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// Get conversation messages
export const getConversationMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const limit = Number(req.query.limit) || 20;
        const cursor = req.query.cursor as string | undefined;
        const conversationId = String(req.params.id);

        const result = await conversationService.getConversationMessages(conversationId, req.user._id, limit, cursor);

        res.json({
            success: true,
            data: { messages: result.messages, nextCursor: result.nextCursor },
            meta: { pagination: result.pagination },
        });
    } catch (error) {
        next(error);
    }
};

// Send message
// NOTE: This handler retains direct model access for the socket.io participant-finding logic.
// A full extraction would require reworking the conversation model queries, deferred to keep things safe.
export const sendMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user._id;
        const conversationId = String(req.params.id);

        // Verify user is participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
        }).select('participants');

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
            io.to(`conversation:${conversationId}`).emit('new_message', message);
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
        const io: SocketIOServer | undefined = req.app.get('io');
        const message = await conversationService.markMessageAsRead(
            String(req.params.conversationId),
            String(req.params.messageId),
            req.user._id,
            io
        );

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
        const count = await conversationService.getUnreadMessageCount(req.user._id);
        res.json({ success: true, data: { count } });
    } catch (error) {
        next(error);
    }
};
