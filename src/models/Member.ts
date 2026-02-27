import mongoose, { Schema, Document } from 'mongoose';
import { IMember, MembershipStatus } from '../types/index.js';

export interface IMemberDocument extends Omit<IMember, '_id'>, Document { }

const memberSchema = new Schema<IMemberDocument>(
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
        tier: {
            type: String,
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

// Compound unique index to prevent duplicate members
memberSchema.index({ memberId: 1, creatorId: 1 }, { unique: true });
memberSchema.index({ creatorId: 1, status: 1 });
memberSchema.index({ memberId: 1, status: 1 });
memberSchema.index({ pageId: 1 });
memberSchema.index({ joinedAt: -1 });

const Member = mongoose.model<IMemberDocument>('Member', memberSchema);

export default Member;
