import Subscription from '../models/Subscription.js';
import { Types } from 'mongoose';

export const subscriptionRepository = {
    create: (data: Record<string, unknown>) => {
        return Subscription.create(data);
    },

    findOne: (query: Record<string, unknown>, sort?: Record<string, -1 | 1>) => {
        let q: any = Subscription.findOne(query);
        if (sort) q = q.sort(sort);
        return q;
    },

    updateById: (id: string | Types.ObjectId, update: Record<string, unknown>) => {
        return Subscription.findByIdAndUpdate(id, update, { new: true }).lean();
    }
};
