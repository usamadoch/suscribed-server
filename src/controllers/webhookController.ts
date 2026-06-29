// controllers/webhookController.ts
import crypto from 'crypto';
import { Request, Response } from 'express';
import { webhookService } from '../services/webhookService.js';

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

            console.log(`[Webhook] Safepay event: ${event.type}`);

            switch (event.type) {
                // ─── One-time & first-payment success ────────────────────
                case 'payment.succeeded': {
                    const io = req.app.get('io');
                    await webhookService.processPaymentSucceeded(tracker, io);
                    break;
                }

                // ─── Payment failure (card declined, expired, etc.) ──────
                case 'payment.failed': {
                    await webhookService.processPaymentFailed(tracker);
                    break;
                }

                // ─── Subscription lifecycle events ───────────────────────
                case 'subscription.canceled':
                case 'subscription.ended': {
                    await webhookService.processSubscriptionEnded(tracker);
                    break;
                }

                case 'subscription.paused': {
                    console.log(`[Webhook] Subscription paused: ${tracker?.tracker || 'unknown'}`);
                    break;
                }

                case 'subscription.resumed': {
                    console.log(`[Webhook] Subscription resumed: ${tracker?.tracker || 'unknown'}`);
                    break;
                }

                // ─── Recurring payment events ────────────────────────────
                case 'subscription.payment.succeeded': {
                    const io = req.app.get('io');
                    await webhookService.processPaymentSucceeded(tracker, io);
                    break;
                }

                case 'subscription.payment.failed': {
                    await webhookService.processPaymentFailed(tracker);
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