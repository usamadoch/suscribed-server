import { Router, RequestHandler } from 'express';
import express from 'express';
import { protect } from '../middleware/auth.js';
import {
    getCloudinarySignature,
    getMuxUploadUrl,
    handleMuxWebhook,
    deleteMedia
} from '../controllers/mediaController.js';

const router = Router();

// Get Cloudinary Signature (Auth required)
router.get('/cloudinary/signature', protect, getCloudinarySignature as RequestHandler);

// Get Mux Upload URL (Auth required)
router.get('/mux/upload-url', protect, getMuxUploadUrl as RequestHandler);

// Delete Media (Auth required)
router.delete('/:type/:id', protect, deleteMedia as RequestHandler);

// Mux Webhook (Public, Raw body for verification)
// We need to use express.raw for this specific route to verify signatures
router.post(
    '/mux/webhook',
    express.raw({ type: 'application/json' }),
    handleMuxWebhook as RequestHandler
);

export default router;
