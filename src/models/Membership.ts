import mongoose, { Schema, Document } from 'mongoose';
import { IMembership, MembershipStatus } from '../types/index.js';

export interface IMembershipDocument extends Omit<IMembership, '_id'>, Document { }

const membershipSchema = new Schema<IMembershipDocument>(
    {
        memberId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
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
        status: {
            type: String,
            enum: ['active', 'paused', 'cancelled'] as MembershipStatus[],
            default: 'active',
        },
        joinedAt: {
            type: Date,
            default: Date.now,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        lastVisitAt: {
            type: Date,
            default: Date.now,
        },
        totalVisits: {
            type: Number,
            default: 1,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index to prevent duplicate memberships
membershipSchema.index({ memberId: 1, creatorId: 1 }, { unique: true });
membershipSchema.index({ creatorId: 1, status: 1 });
membershipSchema.index({ memberId: 1, status: 1 });
membershipSchema.index({ pageId: 1 });
membershipSchema.index({ joinedAt: -1 });

const Membership = mongoose.model<IMembershipDocument>('Membership', membershipSchema);

export default Membership;
