import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { analyticsService } from '../services/analyticsService.js';

export const getOverview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { days = 30 } = req.query;
        const validDays = analyticsService.validateTimeRange(days);
        const data = await analyticsService.getOverview(req.user._id, validDays);

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getMembers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { days = 30 } = req.query;
        const validDays = analyticsService.validateTimeRange(days);
        const data = await analyticsService.getMembers(req.user._id, validDays);

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getPosts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const data = await analyticsService.getPosts(req.user._id);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getEngagement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const data = await analyticsService.getEngagement(req.user._id);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
