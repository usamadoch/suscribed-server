import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import User from '../models/User.js';
import CreatorPage from '../models/CreatorPage.js';
import { UpdateUserInput } from '../utils/validators.js';

// Get user profile by ID
export const getUserById = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .select('-passwordHash -notificationPreferences');

        if (!user) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' },
            });
            return;
        }

        // If creator, include page info
        let page = null;
        if (user.role === 'creator') {
            page = await CreatorPage.findOne({ userId: user._id });
        }

        res.json({
            success: true,
            data: { user, page },
        });
    } catch (error) {
        next(error);
    }
};

// Get user profile by username
export const getUserByUsername = async (req: Request<{ username: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username: username.toLowerCase() })
            .select('-passwordHash -notificationPreferences');

        if (!user) {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' },
            });
            return;
        }

        // If creator, include page info
        let page = null;
        if (user.role === 'creator') {
            page = await CreatorPage.findOne({ userId: user._id });
        }

        res.json({
            success: true,
            data: { user, page },
        });
    } catch (error) {
        next(error);
    }
};

// Update current user profile
export const updateCurrentUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user._id;
        const updateData = req.body as UpdateUserInput;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-passwordHash');

        res.json({
            success: true,
            data: { user: updatedUser },
        });
    } catch (error) {
        next(error);
    }
};
