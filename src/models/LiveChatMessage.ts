import mongoose, { Schema, Document } from 'mongoose';

export interface ILiveChatMessage {
    sessionId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    senderName: string;
    senderAvatar?: string | null;
    message: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ILiveChatMessageDocument extends Omit<ILiveChatMessage, '_id' | 'createdAt' | 'updatedAt'>, Document { }

const liveChatMessageSchema = new Schema<ILiveChatMessageDocument>(
    {
        sessionId: {
            type: Schema.Types.ObjectId,
            ref: 'LiveSession',
            required: true,
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        senderName: {
            type: String,
            required: true,
        },
        senderAvatar: {
            type: String,
            default: null,
        },
        message: {
            type: String,
            required: true,
            maxlength: 196,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
liveChatMessageSchema.index({ sessionId: 1, createdAt: 1 });

const LiveChatMessage = mongoose.model<ILiveChatMessageDocument>('LiveChatMessage', liveChatMessageSchema);

export default LiveChatMessage;
