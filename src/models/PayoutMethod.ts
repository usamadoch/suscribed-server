import mongoose, { Schema, Document } from 'mongoose';
import { IPayoutMethod, PayoutStatus } from '../types/index.js';

export interface IPayoutMethodDocument extends Omit<IPayoutMethod, '_id'>, Document { }

const payoutMethodSchema = new Schema<IPayoutMethodDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        pageId: {
            type: Schema.Types.ObjectId,
            ref: 'CreatorPage',
            required: true,
        },
        accountHolderName: {
            type: String,
            required: [true, 'Account holder name is required'],
            trim: true,
        },
        bankName: {
            type: String,
            required: [true, 'Bank name is required'],
            trim: true,
        },
        accountNumber: {
            type: String,
            required: [true, 'Account number is required'],
            trim: true,
        },
        routingNumber: {
            type: String,
            required: [true, 'Routing number is required'],
            trim: true,
        },
        country: {
            type: String,
            required: [true, 'Country is required'],
            trim: true,
            uppercase: true,
            minlength: 2,
            maxlength: 2,
        },
        notes: {
            type: String,
            default: '',
            maxlength: 500,
        },
        status: {
            type: String,
            enum: ['pending_review', 'approved', 'rejected'] as PayoutStatus[],
            default: 'pending_review',
        },
        rejectionReason: {
            type: String,
            default: '',
        },
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
payoutMethodSchema.index({ userId: 1 });
payoutMethodSchema.index({ pageId: 1 });
payoutMethodSchema.index({ status: 1 });
payoutMethodSchema.index({ createdAt: -1 });

const PayoutMethod = mongoose.model<IPayoutMethodDocument>('PayoutMethod', payoutMethodSchema);

export default PayoutMethod;
