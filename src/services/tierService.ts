import { tierRepository } from '../repositories/tierRepository.js';
import { subscriptionRepository } from '../repositories/subscriptionRepository.js';
import { creatorPageRepository } from '../repositories/creatorPageRepository.js';
import { createError } from '../middleware/errorHandler.js';
import { Types } from 'mongoose';

import { getOrCreateSafepayCustomer, createTracker, getAuthToken, createSafepayPlan } from './safepayService.js';


interface CreatePlanInput {
    name: string;
    price: number;
    description?: string;
    benefits?: string[];
    badgeTitle?: string;
    status?: string;
}

interface UpdatePlanInput {
    name?: string;
    description?: string;
    benefits?: string[];
    badgeTitle?: string;
    isHighlighted?: boolean;
    status?: string;
}

export class TierService {
    /**
     * Create both monthly and yearly Safepay plans for a tier
     */
    static async createSafepayPlans(name: string, price: number): Promise<{ safepayPlanId: string, safepayYearlyPlanId: string }> {
        const safepayResponse = await createSafepayPlan(name, price, 'MONTH', 1);
        const safepayPlanId = safepayResponse?.data?.plan_id || safepayResponse?.token;

        if (!safepayPlanId) {
            throw new Error(`Monthly Safepay plan creation failed: ${JSON.stringify(safepayResponse)}`);
        }

        const safepayYearlyResponse = await createSafepayPlan(`${name} (Yearly)`, price * 12, 'YEAR', 1);
        const safepayYearlyPlanId = safepayYearlyResponse?.data?.plan_id || safepayYearlyResponse?.token;

        if (!safepayYearlyPlanId) {
            throw new Error(`Yearly Safepay plan creation failed: ${JSON.stringify(safepayYearlyResponse)}`);
        }

        return { safepayPlanId, safepayYearlyPlanId };
    }

    static async createPlan(creatorId: Types.ObjectId, input: CreatePlanInput) {
        const creatorPage = await creatorPageRepository.findOne({ userId: creatorId }, '_id');
        if (!creatorPage) {
            throw createError.notFound('Creator page');
        }

        const plan = await tierRepository.create({
            creatorId,
            pageId: creatorPage._id,
            name: input.name,
            price: input.price,
            description: input.description,
            benefits: input.benefits || [],
            badgeTitle: input.badgeTitle,
            status: input.status || 'draft',
        });

        return plan;
    }

    static async getCreatorPlans(creatorId: string) {
        return tierRepository.findPublishedByCreatorId(creatorId, { price: 1 });
    }

    static async getMyPlans(creatorId: Types.ObjectId) {
        return tierRepository.findByCreatorId(creatorId, { price: 1 });
    }

    static async updatePlan(planId: string, creatorId: Types.ObjectId, input: UpdatePlanInput) {
        const existingPlan = await tierRepository.findOneByIdAndCreator(planId, creatorId);
        if (!existingPlan) {
            throw createError.notFound('Plan');
        }

        const updateData: Record<string, unknown> = {};
        if (input.name) updateData.name = input.name;
        if (input.description) updateData.description = input.description;
        if (input.benefits) updateData.benefits = input.benefits;
        if (input.badgeTitle !== undefined) updateData.badgeTitle = input.badgeTitle;
        if (input.isHighlighted !== undefined) updateData.isHighlighted = input.isHighlighted;
        if (input.status) updateData.status = input.status;

        const plan = await tierRepository.findOneAndUpdate(
            { _id: planId, creatorId },
            updateData
        );

        if (plan && input.isHighlighted) {
            await tierRepository.updateMany(
                { creatorId, _id: { $ne: plan._id } },
                { isHighlighted: false }
            );
        }

        if (!plan) {
            throw createError.notFound('Plan');
        }

        return plan;
    }

    static async updatePlanPrice(planId: string, creatorId: Types.ObjectId, price: number) {
        if (price === undefined || typeof price !== 'number') {
            throw createError.invalidInput('Invalid price');
        }

        const existingPlan = await tierRepository.findOneByIdAndCreator(planId, creatorId);
        if (!existingPlan) {
            throw createError.notFound('Plan');
        }

        if (price === existingPlan.price) {
            return existingPlan;
        }

        const { safepayPlanId, safepayYearlyPlanId } = await TierService.createSafepayPlans(existingPlan.name, price);

        const plan = await tierRepository.findOneAndUpdate(
            { _id: planId, creatorId },
            { price, safepayPlanId, safepayYearlyPlanId }
        );

        if (!plan) {
            throw createError.notFound('Plan');
        }

        return plan;
    }

    static async subscribeToPlan(tierId: string, userId: Types.ObjectId, user: any, interval: string = 'MONTHLY') {
        const tier = await tierRepository.findById(tierId);
        if (!tier) {
            throw createError.notFound('Tier');
        }

        const priceToCharge = interval === 'YEARLY' ? tier.price * 12 : tier.price;
        const safepayPlanToUse = interval === 'YEARLY' ? tier.safepayYearlyPlanId : tier.safepayPlanId;

        const customerToken = await getOrCreateSafepayCustomer(user);
        const tracker = await createTracker(priceToCharge, safepayPlanToUse, customerToken, "PKR", {
            mode: "payment",
            entry_mode: "raw"
        });

        const trackerToken = tracker.token;
        const authToken = await getAuthToken();

        await subscriptionRepository.create({
            userId,
            creatorId: tier.creatorId,
            planId: tier._id,
            status: 'incomplete',
            safepaySubscriptionId: trackerToken,
            interval
        });

        return { trackerToken, authToken };
    }

    static async confirmSubscription(tierId: string, userId: Types.ObjectId, tracker?: string) {
        const plan = await tierRepository.findById(tierId);
        if (!plan) {
            throw createError.notFound('Plan');
        }

        let pendingSub;
        if (tracker) {
            pendingSub = await subscriptionRepository.findOne({
                userId,
                planId: plan._id,
                safepaySubscriptionId: tracker,
            });
        }

        if (!pendingSub) {
            pendingSub = await subscriptionRepository.findOne(
                { userId, planId: plan._id },
                { createdAt: -1 }
            );
        }

        if (!pendingSub) {
            throw createError.notFound('Subscription');
        }

        return pendingSub;
    }
}
