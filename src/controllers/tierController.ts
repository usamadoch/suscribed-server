import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../types/index.js';
import Tier from '../models/Tier.js';
import CreatorPage from '../models/CreatorPage.js';
import Subscription from '../models/Subscription.js';

import { TierService } from '../services/tierService.js';

// tierController.ts
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createSafepayPlan, getOrCreateSafepayCustomer, getSavedPaymentMethod, chargesavedCard, createTracker, getAuthToken } = require('../services/safepayService.js');



export const createPlan = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, price, description, benefits, badgeTitle, status } = req.body;

        const creatorPage = await CreatorPage.findOne({ userId: req.user._id }).select('_id').lean();
        if (!creatorPage) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Creator page not found' } });
            return;
        }

        // const { safepayPlanId, safepayYearlyPlanId } = await TierService.createSafepayPlans(name, price);

        const plan = await Tier.create({
            creatorId: req.user._id,
            pageId: creatorPage._id,
            name,
            price,
            description,
            benefits: benefits || [],
            badgeTitle,
            status: status || 'draft',
            // safepayPlanId,
            // safepayYearlyPlanId
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
        const { name, description, benefits, badgeTitle, status } = req.body;

        const existingPlan = await Tier.findOne({ _id: id, creatorId: req.user._id }).lean();
        if (!existingPlan) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
            return;
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (benefits) updateData.benefits = benefits;
        if (badgeTitle !== undefined) updateData.badgeTitle = badgeTitle;
        if (req.body.isHighlighted !== undefined) updateData.isHighlighted = req.body.isHighlighted;
        if (status) updateData.status = status;

        const plan = await Tier.findOneAndUpdate(
            { _id: id, creatorId: req.user._id },
            { $set: updateData },
            { new: true }
        ).lean();

        if (plan && req.body.isHighlighted) {
            await Tier.updateMany(
                { creatorId: req.user._id, _id: { $ne: plan._id } },
                { $set: { isHighlighted: false } }
            );
        }

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

export const updatePlanPrice = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { price } = req.body;

        if (price === undefined || typeof price !== 'number') {
            res.status(400).json({ success: false, error: { message: "Invalid price" } });
            return;
        }

        const existingPlan = await Tier.findOne({ _id: id, creatorId: req.user._id }).lean();
        if (!existingPlan) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
            return;
        }

        // If price hasn't changed, just return success
        if (price === existingPlan.price) {
            res.json({ success: true, data: existingPlan });
            return;
        }

        const planName = existingPlan.name;

        const { safepayPlanId, safepayYearlyPlanId } = await TierService.createSafepayPlans(planName, price);

        const plan = await Tier.findOneAndUpdate(
            { _id: id, creatorId: req.user._id },
            {
                $set: {
                    price,
                    safepayPlanId,
                    safepayYearlyPlanId
                }
            },
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

export const subscribeToPlan = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tierId } = req.params;
        const { interval = 'MONTHLY' } = req.body;

        const tier = await Tier.findById(tierId).lean();
        if (!tier) {
            res.status(404).json({ success: false, error: { message: "Tier not found" } });
            return;
        }

        const priceToCharge = interval === 'YEARLY' ? tier.price * 12 : tier.price;
        const safepayPlanToUse = interval === 'YEARLY' ? tier.safepayYearlyPlanId : tier.safepayPlanId;

        // 1. Create a Customer (get cus_xxx token)
        const customerToken = await getOrCreateSafepayCustomer(req.user);

        // 2. Create a Tracker → mode: "payment", entry_mode: "raw", user: cus_xxx
        const tracker = await createTracker(priceToCharge, safepayPlanToUse, customerToken, "PKR", {
            mode: "payment",
            entry_mode: "raw"
        });

        const trackerToken = tracker.token;



        // 3. Generate Auth Token → Get back: short-lived JWT (tbt)
        const authToken = await getAuthToken();

        // Save incomplete subscription
        await Subscription.create({
            userId: req.user._id,
            creatorId: tier.creatorId,
            planId: tier._id,
            status: 'incomplete',
            safepaySubscriptionId: trackerToken,
            interval
        });

        // 4. Send back trackerToken and authToken
        res.json({
            success: true,
            data: {
                trackerToken,
                authToken,
            }
        });
    } catch (err) {
        next(err);
    }
};

export const confirmSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tierId } = req.params;

        const plan = await Tier.findById(tierId).lean();
        if (!plan) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } });
            return;
        }

        const { tracker } = req.query;

        let pendingSub;
        if (tracker) {
            pendingSub = await Subscription.findOne({
                userId: req.user._id,
                planId: plan._id,
                safepaySubscriptionId: tracker as string
            });
        }

        // Fallback to latest if no tracker or tracker search failed
        if (!pendingSub) {
            pendingSub = await Subscription.findOne({
                userId: req.user._id,
                planId: plan._id,
            }).sort({ createdAt: -1 });
        }

        if (!pendingSub) {
            res.status(404).json({ success: false, error: { message: "No subscription found" } });
            return;
        }

        if (pendingSub.status === 'active') {
            res.status(200).json({ success: true, data: pendingSub });
            return;
        } else if (pendingSub.status === 'canceled') {
            res.status(400).json({ success: false, error: { message: "Payment failed" } });
            return;
        } else {
            // Still incomplete
            res.status(202).json({ success: true, data: pendingSub });
            return;
        }
    } catch (error) {
        next(error);
    }
};
