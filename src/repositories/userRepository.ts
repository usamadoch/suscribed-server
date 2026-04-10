import User from '../models/User.js';
import { Types } from 'mongoose';

export const userRepository = {
    findById: (id: string | Types.ObjectId, select?: string) => {
        let q: any = User.findById(id);
        if (select) q = q.select(select);
        return q;
    },

    findOne: (query: Record<string, unknown>, select?: string) => {
        let q: any = User.findOne(query);
        if (select) q = q.select(select);
        return q;
    },

    findByUsername: (username: string, select?: string) => {
        let q: any = User.findOne({ username: username.toLowerCase() });
        if (select) q = q.select(select);
        return q;
    },

    findByEmail: (email: string, select?: string) => {
        let q: any = User.findOne({ email: email.toLowerCase() });
        if (select) q = q.select(select);
        return q;
    },

    existsByEmail: (email: string) => {
        return User.exists({ email: email.toLowerCase() });
    },

    create: (data: Record<string, unknown>) => {
        return User.create(data);
    },

    updateById: (id: string | Types.ObjectId, updateData: Record<string, unknown>, select?: string) => {
        let q: any = User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );
        if (select) q = q.select(select);
        return q;
    },

    find: (query: Record<string, unknown>, select?: string) => {
        let q: any = User.find(query);
        if (select) q = q.select(select);
        return q;
    }
};
