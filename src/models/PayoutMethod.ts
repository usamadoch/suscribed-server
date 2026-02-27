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
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
        },
        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
        },
        dateOfBirth: {
            type: String,
            required: [true, 'Date of birth is required'],
        },
        address1: {
            type: String,
            required: [true, 'Address line 1 is required'],
            trim: true,
        },
        address2: {
            type: String,
            trim: true,
            default: '',
        },
        city: {
            type: String,
            required: [true, 'City is required'],
            trim: true,
        },
        postalCode: {
            type: String,
            required: [true, 'Postal code is required'],
            trim: true,
        },
        bankName: {
            type: String,
            required: [true, 'Bank name is required'],
            trim: true,
        },
        accountHolderName: {
            type: String,
            required: [true, 'Account holder name is required'],
            trim: true,
        },
        iban: {
            type: String,
            required: [true, 'IBAN is required'],
            trim: true,
        },
        idType: {
            type: String,
            enum: ['id_card', 'driving_license', 'passport'],
            required: [true, 'ID type is required'],
        },
        idNumber: {
            type: String,
            required: [true, 'ID number is required'],
            trim: true,
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
