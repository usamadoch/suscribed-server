import CreatorPage from '../models/CreatorPage.js';
import { Types } from 'mongoose';

export const creatorPageRepository = {
    findOne: (query: Record<string, unknown>, select?: string) => {
        let q: any = CreatorPage.findOne(query);
        if (select) q = q.select(select);
        return q;
    },

    findById: (id: string | Types.ObjectId, select?: string) => {
        let q: any = CreatorPage.findById(id);
        if (select) q = q.select(select);
        return q;
    },
    
    updateOne: (query: Record<string, unknown>, update: Record<string, unknown>) => {
        return CreatorPage.updateOne(query, update);
    }
};
