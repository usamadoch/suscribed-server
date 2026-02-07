import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import Membership from '../models/Membership.js';
import CreatorPage from '../models/CreatorPage.js';
import { NotificationService } from '../services/notificationService.js';
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
export const joinCreator = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { creatorId, pageId } = req.body;
        const memberId = req.user._id;

        // Verify page exists
        const page = await CreatorPage.findById(pageId);
        if (!page) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Page not found' },
            });
            return;
        }

        // Check if already a member
        const existing = await Membership.findOne({ memberId, creatorId });
        if (existing) {
            if (existing.status === 'active') {
                res.status(409).json({
                    success: false,
                    error: { code: 'CONFLICT', message: 'Already a member' },
                });
                return;
            }
            // Reactivate membership
            existing.status = 'active';
            existing.joinedAt = new Date();
            existing.cancelledAt = null;
            await existing.save();

            await CreatorPage.updateOne({ _id: pageId }, { $inc: { memberCount: 1 } });

            res.json({
                success: true,
                data: { membership: existing },
            });
            return;
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
            creatorId.toString(),
            'new_member',
            'New member!',
            `${req.user.displayName} joined`,
            {
                actionUrl: `/members`,
                actionLabel: 'View members',
                metadata: { memberId, membershipId: membership._id },
                io: req.app.get('io')
            }
        );

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
        const membership = await Membership.findOne({
            _id: req.params.id,
            memberId: req.user._id,
        });

        if (!membership) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Membership not found' },
            });
            return;
        }

        membership.status = 'cancelled';
        membership.cancelledAt = new Date();
        await membership.save();

        // Update member count
        await CreatorPage.updateOne(
            { _id: membership.pageId },
            { $inc: { memberCount: -1 } }
        );

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

        const membership = await Membership.findOne({
            memberId: req.user._id,
            pageId,
            status: 'active',
        });

        res.json({
            success: true,
            data: {
                isMember: !!membership,
                membership: membership || undefined,
            },
        });
    } catch (error) {
        next(error);
    }
};
