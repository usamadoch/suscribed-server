import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../types/index.js';
import Tier from '../models/Tier.js';
import CreatorPage from '../models/CreatorPage.js';
import Subscription from '../models/Subscription.js';
import Member from '../models/Member.js';
import Transaction from '../models/Transaction.js';

export const createPlan = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, price, description, benefits, badgeTitle, status } = req.body;

        const creatorPage = await CreatorPage.findOne({ userId: req.user._id }).select('_id').lean();
        if (!creatorPage) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Creator page not found' } });
            return;
        }

        const plan = await Tier.create({
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
        const plans = await Tier.find({ creatorId, status: 'published' }).sort({ price: 1 }).lean();

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
        const plans = await Tier.find({ creatorId: req.user._id }).sort({ price: 1 }).lean();

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

        const updateData: any = {};
        if (name) updateData.name = name;
        if (price !== undefined) updateData.price = price;
        if (description) updateData.description = description;
        if (benefits) updateData.benefits = benefits;
        if (badgeTitle !== undefined) updateData.badgeTitle = badgeTitle;
        if (status) updateData.status = status;

        const plan = await Tier.findOneAndUpdate(
            { _id: id, creatorId: req.user._id },
            { $set: updateData },
            { new: true }
        ).lean();

        if (!plan) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
            return;
        }

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

        const plan = await Tier.findById(planId).lean();
        if (!plan) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
            return;
        }

        // Check if already subscribed
        const existingSub = await Subscription.exists({
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

        const gross = plan.price;
        const platformFee = Math.round(gross * 0.10); // 10% platform fee
        const net = gross - platformFee;

        const fourteenDaysFromNow = new Date();
        fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

        const [subscription] = await Promise.all([
            Subscription.create({
                userId: req.user._id,
                creatorId: plan.creatorId,
                planId: plan._id,
                status: 'active',
                currentPeriodStart: new Date(),
                currentPeriodEnd: thirtyDaysFromNow
            }),
            Member.findOneAndUpdate(
                { memberId: req.user._id, creatorId: plan.creatorId },
                {
                    $set: { status: 'active', tier: plan.name },
                    $setOnInsert: { pageId: plan.pageId }
                },
                { upsert: true, new: true }
            ),
            Transaction.create({
                userId: req.user._id,
                creatorId: plan.creatorId,
                pageId: plan.pageId,
                type: 'subscription',
                gross,
                platformFee,
                net,
                status: 'pending',
                releaseAt: fourteenDaysFromNow,
                description: `Subscription to ${plan.name}`,
            }),
            Tier.findByIdAndUpdate(plan._id, { $inc: { activeSubscribers: 1 } })
        ]);

        res.status(201).json({
            success: true,
            data: subscription,
        });
    } catch (error) {
        next(error);
    }
};
