import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import PayoutMethod from '../models/PayoutMethod.js';

export const getPendingPayouts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const payouts = await PayoutMethod.find({ status: 'pending_review' })
            .populate('userId', 'displayName email')
            .populate('pageId', 'pageSlug displayName')
            .sort({ createdAt: 1 })
            .lean();

        res.json({
            success: true,
            data: { payouts },
        });
    } catch (error) {
        next(error);
    }
};

export const reviewPayout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Status must be approved or rejected' } });
            return;
        }

        if (status === 'rejected' && !rejectionReason) {
            res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Rejection reason required' } });
            return;
        }

        const updateData: any = {
            status,
            rejectionReason: status === 'rejected' ? rejectionReason : '',
            reviewedBy: req.user._id,
            reviewedAt: new Date(),
        };

        const payoutMethod = await PayoutMethod.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        ).lean();

        if (!payoutMethod) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payout method not found' } });
            return;
        }

        res.json({
            success: true,
            data: payoutMethod,
        });
    } catch (error) {
        next(error);
    }
};
