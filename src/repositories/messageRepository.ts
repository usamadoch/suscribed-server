import Message from '../models/Message.js';

export const messageRepository = {
    find: (query: Record<string, unknown>, sort?: Record<string, -1 | 1>, limit?: number) => {
        let q: any = Message.find(query)
            .populate('senderId', 'displayName username avatarUrl');
        if (sort) q = q.sort(sort);
        if (limit !== undefined) q = q.limit(limit);
        return q;
    },

    countDocuments: (query: Record<string, unknown>) => {
        return Message.countDocuments(query);
    },

    create: (data: Record<string, unknown>) => {
        return Message.create(data);
    },

    findOneAndUpdate: (query: Record<string, unknown>, update: Record<string, unknown>) => {
        return Message.findOneAndUpdate(query, update, { new: true });
    }
};
