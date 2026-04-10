import { subscriptionRepository } from '../repositories/subscriptionRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { tierRepository } from '../repositories/tierRepository.js';
import { SubscriptionService } from './subscriptionService.js';

export const webhookService = {
    async processPaymentSucceeded(tracker: any) {
        const safepayTrackerId = tracker.tracker;

        console.log(`[Webhook] Tokenization/Auth complete for tracker: ${safepayTrackerId}`);

        // Idempotency guard: skip if subscription is already active for this tracker
        const activeSub = await subscriptionRepository.findOne({
            safepaySubscriptionId: safepayTrackerId,
            status: 'active'
        });

        if (activeSub) {
            console.log(`[Webhook] Ignored: Subscription already active for tracker ${safepayTrackerId} (Idempotency guard)`);
            return;
        }

        const pendingSub = await subscriptionRepository.findOne({
            safepaySubscriptionId: safepayTrackerId,
            status: 'incomplete'
        });

        if (!pendingSub) {
            console.log(`[Webhook] Ignored: No incomplete subscription found for tracker ${safepayTrackerId}`);
            return;
        }

        console.log(`[Webhook] Milestone 1: Found incomplete subscription ${pendingSub._id}`);

        // Find the user
        const user = await userRepository.findById(pendingSub.userId);
        if (!user) {
            console.error("[Webhook] No user found for incomplete subscription:", safepayTrackerId);
            return;
        }

        console.log(`[Webhook] Milestone 2: Found user ${user.email} (${user._id})`);

        const cardToken = tracker?.action?.payment_method?.token;
        if (!cardToken) {
            console.error(`[Webhook] No card token in payload — log full tracker:`, JSON.stringify(tracker));
        }

        // Save card token to user for future unscheduled_cof charges
        if (cardToken) {
            await userRepository.updateById(user._id, { safepayPaymentMethodToken: cardToken });
            console.log(`[Webhook] Saved card token ${cardToken} for user ${user.email}`);
        }

        const plan = await tierRepository.findById(pendingSub.planId);
        if (!plan) {
            console.error(`[Webhook] Tier not found for planId ${pendingSub.planId}`);
            return;
        }

        console.log(`[Webhook] Milestone 5: Found Tier ${plan.name} at price ${plan.price}`);

        const priceToCharge = pendingSub.interval === 'YEARLY' ? plan.price * 12 : plan.price;

        try {
            await SubscriptionService.activateSubscription({
                subscriptionId: pendingSub._id,
                userId: user._id,
                creatorId: plan.creatorId,
                pageId: plan.pageId,
                planId: plan._id,
                tierName: plan.name,
                interval: (pendingSub.interval || 'MONTHLY') as 'MONTHLY' | 'YEARLY',
                price: priceToCharge
            });

            console.log(`[Webhook] Milestone 9: Successfully activated subscription for user ${user.email} on tier ${plan.name}`);
        } catch (dbErr) {
            const payload = {
                userId: user._id,
                planId: plan._id,
                tracker: safepayTrackerId,
                createdAt: new Date().toISOString()
            };
            console.error(`[CRITICAL_RECONCILIATION_ERROR] Charge succeeded but DB write failed. Data: ${JSON.stringify(payload)} Error:`, dbErr);
        }
    }
};
