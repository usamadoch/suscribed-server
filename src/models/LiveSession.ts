import mongoose, { Schema, Document } from 'mongoose';

export interface ILiveSession {
    creatorId: mongoose.Types.ObjectId;
    title: string;
    youtubeVideoId?: string;
    youtubeChannelId?: string | null;
    youtubeLiveChatId?: string;
    status: 'draft' | 'live' | 'ended';
    startedAt?: Date;
    endedAt?: Date;
    accessType: 'public' | 'members';
    paidMessagesEnabled: boolean;
    mergeYouTubeChat: boolean;
    notifyEmailOnLive: boolean;
    notifyPushOnLive: boolean;
    totalCollected: number;
    totalPaidMessages: number;
    peakViewerCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ILiveSessionDocument extends Omit<ILiveSession, '_id' | 'createdAt' | 'updatedAt'>, Document { }

const liveSessionSchema = new Schema<ILiveSessionDocument>(
    {
        creatorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        youtubeVideoId: {
            type: String,
        },
        youtubeChannelId: {
            type: String,
        },
        youtubeLiveChatId: {
            type: String,
        },
        status: {
            type: String,
            enum: ['draft', 'live', 'ended'],
            required: true,
        },
        startedAt: {
            type: Date,
        },
        endedAt: {
            type: Date,
        },
        accessType: {
            type: String,
            enum: ['public', 'members'],
            required: true,
        },
        paidMessagesEnabled: {
            type: Boolean,
            default: true,
        },
        mergeYouTubeChat: {
            type: Boolean,
            default: true,
        },
        notifyEmailOnLive: {
            type: Boolean,
            default: true,
        },
        notifyPushOnLive: {
            type: Boolean,
            default: true,
        },
        totalCollected: {
            type: Number,
            default: 0,
        },
        totalPaidMessages: {
            type: Number,
            default: 0,
        },
        peakViewerCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
liveSessionSchema.index({ creatorId: 1, status: 1 });

const LiveSession = mongoose.model<ILiveSessionDocument>('LiveSession', liveSessionSchema);

export default LiveSession;
