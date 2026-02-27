import Member from '../models/Member.js';
import CreatorPage from '../models/CreatorPage.js';
import { NotificationService } from './notificationService.js';
import { createError } from '../middleware/errorHandler.js';
import { IMemberDocument } from '../models/Member.js';
import { Server } from 'socket.io';

interface JoinCreatorOptions {
    memberId: string;
    creatorId: string;
    pageId: string;
    memberDisplayName: string;
    io?: Server;
}

export class MemberService {
    /**
     * Join a creator (create or reactivate member)
     */
    static async joinCreator(options: JoinCreatorOptions): Promise<IMemberDocument> {
        const { memberId, creatorId, pageId, memberDisplayName, io } = options;

        // Verify page exists
        const page = await CreatorPage.findById(pageId);
        if (!page) {
            throw createError.notFound('Page not found');
        }

        // Check if already a member
        const existing = await Member.findOne({ memberId, creatorId });

        if (existing) {
            if (existing.status === 'active') {
                throw createError.conflict('Already a member');
            }

            // Reactivate member
            existing.status = 'active';
            existing.joinedAt = new Date();
            existing.cancelledAt = null;
            await existing.save();

            await CreatorPage.updateOne({ _id: pageId }, { $inc: { memberCount: 1 } });

            return existing;
        }

        // Create member
        const member = await Member.create({
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
                metadata: { memberId, membershipId: member._id.toString() },
                io
            }
        );

        return member;
    }

    /**
     * Leave a creator (cancel member)
     */
    static async leaveCreator(memberId: string, membershipId: string): Promise<void> {
        const member = await Member.findOne({
            _id: membershipId,
            memberId,
        });

        if (!member) {
            throw createError.notFound('Member not found');
        }

        // Idempotency check: if already cancelled, do nothing (or throw, but usually idempotent is safer)
        if (member.status === 'cancelled') {
            // For consistency with "cannot decrement if already cancelled", we just return.
            // But user requirement says "cannot decrement if already cancelled". 
            // If we just return, we ensure we don't decrement.
            return;
        }

        member.status = 'cancelled';
        member.cancelledAt = new Date();
        await member.save();

        // Update member count safely
        // We use $gt: 0 check to ensure we don't go below zero, although app logic *should* prevent this.
        await CreatorPage.updateOne(
            { _id: member.pageId, memberCount: { $gt: 0 } },
            { $inc: { memberCount: -1 } }
        );
    }

    /**
     * Check member status
     */
    static async checkMembership(memberId: string, pageId: string) {
        const member = await Member.findOne({
            memberId,
            pageId,
            status: 'active',
        });

        return {
            isMember: !!member,
            member: member || undefined,
        };
    }
}
