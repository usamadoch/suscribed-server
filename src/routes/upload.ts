import { Router, RequestHandler } from 'express';
import { protect } from '../middleware/auth.js';
import {
    uploadMiddleware as upload,
    uploadImage,
    uploadImages,
    uploadVideo,
    uploadAudio,
    uploadFile,
    deleteFile
} from '../controllers/uploadControllers.js';

const router = Router();

// Upload single image
router.post('/image', protect, upload.single('image'), uploadImage as unknown as RequestHandler);

// Upload multiple images
router.post('/images', protect, upload.array('images', 10), uploadImages as unknown as RequestHandler);

// Upload video
router.post('/video', protect, upload.single('video'), uploadVideo as unknown as RequestHandler);

// Upload audio
router.post('/audio', protect, upload.single('audio'), uploadAudio as unknown as RequestHandler);

// Upload generic file
router.post('/file', protect, upload.single('file'), uploadFile as unknown as RequestHandler);

// Delete file
router.delete('/:type/:filename', protect, deleteFile as unknown as RequestHandler);

export default router;
