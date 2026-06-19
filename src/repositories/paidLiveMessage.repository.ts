import PaidLiveMessage, { IPaidLiveMessageDocument } from '../models/PaidLiveMessage.js';

export const paidLiveMessageRepository = {
    async create(data: Partial<IPaidLiveMessageDocument>): Promise<IPaidLiveMessageDocument> {
        return PaidLiveMessage.create(data);
    },

    async findPendingMessage(msgId: string, sessionId: string, senderId: string): Promise<IPaidLiveMessageDocument | null> {
        return PaidLiveMessage.findOne({ _id: msgId, sessionId, senderId, paymentStatus: 'pending' });
    },

    async findByPaymentId(sessionId: string, paymentId: string): Promise<IPaidLiveMessageDocument | null> {
        return PaidLiveMessage.findOne({ sessionId, paymentId });
    },

    async updatePaymentStatus(msgId: string, paymentStatus: 'paid' | 'failed', newPaymentId?: string): Promise<IPaidLiveMessageDocument | null> {
        const updateData: any = { paymentStatus };
        if (newPaymentId) {
            updateData.paymentId = newPaymentId;
        }
        return PaidLiveMessage.findByIdAndUpdate(msgId, updateData, { new: true });
    }
};
