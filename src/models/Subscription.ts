import mongoose, { Schema, Document } from 'mongoose';
import { ISubscription, SubscriptionStatus } from '../types/index.js';

export interface ISubscriptionDocument extends Omit<ISubscription, '_id'>, Document { }

const subscriptionSchema = new Schema<ISubscriptionDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        creatorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        planId: {
            type: Schema.Types.ObjectId,
            ref: 'Tier',
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'past_due', 'canceled', 'incomplete'] as SubscriptionStatus[],
            default: 'active',
        },
        currentPeriodStart: {
            type: Date,
            default: Date.now,
        },
        currentPeriodEnd: {
            type: Date,
            default: null,
        },
        canceledAt: {
            type: Date,
            default: null,
        },
        stripeSubscriptionId: {
            type: String,
            default: '',
        },
        stripeCustomerId: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
subscriptionSchema.index({ userId: 1, creatorId: 1 });
subscriptionSchema.index({ planId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

const Subscription = mongoose.model<ISubscriptionDocument>('Subscription', subscriptionSchema);

export default Subscription;
