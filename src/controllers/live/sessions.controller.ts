import { Request, RequestHandler, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../../types/index.js';
import { liveSessionService } from '../../services/liveSessionService.js';
import { youtubeIntegration } from '../../integrations/youtube.js';

export const createSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io: SocketIOServer = req.app.get('io');
        const session = await liveSessionService.createSession(req.body, req.user._id.toString(), io);
        res.status(200).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

export const listSessions: RequestHandler = (req, res) => { res.status(200).json({ message: 'ok' }); };

export const getSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const session = await liveSessionService.getSessionForControl(req.params.sessionId as string, req.user._id.toString());
        res.status(200).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

export const updateSession: RequestHandler = (req, res) => { res.status(200).json({ message: 'ok' }); };

export const startLive = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io: SocketIOServer = req.app.get('io');
        const session = await liveSessionService.startLive(req.params.sessionId as string, req.user._id.toString(), io);
        res.status(200).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

export const endLive = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io: SocketIOServer = req.app.get('io');
        const session = await liveSessionService.endLive(req.params.sessionId as string, req.user._id.toString(), io);
        res.status(200).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

export const deleteSession: RequestHandler = (req, res) => { res.status(200).json({ message: 'ok' }); };
export const detectActiveBroadcast: RequestHandler = (req, res) => { res.status(200).json({ message: 'ok' }); };

export const validateYouTubeUrl: RequestHandler = async (req, res, next) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ success: false, error: { message: 'URL is required' } });
        }

        const data = await youtubeIntegration.validateYouTubeUrl(url);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getSuperChatTiers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tiers = await liveSessionService.getSuperChatTiers();
        res.status(200).json({ success: true, data: tiers });
    } catch (error) {
        next(error);
    }
};

export const getWalletStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const data = await liveSessionService.getWalletStatus(req.user);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getCurrentLiveSession: RequestHandler = (req, res) => { res.status(200).json({ message: 'ok' }); };

export const getPublicSession = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?._id?.toString() || null;
        const session = await liveSessionService.getPublicSession(req.params.sessionId as string, userId);
        res.status(200).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};
