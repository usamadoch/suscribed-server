import LiveChatMessage, { ILiveChatMessageDocument } from '../models/LiveChatMessage.js';

export const liveChatMessageRepository = {
    async create(data: Partial<ILiveChatMessageDocument>): Promise<ILiveChatMessageDocument> {
        return LiveChatMessage.create(data);
    }
};
