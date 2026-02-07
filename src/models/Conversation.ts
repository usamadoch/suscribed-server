import mongoose, { Schema, Document } from 'mongoose';
import { IConversation } from '../types/index.js';

export interface IConversationDocument extends Omit<IConversation, '_id'>, Document { }

const conversationSchema = new Schema<IConversationDocument>(
    {
        participants: [{
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        }],
        creatorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        memberId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastMessage: {
            content: String,
            senderId: Schema.Types.ObjectId,
            sentAt: Date,
        },
        unreadCounts: {
            type: Map,
            of: Number,
            default: new Map(),
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index for creator-member pair
conversationSchema.index({ creatorId: 1, memberId: 1 }, { unique: true });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model<IConversationDocument>('Conversation', conversationSchema);

export default Conversation;
