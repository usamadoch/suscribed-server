import mongoose, { Schema, Document } from 'mongoose';
import { IMembershipPlan, MembershipPlanStatus } from '../types/index.js';

export interface IMembershipPlanDocument extends Omit<IMembershipPlan, '_id'>, Document { }

const membershipPlanSchema = new Schema<IMembershipPlanDocument>(
    {
        creatorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        pageId: {
            type: Schema.Types.ObjectId,
            ref: 'CreatorPage',
            required: true,
        },
        name: {
            type: String,
            required: [true, 'Plan name is required'],
            trim: true,
            maxlength: 100,
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price must be at least 0'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            maxlength: 500,
        },
        benefits: {
            type: [String],
            default: [],
        },
        badgeTitle: {
            type: String,
            default: '',
            trim: true,
            maxlength: 50,
        },
        status: {
            type: String,
            enum: ['draft', 'published'] as MembershipPlanStatus[],
            default: 'draft',
        },
        activeSubscribers: {
            type: Number,
            default: 0,
            min: 0,
        },
        stripeProductId: {
            type: String,
            default: '',
        },
        stripePriceId: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
membershipPlanSchema.index({ creatorId: 1 });
membershipPlanSchema.index({ pageId: 1 });
membershipPlanSchema.index({ status: 1 });
membershipPlanSchema.index({ createdAt: -1 });

const MembershipPlan = mongoose.model<IMembershipPlanDocument>('MembershipPlan', membershipPlanSchema);

export default MembershipPlan;
