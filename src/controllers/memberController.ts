import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { memberRepository } from '../repositories/memberRepository.js';
import { MemberService } from '../services/memberService.js';

// Get user's memberships (as member)
export const getMember = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const [members, total] = await Promise.all([
            memberRepository.findMemberSubscriptions(req.user._id, { joinedAt: -1 }, (page - 1) * limit, limit),
            memberRepository.countDocuments({ memberId: req.user._id, status: 'active' }),
        ]);

        res.json({
            success: true,
            data: { members },
            meta: {
                pagination: {
                    page,
                    limit,
                    totalItems: total,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: page * limit < total,
                    hasPrevPage: page > 1,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get creator's members (as creator)
export const getMyMembers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const [members, total] = await Promise.all([
            memberRepository.findCreatorMembers(req.user._id, { joinedAt: -1 }, (page - 1) * limit, limit),
            memberRepository.countDocuments({ creatorId: req.user._id, status: 'active' }),
        ]);

        res.json({
            success: true,
            data: { members },
            meta: {
                pagination: {
                    page,
                    limit,
                    totalItems: total,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: page * limit < total,
                    hasPrevPage: page > 1,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// Join a creator (become a member)
export const joinCreator = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { creatorId, pageId } = req.body;

        const member = await MemberService.joinCreator({
            memberId: req.user._id.toString(),
            creatorId,
            pageId,
            memberDisplayName: req.user.displayName,
            io: req.app.get('io')
        });

        res.status(201).json({
            success: true,
            data: { member },
        });
    } catch (error) {
        next(error);
    }
};

// Leave a creator (cancel membership)
export const leaveCreator = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        await MemberService.leaveCreator(req.user._id.toString(), String(req.params.id));

        res.json({
            success: true,
            data: { message: 'Member cancelled' },
        });
    } catch (error) {
        next(error);
    }
};

// Check membership status for a page
export const checkMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await MemberService.checkMembership(req.user._id.toString(), String(req.params.pageId));

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
