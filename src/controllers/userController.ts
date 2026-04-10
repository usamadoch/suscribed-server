import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { userService } from '../services/userService.js';
import { UpdateUserInput } from '../utils/validators.js';

// Get user profile by ID
export const getUserById = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const data = await userService.getUserProfileById(req.params.id);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

// Get user profile by username
export const getUserByUsername = async (req: Request<{ username: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const data = await userService.getUserProfileByUsername(req.params.username);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

// Update current user profile
export const updateCurrentUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user._id.toString();
        const updateData = req.body as UpdateUserInput;
        
        const data = await userService.updateCurrentUserProfile(userId, updateData);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};
