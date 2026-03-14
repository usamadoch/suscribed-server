import Member from '../models/Member.js';

export const memberRepository = {
    find: (query: Record<string, unknown>, select?: string) => {
        let q: any = Member.find(query);
        if (select) q = q.select(select);
        return q;
    },
    
    findOne: (query: Record<string, unknown>) => {
        return Member.findOne(query);
    },

    exists: (query: Record<string, unknown>) => {
        return Member.exists(query);
    }
};
