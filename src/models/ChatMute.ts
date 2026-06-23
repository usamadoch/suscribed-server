import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMute {
    sessionId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    mutedUntil: Date;
    mutedBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface IChatMuteDocument extends Omit<IChatMute, '_id' | 'createdAt' | 'updatedAt'>, Document { }

const chatMuteSchema = new Schema<IChatMuteDocument>(
    {
        sessionId: {
            type: Schema.Types.ObjectId,
            ref: 'LiveSession',
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        mutedUntil: {
            type: Date,
            required: true,
        },
        mutedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
chatMuteSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

const ChatMute = mongoose.model<IChatMuteDocument>('ChatMute', chatMuteSchema);

export default ChatMute;
