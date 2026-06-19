import mongoose, { Schema, Document } from 'mongoose';

export interface IPaidLiveMessage {
    sessionId: mongoose.Types.ObjectId;
    creatorId: mongoose.Types.ObjectId;
    senderId?: mongoose.Types.ObjectId;
    senderName?: string;
    senderEmail?: string;
    message: string;
    amountPKR: number;
    tier: number;
    tierLabel: string;
    bgColor: string;
    headerColor: string;
    textColor: string;
    pinDurationMinutes: number;
    maxChars: number;
    paymentId?: string;
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'disputed';
    isRead: boolean;
    isPinned: boolean;
    isHearted: boolean;
    isHidden: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IPaidLiveMessageDocument extends Omit<IPaidLiveMessage, '_id' | 'createdAt' | 'updatedAt'>, Document { }

const paidLiveMessageSchema = new Schema<IPaidLiveMessageDocument>(
    {
        sessionId: {
            type: Schema.Types.ObjectId,
            ref: 'LiveSession',
            required: true,
        },
        creatorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        senderName: {
            type: String,
        },
        senderEmail: {
            type: String,
        },
        message: {
            type: String,
            default: '',
        },
        amountPKR: {
            type: Number,
            required: true,
        },
        tier: {
            type: Number,
            required: true,
            min: 1,
            max: 7,
        },
        tierLabel: {
            type: String,
            required: true,
        },
        bgColor: {
            type: String,
            required: true,
        },
        headerColor: {
            type: String,
            required: true,
        },
        textColor: {
            type: String,
            required: true,
        },
        pinDurationMinutes: {
            type: Number,
            required: true,
        },
        maxChars: {
            type: Number,
            required: true,
        },
        paymentId: {
            type: String,
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded', 'disputed'],
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        isHearted: {
            type: Boolean,
            default: false,
        },
        isHidden: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
paidLiveMessageSchema.index({ sessionId: 1, createdAt: 1 });
paidLiveMessageSchema.index({ sessionId: 1, isPinned: 1 });
paidLiveMessageSchema.index({ sessionId: 1, paymentStatus: 1, amountPKR: -1 });
paidLiveMessageSchema.index({ paymentId: 1 }, { unique: true, sparse: true });

const PaidLiveMessage = mongoose.model<IPaidLiveMessageDocument>('PaidLiveMessage', paidLiveMessageSchema);

export default PaidLiveMessage;
