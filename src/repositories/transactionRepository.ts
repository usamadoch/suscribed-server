import Transaction from '../models/Transaction.js';
import { Types } from 'mongoose';

export const transactionRepository = {
    create: (data: Record<string, unknown>) => {
        return Transaction.create(data);
    },

    findById: (id: string | Types.ObjectId) => {
        return Transaction.findById(id).lean();
    },

    find: (query: Record<string, unknown>, sort?: Record<string, -1 | 1>, skip?: number, limit?: number) => {
        let q: any = Transaction.find(query);
        if (sort) q = q.sort(sort);
        if (skip !== undefined) q = q.skip(skip);
        if (limit !== undefined) q = q.limit(limit);
        return q.lean();
    },

    countDocuments: (query: Record<string, unknown>) => {
        return Transaction.countDocuments(query);
    },

    findOneAndUpdate: (query: Record<string, unknown>, update: Record<string, unknown>) => {
        return Transaction.findOneAndUpdate(query, update, { new: true }).lean();
    }
};
