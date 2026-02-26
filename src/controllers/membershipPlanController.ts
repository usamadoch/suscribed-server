import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../types/index.js';
import MembershipPlan from '../models/MembershipPlan.js';
import CreatorPage from '../models/CreatorPage.js';
import Subscription from '../models/Subscription.js';

export const createPlan = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, price, description, benefits, badgeTitle, status } = req.body;

        const creatorPage = await CreatorPage.findOne({ userId: req.user._id });
        if (!creatorPage) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Creator page not found' } });
            return;
        }

        const plan = await MembershipPlan.create({
            creatorId: req.user._id,
            pageId: creatorPage._id,
            name,
            price,
            description,
            benefits: benefits || [],
            badgeTitle,
            status: status || 'draft'
        });

        res.status(201).json({
            success: true,
            data: plan,
        });
    } catch (error) {
        next(error);
    }
};

export const getCreatorPlans = async (req: MaybeAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { creatorId } = req.params;
        const plans = await MembershipPlan.find({ creatorId, status: 'published' }).sort({ price: 1 });

        res.json({
            success: true,
            data: { plans },
        });
    } catch (error) {
        next(error);
    }
};

export const getMyPlans = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const plans = await MembershipPlan.find({ creatorId: req.user._id }).sort({ price: 1 });

        res.json({
            success: true,
            data: { plans },
        });
    } catch (error) {
        next(error);
    }
};

export const updatePlan = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, price, description, benefits, badgeTitle, status } = req.body;

        const plan = await MembershipPlan.findOne({ _id: id, creatorId: req.user._id });
        if (!plan) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
            return;
        }

        if (name) plan.name = name;
        if (price !== undefined) plan.price = price;
        if (description) plan.description = description;
        if (benefits) plan.benefits = benefits;
        if (badgeTitle !== undefined) plan.badgeTitle = badgeTitle;
        if (status) plan.status = status;

        await plan.save();

        res.json({
            success: true,
            data: plan,
        });
    } catch (error) {
        next(error);
    }
};

export const subscribeMock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { planId } = req.params;

        const plan = await MembershipPlan.findById(planId);
        if (!plan) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
            return;
        }

        // Check if already subscribed
        const existingSub = await Subscription.findOne({
            userId: req.user._id,
            planId: plan._id,
            status: 'active'
        });

        if (existingSub) {
            res.status(400).json({ success: false, error: { code: 'ALREADY_SUBSCRIBED', message: 'You are already subscribed to this plan' } });
            return;
        }

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const subscription = await Subscription.create({
            userId: req.user._id,
            creatorId: plan.creatorId,
            planId: plan._id,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: thirtyDaysFromNow
        });

        // Increment subscribers on plan
        await MembershipPlan.findByIdAndUpdate(plan._id, { $inc: { activeSubscribers: 1 } });

        res.status(201).json({
            success: true,
            data: subscription,
        });
    } catch (error) {
        next(error);
    }
};
