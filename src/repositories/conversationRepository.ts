import Conversation from '../models/Conversation.js';
import { Types } from 'mongoose';

export const conversationRepository = {
    findByParticipant: (
        userId: Types.ObjectId,
        sort?: Record<string, -1 | 1>,
        skip?: number,
        limit?: number
    ) => {
        let q: any = Conversation.find({ participants: userId, isActive: true })
            .populate('creatorId', 'displayName username avatarUrl')
            .populate('memberId', 'displayName username avatarUrl');
        if (sort) q = q.sort(sort);
        if (skip !== undefined) q = q.skip(skip);
        if (limit !== undefined) q = q.limit(limit);
        return q;
    },

    countByParticipant: (userId: Types.ObjectId) => {
        return Conversation.countDocuments({ participants: userId, isActive: true });
    },

    findOneByParticipants: (participants: Types.ObjectId[]) => {
        return Conversation.findOne({ participants: { $all: participants } });
    },

    exists: (query: Record<string, unknown>) => {
        return Conversation.exists(query);
    },

    create: (data: Record<string, unknown>) => {
        return Conversation.create(data);
    },

    updateOne: (query: Record<string, unknown>, update: Record<string, unknown>) => {
        return Conversation.updateOne(query, update);
    },

    aggregate: (pipeline: any[]) => {
        return Conversation.aggregate(pipeline);
    }
};
