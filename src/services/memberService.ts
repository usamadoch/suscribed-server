import { memberRepository } from '../repositories/memberRepository.js';
import { creatorPageRepository } from '../repositories/creatorPageRepository.js';
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
        const page = await creatorPageRepository.findById(pageId);
        if (!page) {
            throw createError.notFound('Page not found');
        }

        // Check if already a member
        const existing = await memberRepository.findOne({ memberId, creatorId }) as IMemberDocument;

        if (existing) {
            if (existing.status === 'active') {
                throw createError.conflict('Already a member');
            }

            // Reactivate member
            existing.status = 'active';
            existing.joinedAt = new Date();
            existing.cancelledAt = null;
            await existing.save();

            await creatorPageRepository.updateOne({ _id: pageId }, { $inc: { memberCount: 1 } });

            return existing;
        }

        // Create member
        const member = await memberRepository.create({
            memberId,
            creatorId,
            pageId,
        }) as IMemberDocument;

        // Update member count
        await creatorPageRepository.updateOne({ _id: pageId }, { $inc: { memberCount: 1 } });

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
        const member = await memberRepository.findOne({
            _id: membershipId,
            memberId,
        }) as IMemberDocument;

        if (!member) {
            throw createError.notFound('Member not found');
        }

        // Idempotency check: if already cancelled, do nothing
        if (member.status === 'cancelled') {
            return;
        }

        member.status = 'cancelled';
        member.cancelledAt = new Date();
        await member.save();

        // Update member count safely
        await creatorPageRepository.updateOne(
            { _id: member.pageId, memberCount: { $gt: 0 } },
            { $inc: { memberCount: -1 } }
        );
    }

    /**
     * Check member status
     */
    static async checkMembership(memberId: string, pageId: string) {
        const member = await memberRepository.findOne({
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
