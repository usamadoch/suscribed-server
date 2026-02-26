import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import PayoutMethod from '../models/PayoutMethod.js';
import CreatorPage from '../models/CreatorPage.js';

// Get current payout method
export const getMyPayoutMethod = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const payoutMethod = await PayoutMethod.findOne({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: payoutMethod || null,
        });
    } catch (error) {
        next(error);
    }
};

// Submit or update payout method
export const submitPayoutMethod = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { accountHolderName, bankName, accountNumber, routingNumber, country, notes } = req.body;

        const creatorPage = await CreatorPage.findOne({ userId: req.user._id });
        if (!creatorPage) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Creator page not found' } });
            return;
        }

        // Check if an existing pending or approved method exists
        let payoutMethod = await PayoutMethod.findOne({ userId: req.user._id });

        if (payoutMethod) {
            payoutMethod.accountHolderName = accountHolderName;
            payoutMethod.bankName = bankName;
            payoutMethod.accountNumber = accountNumber;
            payoutMethod.routingNumber = routingNumber;
            payoutMethod.country = country;
            payoutMethod.notes = notes || '';
            payoutMethod.status = 'pending_review';
            payoutMethod.rejectionReason = '';
            await payoutMethod.save();
        } else {
            payoutMethod = await PayoutMethod.create({
                userId: req.user._id,
                pageId: creatorPage._id,
                accountHolderName,
                bankName,
                accountNumber,
                routingNumber,
                country,
                notes,
                status: 'pending_review'
            });
        }

        res.status(200).json({
            success: true,
            data: payoutMethod,
        });
    } catch (error) {
        next(error);
    }
};
