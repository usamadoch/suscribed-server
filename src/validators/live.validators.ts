import { z } from 'zod';

export const createSessionSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    youtubeVideoId: z.string().min(1, 'YouTube Video ID is required'),
    youtubeChannelId: z.string().nullable().optional(),
    accessType: z.enum(['public', 'members']).optional().default('public'),
    paidMessagesEnabled: z.boolean().optional().default(true),
    mergeYouTubeChat: z.boolean().optional().default(false),
    notifyEmailOnLive: z.boolean().optional().default(true),
    notifyPushOnLive: z.boolean().optional().default(true),
});

export const chatMessageSchema = z.object({
    message: z.string().min(1, 'Message cannot be empty').max(196, 'Message is too long (max 196 characters)'),
});
