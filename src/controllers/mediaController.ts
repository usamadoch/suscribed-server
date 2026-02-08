import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, SuccessResponse } from '../types/index.js';
import { cloudinaryService } from '../services/media/cloudinaryService.js';
import { muxService } from '../services/media/muxService.js';
import Post from '../models/Post.js';
import { VideoAttachment } from '../types/index.js';

export const getCloudinarySignature = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const folder = req.query.folder as string | undefined;
        const signatureData = cloudinaryService.generateSignature(folder);
        res.json({
            success: true,
            data: signatureData
        });
    } catch (error) {
        next(error);
    }
};

export const getMuxUploadUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const uploadData = await muxService.createDirectUpload();

        res.json({
            success: true,
            data: {
                url: uploadData.url,
                uploadId: uploadData.uploadId
            }
        });
    } catch (error) {
        next(error);
    }
};

// Webhook handler (must use raw body in router, but assuming here we typically get parsed body in clean architecture unless configured otherwise)
// IMPORTANT: Mux webhooks need the RAW body for signature verification.
// The router should use `express.raw({ type: 'application/json' })` for this specific route.
export const handleMuxWebhook = async (req: any, res: Response, next: NextFunction): Promise<void> => {
    console.log('========== MUX WEBHOOK CALLED ==========');
    // console.log('[Mux Webhook] Body type:', typeof req.body);
    // console.log('[Mux Webhook] Body is Buffer:', Buffer.isBuffer(req.body));
    // console.log('[Mux Webhook] Headers:', JSON.stringify(req.headers, null, 2));

    try {
        // console.log('[Mux Webhook] Received webhook request');
        const signature = req.headers['mux-signature'];
        // console.log('[Mux Webhook] Signature:', signature);

        // Verify signature - verifyWebhook throws if invalid
        // Note: req.body MUST be the raw buffer here
        muxService.verifyWebhook(req.body, signature);
        // console.log('[Mux Webhook] Signature verified');

        // Parse body now that it's verified
        const event = JSON.parse(req.body.toString());
        const { type, data } = event;
        // console.log('[Mux Webhook] Event type:', type);
        // console.log('[Mux Webhook] Event data:', JSON.stringify(data, null, 2));

        // Idempotency check could go here (store event.id in Redis) within a "processing" set

        if (type === 'video.upload.asset_created') {
            // data.id is the uploadId
            // data.asset_id is the new assetId
            // We need to link these. 
            // Since we stored uploadId in the Post, we can now find the Post and add the assetId.

            const uploadId = data.id;
            const assetId = data.asset_id;

            if (uploadId && assetId) {
                await Post.updateMany(
                    { "mediaAttachments.muxUploadId": uploadId },
                    {
                        $set: {
                            "mediaAttachments.$.muxAssetId": assetId,
                            "mediaAttachments.$.status": 'preparing'
                        }
                    }
                );
            }
        }
        else if (type === 'video.asset.ready') {
            const assetId = data.id;
            const playbackId = data.playback_ids?.[0]?.id;
            const duration = data.duration;
            const uploadId = data.upload_id;


            console.log('[Mux Webhook] asset ready:', data);


            // Get dimensions from video track
            let dimensions = undefined;
            if (data.tracks && Array.isArray(data.tracks)) {
                const videoTrack = data.tracks.find((t: any) => t.type === 'video');
                if (videoTrack) {
                    // Mux webhooks often use max_width/max_height for track details
                    const width = videoTrack.width || videoTrack.max_width;
                    const height = videoTrack.height || videoTrack.max_height;

                    if (width && height) {
                        dimensions = { width, height };
                    }
                }
            }

            if (assetId && playbackId) {
                // Construct query
                const matchConditions: any[] = [{ muxAssetId: assetId }];
                // Important: Also match by uploadId to handle race conditions where assetId isn't saved yet
                if (uploadId) {
                    matchConditions.push({ muxUploadId: uploadId });
                }

                await Post.updateMany(
                    {
                        mediaAttachments: {
                            $elemMatch: {
                                $or: matchConditions
                            }
                        }
                    },
                    {
                        $set: {
                            "mediaAttachments.$.status": 'ready',
                            "mediaAttachments.$.muxPlaybackId": playbackId,
                            "mediaAttachments.$.muxAssetId": assetId,
                            "mediaAttachments.$.duration": duration,
                            "mediaAttachments.$.url": `https://stream.mux.com/${playbackId}.m3u8`,
                            "mediaAttachments.$.thumbnailUrl": `https://image.mux.com/${playbackId}/thumbnail.png`,
                            ...(dimensions && { "mediaAttachments.$.dimensions": dimensions })
                        }
                    }
                );
            }
        }
        else if (type === 'video.asset.errored') {
            const assetId = data.id;
            console.log(`[Mux Webhook] Asset errored: ${assetId}`);
            if (assetId) {
                await Post.updateMany(
                    { "mediaAttachments.muxAssetId": assetId },
                    {
                        $set: {
                            "mediaAttachments.$.status": 'errored'
                        }
                    }
                );
            }
        }

        res.json({ received: true });

    } catch (error) {
        console.error("Webhook Error:", error);
        // Return 200 even on error to stop Mux from retrying endlessly for logic errors? 
        // Or 400 for signature errors.
        // Usually safe to return 200 validation success unless we want retries.
        res.status(400).send("Webhook verification failed or error processing");
    }
};



