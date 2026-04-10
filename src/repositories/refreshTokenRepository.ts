import RefreshToken from '../models/RefreshToken.js';
import { Types } from 'mongoose';

export const refreshTokenRepository = {
    create: (data: Record<string, unknown>) => {
        return RefreshToken.create(data);
    },

    findOne: (query: Record<string, unknown>) => {
        return RefreshToken.findOne(query);
    },

    deleteOne: (query: Record<string, unknown>) => {
        return RefreshToken.deleteOne(query);
    },

    deleteMany: (query: Record<string, unknown>) => {
        return RefreshToken.deleteMany(query);
    }
};
