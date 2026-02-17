import { jest } from '@jest/globals';
import { createPostSchema } from '../validators';

describe('Validation Schemas', () => {
    describe('createPostSchema - Media Attachments', () => {
        const validBase = {
            caption: 'Valid caption',
            visibility: 'public',
            postType: 'image',
            tags: [],
            allowComments: true,
            status: 'draft',
        };

        it('should validate valid image attachment', () => {
            const validImage = {
                type: 'image',
                url: 'http://example.com/image.jpg',
                filename: 'image.jpg',
                fileSize: 1024,
                mimeType: 'image/jpeg'
            };

            const result = createPostSchema.safeParse({
                ...validBase,
                postType: 'image',
                mediaAttachments: [validImage]
            });

            expect(result.success).toBe(true);
        });

        it('should fail if image attachment missing URL', () => {
            const invalidImage = {
                type: 'image',
                filename: 'image.jpg',
                fileSize: 1024,
                mimeType: 'image/jpeg'
                // Missing URL
            };

            const result = createPostSchema.safeParse({
                ...validBase,
                postType: 'image',
                mediaAttachments: [invalidImage]
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                // Zod error message for missing string can be "Required" or "Invalid input..."
                expect(result.error.issues[0].message).toMatch(/Required|Invalid input/);
            }
        });

        it('should validate valid video attachment', () => {
            const validVideo = {
                type: 'video',
                filename: 'video.mp4',
                fileSize: 50000,
                mimeType: 'video/mp4',
                thumbnailUrl: 'http://example.com/thumb.jpg',
                duration: 60
            };

            const result = createPostSchema.safeParse({
                ...validBase,
                postType: 'video',
                mediaAttachments: [validVideo]
            });

            expect(result.success).toBe(true);
        });

        it('should fail if invalid media type', () => {
            const invalidMedia = {
                type: 'audio', // Invalid type
                filename: 'audio.mp3',
                fileSize: 100,
                mimeType: 'audio/mp3'
            };

            const result = createPostSchema.safeParse({
                ...validBase,
                mediaAttachments: [invalidMedia]
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                // Zod discriminated union error might be generic or specific depending on version
                // We just expect it to fail validation on 'type'
                expect(result.error.issues.length).toBeGreaterThan(0);
            }
        });
    });
});
