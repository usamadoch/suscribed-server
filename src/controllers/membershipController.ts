import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import Membership from '../models/Membership.js';
import CreatorPage from '../models/CreatorPage.js';
import { MembershipService } from '../services/membershipService.js';
// import { NotificationService } from '../services/notificationService.js';

// Get user's memberships (as member)
export const getMemberships = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const memberships = await Membership.find({
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

        const total = await Membership.countDocuments({
            memberId: req.user._id,
            status: 'active',
        });

        res.json({
            success: true,
            data: { memberships },
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

        const memberships = await Membership.find({
            creatorId: req.user._id,
            status: 'active',
        })
            .populate('memberId', 'displayName username avatarUrl bio createdAt')
            .sort({ joinedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Membership.countDocuments({
            creatorId: req.user._id,
            status: 'active',
        });

        res.json({
            success: true,
            data: { memberships },
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

        const membership = await MembershipService.joinCreator({
            memberId: req.user._id.toString(),
            creatorId,
            pageId,
            memberDisplayName: req.user.displayName,
            io: req.app.get('io')
        });

        res.status(201).json({
            success: true,
            data: { membership },
        });
    } catch (error) {
        next(error);
    }
};

// Leave a creator (cancel membership)
export const leaveCreator = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        await MembershipService.leaveCreator(req.user._id.toString(), req.params.id as string);

        res.json({
            success: true,
            data: { message: 'Membership cancelled' },
        });
    } catch (error) {
        next(error);
    }
};

// Check membership status for a page
export const checkMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { pageId } = req.params;

        const result = await MembershipService.checkMembership(req.user._id.toString(), pageId as string);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
