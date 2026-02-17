import Membership from '../models/Membership.js';
import CreatorPage from '../models/CreatorPage.js';
import { NotificationService } from './notificationService.js';
import { createError } from '../middleware/errorHandler.js';
import { IMembershipDocument } from '../models/Membership.js';
import { Server } from 'socket.io';

interface JoinCreatorOptions {
    memberId: string;
    creatorId: string;
    pageId: string;
    memberDisplayName: string;
    io?: Server;
}

export class MembershipService {
    /**
     * Join a creator (create or reactivate membership)
     */
    static async joinCreator(options: JoinCreatorOptions): Promise<IMembershipDocument> {
        const { memberId, creatorId, pageId, memberDisplayName, io } = options;

        // Verify page exists
        const page = await CreatorPage.findById(pageId);
        if (!page) {
            throw createError.notFound('Page not found');
        }

        // Check if already a member
        const existing = await Membership.findOne({ memberId, creatorId });

        if (existing) {
            if (existing.status === 'active') {
                throw createError.conflict('Already a member');
            }

            // Reactivate membership
            existing.status = 'active';
            existing.joinedAt = new Date();
            existing.cancelledAt = null;
            await existing.save();

            await CreatorPage.updateOne({ _id: pageId }, { $inc: { memberCount: 1 } });

            return existing;
        }

        // Create membership
        const membership = await Membership.create({
            memberId,
            creatorId,
            pageId,
        });

        // Update member count
        await CreatorPage.updateOne({ _id: pageId }, { $inc: { memberCount: 1 } });

        // Notify creator
        await NotificationService.sendNotification(
            creatorId,
            'new_member',
            'New member!',
            `${memberDisplayName} joined`,
            {
                actionUrl: `/members`,
                actionLabel: 'View members',
                metadata: { memberId, membershipId: membership._id.toString() },
                io
            }
        );

        return membership;
    }

    /**
     * Leave a creator (cancel membership)
     */
    static async leaveCreator(memberId: string, membershipId: string): Promise<void> {
        const membership = await Membership.findOne({
            _id: membershipId,
            memberId,
        });

        if (!membership) {
            throw createError.notFound('Membership not found');
        }

        // Idempotency check: if already cancelled, do nothing (or throw, but usually idempotent is safer)
        if (membership.status === 'cancelled') {
            // For consistency with "cannot decrement if already cancelled", we just return.
            // But user requirement says "cannot decrement if already cancelled". 
            // If we just return, we ensure we don't decrement.
            return;
        }

        membership.status = 'cancelled';
        membership.cancelledAt = new Date();
        await membership.save();

        // Update member count safely
        // We use $gt: 0 check to ensure we don't go below zero, although app logic *should* prevent this.
        await CreatorPage.updateOne(
            { _id: membership.pageId, memberCount: { $gt: 0 } },
            { $inc: { memberCount: -1 } }
        );
    }

    /**
     * Check membership status
     */
    static async checkMembership(memberId: string, pageId: string) {
        const membership = await Membership.findOne({
            memberId,
            pageId,
            status: 'active',
        });

        return {
            isMember: !!membership,
            membership: membership || undefined,
        };
    }
}
