import { subscriptionRepository } from '../repositories/subscriptionRepository.js';
import { memberRepository } from '../repositories/memberRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { tierRepository } from '../repositories/tierRepository.js';
import mongoose from 'mongoose';

export class SubscriptionService {
    /**
     * Calculate the next billing date based on interval
     */
    static calculateNextBillingDate(interval: 'MONTHLY' | 'YEARLY'): Date {
        const nextBillingDate = new Date();
        if (interval === 'YEARLY') {
            nextBillingDate.setDate(nextBillingDate.getDate() + 365);
        } else {
            nextBillingDate.setDate(nextBillingDate.getDate() + 30);
        }
        return nextBillingDate;
    }

    /**
     * Calculate platform fees (fixed at 10%)
     */
    static calculateFees(amount: number): { gross: number, platformFee: number, net: number } {
        const gross = amount;
        const platformFee = Math.round(gross * 0.10);
        const net = gross - platformFee;
        return { gross, platformFee, net };
    }

    /**
     * Activate a subscription and create related records (Member, Transaction, Tier update)
     */
    static async activateSubscription(params: {
        subscriptionId: string | mongoose.Types.ObjectId;
        userId: string | mongoose.Types.ObjectId;
        creatorId: string | mongoose.Types.ObjectId;
        pageId: string | mongoose.Types.ObjectId;
        planId: string | mongoose.Types.ObjectId;
        tierName: string;
        interval: 'MONTHLY' | 'YEARLY';
        price: number;
    }) {
        const { subscriptionId, userId, creatorId, pageId, planId, tierName, interval, price } = params;
        
        const nextBillingDate = this.calculateNextBillingDate(interval);
        const { gross, platformFee, net } = this.calculateFees(price);
        
        const fourteenDaysFromNow = new Date();
        fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

        await Promise.all([
            subscriptionRepository.updateById(subscriptionId, {
                status: 'active',
                currentPeriodStart: new Date(),
                currentPeriodEnd: nextBillingDate,
            }),
            memberRepository.findOneAndUpdate(
                { memberId: userId, creatorId: creatorId },
                {
                    $set: { status: 'active', tier: tierName },
                    $setOnInsert: { pageId: pageId }
                },
                { upsert: true, new: true }
            ),
            transactionRepository.create({
                userId: userId,
                creatorId: creatorId,
                pageId: pageId,
                type: 'subscription',
                gross,
                platformFee,
                net,
                status: 'completed',
                releaseAt: fourteenDaysFromNow,
                description: `Subscription to ${tierName}`,
            }),
            tierRepository.updateById(planId, { $inc: { activeSubscribers: 1 } })
        ]);
    }

    /**
     * Record a failed subscription attempt
     */
    static async recordSubscriptionFailure(params: {
        userId: string | mongoose.Types.ObjectId;
        creatorId: string | mongoose.Types.ObjectId;
        pageId: string | mongoose.Types.ObjectId;
        tierName: string;
        price: number;
    }) {
        const { userId, creatorId, pageId, tierName, price } = params;
        const { gross, platformFee, net } = this.calculateFees(price);
        
        const fourteenDaysFromNow = new Date();
        fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

        await transactionRepository.create({
            userId,
            creatorId,
            pageId,
            type: 'subscription',
            gross,
            platformFee,
            net,
            status: 'failed',
            releaseAt: fourteenDaysFromNow,
            description: `Failed subscription to ${tierName}`,
        });
    }
}
