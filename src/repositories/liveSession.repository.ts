import LiveSession, { ILiveSessionDocument } from '../models/LiveSession.js';

export const liveSessionRepository = {
    async create(data: Partial<ILiveSessionDocument>): Promise<ILiveSessionDocument> {
        return LiveSession.create(data);
    },

    async findById(sessionId: string): Promise<ILiveSessionDocument | null> {
        return LiveSession.findById(sessionId);
    },

    async findActiveSessionByCreatorId(creatorId: string): Promise<ILiveSessionDocument | null> {
        return LiveSession.findOne({ creatorId, status: 'live' });
    },

    async updateStatus(sessionId: string, status: 'ended', endedAt: Date): Promise<ILiveSessionDocument | null> {
        return LiveSession.findByIdAndUpdate(
            sessionId,
            { status, endedAt },
            { new: true }
        );
    },

    async findSessionsByCreatorId(creatorId: string): Promise<ILiveSessionDocument[]> {
        return LiveSession.find({ creatorId }).sort({ createdAt: -1 });
    },

    async deleteSessionById(sessionId: string): Promise<ILiveSessionDocument | null> {
        return LiveSession.findByIdAndDelete(sessionId);
    }
};
