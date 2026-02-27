import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import Member from '../models/Member.js';
import CreatorPage from '../models/CreatorPage.js';
import { MemberService } from '../services/memberService.js';
// import { NotificationService } from '../services/notificationService.js';

// Get user's members (as member)
export const getMember = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const members = await Member.find({
            memberId: req.user._id,
            status: 'active',
        })
            .populate({
                path: 'pageId',
                select: 'pageSlug displayName avatarUrl bannerUrl tagline memberCount',
            })
            .populate('creatorId', 'displayName username avatarUrl')
            .sort({ joinedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Member.countDocuments({
            memberId: req.user._id,
            status: 'active',
        });

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

        const members = await Member.find({
            creatorId: req.user._id,
            status: 'active',
        })
            .populate('memberId', 'displayName username avatarUrl bio createdAt')
            .sort({ joinedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Member.countDocuments({
            creatorId: req.user._id,
            status: 'active',
        });

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

// Leave a creator (cancel member)
export const leaveCreator = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        await MemberService.leaveCreator(req.user._id.toString(), req.params.id as string);

        res.json({
            success: true,
            data: { message: 'Member cancelled' },
        });
    } catch (error) {
        next(error);
    }
};

// Check member status for a page
export const checkMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { pageId } = req.params;

        const result = await MemberService.checkMembership(req.user._id.toString(), pageId as string);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
