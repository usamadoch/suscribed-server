import { v2 as cloudinary } from 'cloudinary';
import config from '../../config/index.js';

cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
});

export const cloudinaryService = {
    /**
     * Generates a signature for client-side uploads.
     * @returns {Object} { signature, timestamp, apiKey, cloudName }
     */
    generateSignature: (folder?: string) => {
        const timestamp = Math.round((new Date()).getTime() / 1000);

        const params: Record<string, any> = {
            timestamp,
        };

        if (folder) {
            params.folder = folder;
        }

        const signature = cloudinary.utils.api_sign_request(params, config.cloudinary.apiSecret);

        return {
            timestamp,
            signature,
            apiKey: config.cloudinary.apiKey,
            cloudName: config.cloudinary.cloudName,
            folder // Return the folder used for signing
        };
    },

    /**
     * Deletes an image from Cloudinary.
     * @param publicId - The public ID of the image to delete
     */
    deleteImage: async (publicId: string) => {
        if (!publicId) return;
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.error('Failed to delete Cloudinary image:', error);
            // Non-blocking error, we don't throw to avoid stopping post deletion
        }
    }
};
