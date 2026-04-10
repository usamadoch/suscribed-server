import PayoutMethod from '../models/PayoutMethod.js';
import { Types } from 'mongoose';

export const payoutMethodRepository = {
    create: (data: Record<string, unknown>) => {
        return PayoutMethod.create(data);
    },

    findById: (id: string | Types.ObjectId) => {
        return PayoutMethod.findById(id).lean();
    },

    findOne: (query: Record<string, unknown>) => {
        return PayoutMethod.findOne(query).lean();
    },

    updateById: (id: string | Types.ObjectId, update: Record<string, unknown>) => {
        return PayoutMethod.findByIdAndUpdate(id, update, { new: true }).lean();
    },

    deleteById: (id: string | Types.ObjectId) => {
        return PayoutMethod.findByIdAndDelete(id).lean();
    }
};
