import mongoose, { Schema, Document } from 'mongoose';
import { IMessage, MessageAttachment, MessageStatus } from '../types/index.js';

export interface IMessageDocument extends Omit<IMessage, '_id'>, Document { }

const messageAttachmentSchema = new Schema<MessageAttachment>(
    {
        type: {
            type: String,
            enum: ['image', 'file'],
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        filename: {
            type: String,
            required: true,
        },
        fileSize: {
            type: Number,
            required: true,
        },
        mimeType: {
            type: String,
            required: true,
        },
    },
    { _id: false }
);

const messageSchema = new Schema<IMessageDocument>(
    {
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
            required: [true, 'Message content is required'],
            trim: true,
            maxlength: 5000,
        },
        contentType: {
            type: String,
            enum: ['text', 'image', 'file'],
            default: 'text',
        },
        attachments: {
            type: [messageAttachmentSchema],
            default: [],
        },
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'] as MessageStatus[],
            default: 'sent',
        },
        readAt: {
            type: Date,
            default: null,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
messageSchema.index({ conversationId: 1, createdAt: -1 });

// questionable index 
messageSchema.index({ senderId: 1 });
messageSchema.index({ conversationId: 1, status: 1 });

const Message = mongoose.model<IMessageDocument>('Message', messageSchema);

export default Message;
