import Tier from '../models/Tier.js';
import { Types } from 'mongoose';

export const tierRepository = {
    findById: (id: string | Types.ObjectId) => {
        return Tier.findById(id).lean();
    },

    findByCreatorId: (creatorId: string | Types.ObjectId, sort?: Record<string, -1 | 1>) => {
        let q: any = Tier.find({ creatorId });
        if (sort) q = q.sort(sort);
        return q.lean();
    },

    findPublishedByCreatorId: (creatorId: string, sort?: Record<string, -1 | 1>) => {
        let q: any = Tier.find({ creatorId, status: 'published' });
        if (sort) q = q.sort(sort);
        return q.lean();
    },

    findOneByIdAndCreator: (id: string, creatorId: string | Types.ObjectId) => {
        return Tier.findOne({ _id: id, creatorId }).lean();
    },

    create: (data: Record<string, unknown>) => {
        return Tier.create(data);
    },

    findOneAndUpdate: (query: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown> = {}) => {
        return Tier.findOneAndUpdate(query, update, { new: true, ...options }).lean();
    },

    updateById: (id: string | Types.ObjectId, update: Record<string, unknown>) => {
        return Tier.findByIdAndUpdate(id, update, { new: true }).lean();
    },

    updateMany: (query: Record<string, unknown>, update: Record<string, unknown>) => {
        return Tier.updateMany(query, update);
    }
};
