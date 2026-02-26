import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import PayoutMethod from '../models/PayoutMethod.js';

export const getPendingPayouts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const payouts = await PayoutMethod.find({ status: 'pending_review' })
            .populate('userId', 'displayName email')
            .populate('pageId', 'pageSlug displayName')
            .sort({ createdAt: 1 });

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

        const payoutMethod = await PayoutMethod.findById(id);
        if (!payoutMethod) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payout method not found' } });
            return;
        }

        payoutMethod.status = status;
        if (status === 'rejected') {
            payoutMethod.rejectionReason = rejectionReason;
        } else {
            payoutMethod.rejectionReason = '';
        }

        payoutMethod.reviewedBy = req.user._id;
        payoutMethod.reviewedAt = new Date();

        await payoutMethod.save();

        res.json({
            success: true,
            data: payoutMethod,
        });
    } catch (error) {
        next(error);
    }
};
