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
                    await webhookService.processPaymentSucceeded(tracker);
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