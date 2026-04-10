import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../types/index.js';
import { TierService } from '../services/tierService.js';

export const createPlan = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const plan = await TierService.createPlan(req.user._id, req.body);
        res.status(201).json({ success: true, data: plan });
    } catch (error) {
        next(error);
    }
};

export const getCreatorPlans = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const creatorId = String(req.params.creatorId);
        const plans = await TierService.getCreatorPlans(creatorId);
        res.json({ success: true, data: { plans } });
    } catch (error) {
        next(error);
    }
};

export const getMyPlans = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const plans = await TierService.getMyPlans(req.user._id);
        res.json({ success: true, data: { plans } });
    } catch (error) {
        next(error);
    }
};

export const updatePlan = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const plan = await TierService.updatePlan(String(req.params.id), req.user._id, req.body);
        res.json({ success: true, data: plan });
    } catch (error) {
        next(error);
    }
};

export const updatePlanPrice = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const plan = await TierService.updatePlanPrice(String(req.params.id), req.user._id, req.body.price);
        res.json({ success: true, data: plan });
    } catch (error) {
        next(error);
    }
};

export const subscribeToPlan = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { interval = 'MONTHLY' } = req.body;
        const data = await TierService.subscribeToPlan(
            String(req.params.tierId),
            req.user._id,
            req.user,
            interval
        );
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

export const confirmSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const pendingSub = await TierService.confirmSubscription(
            String(req.params.tierId),
            req.user._id,
            req.query.tracker as string | undefined
        );

        if (pendingSub.status === 'active') {
            res.status(200).json({ success: true, data: pendingSub });
        } else if (pendingSub.status === 'canceled') {
            res.status(400).json({ success: false, error: { message: "Payment failed" } });
        } else {
            res.status(202).json({ success: true, data: pendingSub });
        }
    } catch (error) {
        next(error);
    }
};
