/**
 * Cloudinary Transform Utilities
 * 
 * Provides URL-based transformation functions for generating
 * blurred/degraded preview images for locked content.
 */

import config from '../config/index.js';

// ============================================================================
// IMAGE TRANSFORMATIONS
// ============================================================================

/**
 * Generates a heavily blurred, low-quality preview URL for locked images.
 * 
 * Uses Cloudinary's on-the-fly transformation:
 * - e_blur:2000 - Heavy Gaussian blur
 * - q_10 - 10% quality (lossy, tiny file)
 * - w_400 - Max width 400px for bandwidth
 * 
 * @param publicId - Cloudinary public ID of the image
 * @returns Blurred preview URL or null if no publicId
 */
export function generateBlurredImageUrl(publicId: string | undefined): string | null {
    if (!publicId) return null;

    const cloudName = config.cloudinary.cloudName;
    if (!cloudName) {
        console.warn('[CloudinaryTransforms] Cloud name not configured');
        return null;
    }

    // URL-based transformation
    return `https://res.cloudinary.com/${cloudName}/image/upload/e_blur:2000,q_10,w_400/${publicId}`;
}

/**
 * Generates a moderately blurred preview with reduced opacity.
 * Suitable for thumbnail previews in post lists.
 * 
 * @param publicId - Cloudinary public ID of the image
 * @returns Preview URL or null if no publicId
 */
export function generateLockedPreviewUrl(publicId: string | undefined): string | null {
    if (!publicId) return null;

    const cloudName = config.cloudinary.cloudName;
    if (!cloudName) return null;

    // Less aggressive blur for list views
    return `https://res.cloudinary.com/${cloudName}/image/upload/e_blur:1500,q_20,w_600/${publicId}`;
}

// ============================================================================
// VIDEO TRANSFORMATIONS
// ============================================================================

/**
 * Generates a blurred video thumbnail for locked video content.
 * 
 * Note: Mux doesn't support blur transforms natively. Options:
 * 1. Use Mux thumbnail and apply CSS blur client-side (current approach)
 * 2. Proxy through Cloudinary for server-side blur
 * 3. Pre-generate blurred thumbnails during upload
 * 
 * Currently returns the Mux thumbnail URL. The client should apply
 * CSS blur for locked videos.
 * 
 * @param playbackId - Mux playback ID
 * @returns Thumbnail URL or null if no playbackId
 */
export function generateBlurredVideoThumbnail(playbackId: string | undefined | null): string | null {
    if (!playbackId) return null;

    // Mux static thumbnail (first frame)
    // For true server-side blur, we would proxy this through Cloudinary
    return `https://image.mux.com/${playbackId}/thumbnail.png?time=0&width=400`;
}

/**
 * Generates a video storyboard/animated preview for locked content.
 * This is a low-quality GIF-like preview without audio.
 * 
 * @param playbackId - Mux playback ID
 * @returns Animated GIF URL or null if no playbackId
 */
export function generateVideoPreviewGif(playbackId: string | undefined | null): string | null {
    if (!playbackId) return null;

    // Mux animated GIF (first 5 seconds, very low quality)
    return `https://image.mux.com/${playbackId}/animated.gif?start=0&end=5&width=320`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extracts the Cloudinary public ID from a full URL.
 * 
 * @param url - Full Cloudinary URL
 * @returns Public ID or null if not a valid Cloudinary URL
 */
export function extractPublicIdFromUrl(url: string | undefined): string | null {
    if (!url) return null;

    const cloudName = config.cloudinary.cloudName;
    if (!cloudName) return null;

    // Pattern: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}
    const pattern = new RegExp(
        `https://res\\.cloudinary\\.com/${cloudName}/image/upload/(?:[^/]+/)*(.+)$`
    );

    const match = url.match(pattern);
    return match ? match[1] : null;
}
