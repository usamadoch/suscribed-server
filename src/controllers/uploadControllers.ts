import { Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, UploadedFile, SuccessResponse } from '../types/index.js';
import config from '../config/index.js';

// Define strict types for upload folders
type UploadFolder = 'images' | 'videos' | 'audio' | 'files';

// Ensure upload directory exists
const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper to determine folder based on mimetype
const getUploadFolder = (mimeType: string): UploadFolder => {
    const type = mimeType.split('/')[0];
    switch (type) {
        case 'image': return 'images';
        case 'video': return 'videos';
        case 'audio': return 'audio';
        default: return 'files';
    }
};

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (_req, file, cb) => {
        const folder = getUploadFolder(file.mimetype);
        const targetDir = path.join(uploadDir, folder);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

// File filter
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = [
        // Images
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        // Videos
        'video/mp4', 'video/webm', 'video/quicktime',
        // Audio
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        // Documents
        'application/pdf',
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} not allowed`));
    }
};

export const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: config.upload.maxFileSize,
    },
});

const createUploadedFileResponse = (file: Express.Multer.File): UploadedFile => {
    const relativePath = path.relative(uploadDir, file.path).replace(/\\/g, '/');
    return {
        url: `/uploads/${relativePath}`,
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
    };
};

export const uploadImage = async (req: AuthenticatedRequest, res: Response<SuccessResponse<UploadedFile>>, next: NextFunction): Promise<void> => {
    try {
        if (!req.file) {
            // Using unknown cast then any to bypass strict response type for error
            // ideally we have a unified response type or use next(new AppError)
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' },
            } as any);
            return;
        }

        const data = createUploadedFileResponse(req.file);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

export const uploadImages = async (req: AuthenticatedRequest, res: Response<SuccessResponse<{ files: UploadedFile[] }>>, next: NextFunction): Promise<void> => {
    try {
        const files = req.files;

        if (!files || !Array.isArray(files) || files.length === 0) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'No files uploaded' },
            } as any);
            return;
        }

        const uploadedFiles = files.map(createUploadedFileResponse);

        res.json({
            success: true,
            data: { files: uploadedFiles },
        });
    } catch (error) {
        next(error);
    }
};

export const uploadVideo = async (req: AuthenticatedRequest, res: Response<SuccessResponse<UploadedFile>>, next: NextFunction): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' },
            } as any);
            return;
        }

        const data = createUploadedFileResponse(req.file);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

export const uploadAudio = async (req: AuthenticatedRequest, res: Response<SuccessResponse<UploadedFile>>, next: NextFunction): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' },
            } as any);
            return;
        }

        const data = createUploadedFileResponse(req.file);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

export const uploadFile = async (req: AuthenticatedRequest, res: Response<SuccessResponse<UploadedFile>>, next: NextFunction): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' },
            } as any);
            return;
        }

        const data = createUploadedFileResponse(req.file);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteFile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const fileType = String(req.params.type);
        const fileName = String(req.params.filename);

        // Basic directory traversal protection
        if (fileName.includes('..') || fileType.includes('..')) {
            res.status(400).json({
                success: false,
                error: { code: 'INVALID_PATH', message: 'Invalid file path' },
            });
            return;
        }

        const filePath = path.join(uploadDir, fileType, fileName);

        if (!fs.existsSync(filePath)) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'File not found' },
            });
            return;
        }

        // Check if file is actually within the upload directory (extra safety)
        const resolvedPath = path.resolve(filePath);
        const resolvedUploadDir = path.resolve(uploadDir);
        if (!resolvedPath.startsWith(resolvedUploadDir)) {
            res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied' },
            });
            return;
        }

        fs.unlinkSync(filePath);

        res.json({
            success: true,
            data: { message: 'File deleted' },
        });
    } catch (error) {
        next(error);
    }
};
