import Notification from '../models/Notification.js';
import { Types } from 'mongoose';

export const notificationRepository = {
    find: (query: Record<string, unknown>, sort?: Record<string, -1 | 1>, skip?: number, limit?: number) => {
        let q: any = Notification.find(query);
        if (sort) q = q.sort(sort);
        if (skip !== undefined) q = q.skip(skip);
        if (limit !== undefined) q = q.limit(limit);
        return q;
    },

    countDocuments: (query: Record<string, unknown>) => {
        return Notification.countDocuments(query);
    },

    findOneAndUpdate: (query: Record<string, unknown>, update: Record<string, unknown>) => {
        return Notification.findOneAndUpdate(query, update, { new: true });
    },

    updateMany: (query: Record<string, unknown>, update: Record<string, unknown>) => {
        return Notification.updateMany(query, update);
    },

    findOneAndDelete: (query: Record<string, unknown>) => {
        return Notification.findOneAndDelete(query);
    },

    findOne: (query: Record<string, unknown>) => {
        return Notification.findOne(query);
    },

    create: (data: Record<string, unknown>) => {
        return Notification.create(data);
    },

    insertMany: (data: any[]) => {
        return Notification.insertMany(data);
    }
};
