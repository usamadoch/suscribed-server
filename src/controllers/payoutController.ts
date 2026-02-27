import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../types/index.js';
import PayoutMethod from '../models/PayoutMethod.js';
import CreatorPage from '../models/CreatorPage.js';
import Transaction from '../models/Transaction.js';

// Get current payout method
export const getMyPayoutMethod = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const payoutMethod = await PayoutMethod.findOne({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .lean();

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
        const {
            firstName,
            lastName,
            dateOfBirth,
            address1,
            address2,
            city,
            postalCode,
            bankName,
            accountHolderName,
            iban,
            idType,
            idNumber
        } = req.body;

        const creatorPage = await CreatorPage.findOne({ userId: req.user._id }).select('_id').lean();
        if (!creatorPage) {
            res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Creator page not found' } });
            return;
        }

        // Combine check and update/create in a single atomic findOneAndUpdate with upsert
        const payoutMethod = await PayoutMethod.findOneAndUpdate(
            { userId: req.user._id },
            {
                $set: {
                    firstName,
                    lastName,
                    dateOfBirth,
                    address1,
                    address2: address2 || '',
                    city,
                    postalCode,
                    bankName,
                    accountHolderName,
                    iban,
                    idType,
                    idNumber,
                    status: 'pending_review',
                    rejectionReason: ''
                },
                $setOnInsert: { pageId: creatorPage._id }
            },
            { new: true, upsert: true }
        ).lean();

        res.status(200).json({
            success: true,
            data: payoutMethod,
        });
    } catch (error) {
        next(error);
    }
};

// Get earnings summary
export const getEarningsSummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const creatorId = req.user._id;

        // Fetch using aggregate to avoid heavy document processing
        const results = await Transaction.aggregate([
            { $match: { creatorId } },
            {
                $group: {
                    _id: null,
                    availableBalance: {
                        $sum: { $cond: [{ $eq: ["$status", "available"] }, "$net", 0] }
                    },
                    pendingBalance: {
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$net", 0] }
                    },
                    lifetimeEarnings: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ["$type", "subscription"] }, { $ne: ["$status", "refunded"] }] },
                                "$net",
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const stats = results[0] || { availableBalance: 0, pendingBalance: 0, lifetimeEarnings: 0 };

        res.json({
            success: true,
            data: {
                availableBalance: stats.availableBalance,
                pendingBalance: stats.pendingBalance,
                lifetimeEarnings: stats.lifetimeEarnings
            }
        });
    } catch (error) {
        next(error);
    }
};
