// controllers/webhookController.ts
import crypto from 'crypto';
import { Request, Response } from 'express';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import Tier from '../models/Tier.js';
import { SubscriptionService } from '../services/subscriptionService.js';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);


const verifyHmac = (rawBody: Buffer, signature: string): boolean => {
    const hmac = crypto
        // Safepay uses SHA-512 for its 128-character signature, not SHA-256
        .createHmac('sha512', process.env.SAFEPAY_WEBHOOK_SECRET!)
        .update(rawBody)
        .digest('hex');

    // timingSafeEqual throws if lengths differ — check first
    const hmacBuf = Buffer.from(hmac, 'utf8');
    const sigBuf = Buffer.from(signature, 'utf8');

    if (hmacBuf.length !== sigBuf.length) {
        console.warn(`[Webhook] Signature length mismatch: expected ${hmacBuf.length}, got ${sigBuf.length}`);
        return false;
    }

    return crypto.timingSafeEqual(hmacBuf, sigBuf);
};

export const handleSafepayWebhook = async (req: Request, res: Response): Promise<void> => {


    console.log("[Webhook] Safepay headers:", JSON.stringify(req.headers, null, 2));
    const signature = req.headers['x-sfpy-signature'] as string | undefined;

    if (!signature) {
        console.warn('[Webhook] Missing x-sfpy-signature header');
        res.status(401).json({ error: 'Missing signature header' });
        return;
    }

    if (!verifyHmac(req.body as Buffer, signature)) {
        console.warn('[Webhook] Invalid HMAC signature — request rejected');
        res.status(401).json({ error: 'Invalid signature' });
        return;
    }

    // Respond 200 immediately — Safepay requires a response within 10s
    res.sendStatus(200);

    // DB work in a fire-and-forget block — errors won't affect the 200 already sent
    void (async () => {
        try {
            const event = JSON.parse((req.body as Buffer).toString());
            const tracker = event.data;

            console.log(`[Webhook] Safepay event: ${event.type}`, JSON.stringify(tracker, null, 2));

            switch (event.type) {
                case 'payment.succeeded': {
                    const safepayTrackerId = tracker.tracker;

                    console.log(`[Webhook] Tokenization/Auth complete for tracker: ${safepayTrackerId}`);

                    // Idempotency guard: skip if subscription is already active for this tracker
                    const activeSub = await Subscription.findOne({
                        safepaySubscriptionId: safepayTrackerId,
                        status: 'active'
                    });

                    if (activeSub) {
                        console.log(`[Webhook] Ignored: Subscription already active for tracker ${safepayTrackerId} (Idempotency guard)`);
                        return;
                    }

                    // Safepay may omit 'mode' or 'customer' in some tracker events. 
                    // So we locate the incomplete subscription exactly matching this tracking ID.
                    const pendingSub = await Subscription.findOne({
                        safepaySubscriptionId: safepayTrackerId,
                        status: 'incomplete'
                    });

                    if (!pendingSub) {
                        console.log(`[Webhook] Ignored: No incomplete subscription found for tracker ${safepayTrackerId}`);
                        return;
                    }

                    console.log(`[Webhook] Milestone 1: Found incomplete subscription ${pendingSub._id}`);

                    // Find the user
                    const user = await User.findById(pendingSub.userId);
                    if (!user) {
                        console.error("[Webhook] No user found for incomplete subscription:", safepayTrackerId);
                        return;
                    }

                    console.log(`[Webhook] Milestone 2: Found user ${user.email} (${user._id})`);



                    const cardToken = tracker?.action?.payment_method?.token;
                    if (!cardToken) {
                        console.error(`[Webhook] No card token in payload — log full tracker:`, JSON.stringify(tracker));
                        // Don't return — still activate sub, just won't have card for recurring
                    }

                    // Save card token to user for future unscheduled_cof charges
                    if (cardToken) {
                        user.safepayPaymentMethodToken = cardToken;
                        await user.save();
                        console.log(`[Webhook] Saved card token ${cardToken} for user ${user.email}`);
                    }


                    const plan = await Tier.findById(pendingSub.planId);
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

                    break;
                }

                default:
                    console.log(`[Webhook] Unhandled event type: ${event.type}`);
            }
        } catch (err) {
            console.error('[Webhook] Error processing Safepay event:', err);
        }
    })();
};