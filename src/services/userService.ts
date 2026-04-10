import { userRepository } from '../repositories/userRepository.js';
import { creatorPageRepository } from '../repositories/creatorPageRepository.js';
import { createError } from '../middleware/errorHandler.js';
import { UpdateUserInput } from '../utils/validators.js';

export const userService = {
    async getUserProfileById(id: string) {
        const user = await userRepository.findById(id, '-passwordHash -notificationPreferences');
        if (!user) {
            throw createError.notFound('User');
        }

        let page = null;
        if (user.role === 'creator') {
            page = await creatorPageRepository.findOne({ userId: user._id });
        }

        return { user, page };
    },

    async getUserProfileByUsername(username: string) {
        const user = await userRepository.findByUsername(username, '-passwordHash -notificationPreferences');
        if (!user) {
            throw createError.notFound('User');
        }

        let page = null;
        if (user.role === 'creator') {
            page = await creatorPageRepository.findOne({ userId: user._id });
        }

        return { user, page };
    },

    async updateCurrentUserProfile(userId: string, updateData: UpdateUserInput) {
        const updatedUser = await userRepository.updateById(userId, updateData as Record<string, unknown>, '-passwordHash');
        if (!updatedUser) {
            throw createError.notFound('User');
        }
        return { user: updatedUser };
    }
};
