import { RequestHandler, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedRequest } from '../../types/index.js';
import { liveMessageService } from '../../services/liveMessageService.js';

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
