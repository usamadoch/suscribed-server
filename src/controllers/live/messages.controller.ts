import { RequestHandler, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedRequest } from '../../types/index.js';
import { liveMessageService } from '../../services/liveMessageService.js';
import { liveSessionRepository } from '../../repositories/liveSession.repository.js';
import LiveChatMessage from '../../models/LiveChatMessage.js';
import PaidLiveMessage from '../../models/PaidLiveMessage.js';
import ChatMute from '../../models/ChatMute.js';
import { removeMessageFromHistory } from './shared.js';
import { createError } from '../../middleware/errorHandler.js';

export const initiatePaidMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const data = await liveMessageService.initiatePaidMessage(req.params.sessionId as string, req.body.amount, req.body.message, req.user);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const setupTracker = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const data = await liveMessageService.setupTracker(req.user);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const chargeSavedMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io: SocketIOServer = req.app.get('io');
        await liveMessageService.chargeSavedMessage(io, req.params.sessionId as string, req.params.msgId as string, req.body.paymentMethodToken, req.user);
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const confirmPaidMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io: SocketIOServer = req.app.get('io');
        await liveMessageService.confirmPaidMessage(io, req.params.sessionId as string, req.body.trackerToken, req.user);
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const listMessages: RequestHandler = (req, res) => { res.status(200).json({ message: 'ok' }); };
export const updateMessage: RequestHandler = (req, res) => { res.status(200).json({ message: 'ok' }); };
export const refundMessage: RequestHandler = (req, res) => { res.status(200).json({ message: 'ok' }); };

export const sendChatMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io: SocketIOServer = req.app.get('io');
        const payload = await liveMessageService.sendChatMessage(io, req.params.sessionId as string, req.body.message, req.user);
        res.status(201).json({ success: true, data: payload });
    } catch (error) {
        next(error);
    }
};

export const deleteChatMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const sessionId = req.params.sessionId as string;
        const msgId = req.params.msgId as string;
        const session = await liveSessionRepository.findById(sessionId);
        if (!session) throw createError.notFound('Session not found');
        if (session.creatorId.toString() !== req.user?._id.toString()) {
            throw createError.forbidden('Only the creator can delete messages');
        }

        // Try free message
        let updated = await LiveChatMessage.findOneAndUpdate({ _id: msgId, sessionId }, { isHidden: true });
        if (!updated) {
            // Try paid message
            updated = await PaidLiveMessage.findOneAndUpdate({ _id: msgId, sessionId }, { isHidden: true });
        }
        
        if (!updated) throw createError.notFound('Message not found');

        removeMessageFromHistory(sessionId, msgId);

        const io: SocketIOServer = req.app.get('io');
        io.to(`live:${sessionId}`).emit('chat_message.removed', { messageId: msgId });

        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const timeoutUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const sessionId = req.params.sessionId as string;
        const userId = req.params.userId as string;
        const { durationMinutes } = req.body;
        
        const session = await liveSessionRepository.findById(sessionId);
        if (!session) throw createError.notFound('Session not found');
        if (session.creatorId.toString() !== req.user?._id.toString()) {
            throw createError.forbidden('Only the creator can timeout users');
        }

        const durationMs = (durationMinutes || 5) * 60 * 1000;
        const mutedUntil = new Date(Date.now() + durationMs);

        await ChatMute.findOneAndUpdate(
            { sessionId, userId },
            { mutedUntil, mutedBy: req.user._id },
            { upsert: true, new: true }
        );

        const io: SocketIOServer = req.app.get('io');
        io.to(`live:${sessionId}`).emit('chat.user_muted', { userId, mutedUntil });

        res.status(200).json({ success: true, mutedUntil });
    } catch (error) {
        next(error);
    }
};
