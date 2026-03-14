import PostLike from '../models/PostLike.js';

export const postLikeRepository = {
    find: (query: Record<string, unknown>, select?: string) => {
        let q: any = PostLike.find(query);
        if (select) q = q.select(select);
        return q;
    },

    exists: (query: Record<string, unknown>) => {
        return PostLike.exists(query);
    },

    findOneAndDelete: (query: Record<string, unknown>) => {
        return PostLike.findOneAndDelete(query);
    },

    create: (data: Record<string, unknown>) => {
        return PostLike.create(data);
    },

    deleteMany: (query: Record<string, unknown>) => {
        return PostLike.deleteMany(query);
    }
};
