import SuperChatTier, { ISuperChatTierDocument } from '../models/SuperChatTier.js';

export const superChatTierRepository = {
    async findActiveTiersSorted(): Promise<ISuperChatTierDocument[]> {
        return SuperChatTier.find({ isActive: true }).sort({ minAmount: -1 });
    }
};
