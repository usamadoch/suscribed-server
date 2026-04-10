import Member from '../models/Member.js';
import { Types } from 'mongoose';

export const memberRepository = {
    find: (query: Record<string, unknown>, select?: string) => {
        let q: any = Member.find(query);
        if (select) q = q.select(select);
        return q;
    },

    findMemberSubscriptions: (
        memberId: Types.ObjectId,
        sort?: Record<string, -1 | 1>,
        skip?: number,
        limit?: number
    ) => {
        let q: any = Member.find({ memberId, status: 'active' })
            .populate({
                path: 'pageId',
                select: 'pageSlug displayName avatarUrl bannerUrl tagline memberCount',
            })
            .populate('creatorId', 'displayName username avatarUrl');
        if (sort) q = q.sort(sort);
        if (skip !== undefined) q = q.skip(skip);
        if (limit !== undefined) q = q.limit(limit);
        return q;
    },

    findCreatorMembers: (
        creatorId: Types.ObjectId,
        sort?: Record<string, -1 | 1>,
        skip?: number,
        limit?: number
    ) => {
        let q: any = Member.find({ creatorId, status: 'active' })
            .populate('memberId', 'displayName username avatarUrl bio createdAt');
        if (sort) q = q.sort(sort);
        if (skip !== undefined) q = q.skip(skip);
        if (limit !== undefined) q = q.limit(limit);
        return q;
    },

    countDocuments: (query: Record<string, unknown>) => {
        return Member.countDocuments(query);
    },
    
    findOne: (query: Record<string, unknown>) => {
        return Member.findOne(query);
    },

    exists: (query: Record<string, unknown>) => {
        return Member.exists(query);
    },

    aggregate: (pipeline: any[]) => {
        return Member.aggregate(pipeline);
    },

    findOneAndUpdate: (query: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown> = {}) => {
        return Member.findOneAndUpdate(query, update, options).lean();
    },

    create: (data: Record<string, unknown>) => {
        return Member.create(data);
    },

    findById: (id: string | Types.ObjectId) => {
        return Member.findById(id).lean();
    }
};
