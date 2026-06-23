import { Server as SocketIOServer } from 'socket.io';
import { liveSessionRepository } from '../repositories/liveSession.repository.js';
import { paidLiveMessageRepository } from '../repositories/paidLiveMessage.repository.js';
import { liveChatMessageRepository } from '../repositories/liveChatMessage.repository.js';
import { superChatTierRepository } from '../repositories/superChatTier.repository.js';
import ChatMute from '../models/ChatMute.js';
import { createTracker, getAuthToken, getSafepayTrackerStatus, getOrCreateSafepayCustomer, getSavedPaymentMethod, chargesavedCard, getWallet, deletePaymentMethod } from './safepayService.js';
import { appendToChatHistory, CommonsLiveMessage } from '../controllers/live/shared.js';
import { createError } from '../middleware/errorHandler.js';
import { SubscriptionService } from './subscriptionService.js';

export const liveMessageService = {
    async initiatePaidMessage(sessionId: string, amount: number, message: string, user: any) {
        if (!amount || amount < 100) throw createError.invalidInput('Invalid amount');

        const session = await liveSessionRepository.findById(sessionId);
        if (!session || session.status !== 'live') throw createError.invalidInput('Session is not active');

        const mute = await ChatMute.findOne({ sessionId: session._id, userId: user._id });
        if (mute && mute.mutedUntil > new Date()) {
            throw createError.forbidden(`You are in timeout until ${mute.mutedUntil.toLocaleTimeString()}`);
        }

        const tiers = await superChatTierRepository.findActiveTiersSorted();
        const tierData = tiers.find(t => amount >= t.minAmount);
        if (!tierData) throw createError.invalidInput('Amount is below minimum requirement');

        const customerToken = await getOrCreateSafepayCustomer(user);
        const tracker = await createTracker(amount, null, customerToken, "PKR", { mode: "payment" });
        const authToken = await getAuthToken();

        const paidMsg = await paidLiveMessageRepository.create({
            sessionId: session._id,
            creatorId: session.creatorId,
            senderId: user._id,
            senderName: user.displayName,
            senderEmail: user.email,
            message: message || '',
            amountPKR: amount,
            tier: tierData.tierLevel,
            tierLabel: tierData.tierLabel,
            bgColor: tierData.bgColor,
            headerColor: tierData.bgColor,
            textColor: tierData.textColor,
            pinDurationMinutes: tierData.pinTimeMinutes,
            maxChars: tierData.maxLength,
            paymentId: tracker.token,
            paymentStatus: 'pending'
        });

        return { trackerToken: tracker.token, authToken, messageId: paidMsg._id };
    },

    async setupTracker(user: any) {
        const customerToken = await getOrCreateSafepayCustomer(user);
        // Using amount 1 for tokenization, some gateways require > 0
        const tracker = await createTracker(1, null, customerToken, "PKR", { mode: "instrument" });
        const authToken = await getAuthToken();
        
        return { trackerToken: tracker.token, authToken };
    },

    async chargeSavedMessage(io: SocketIOServer, sessionId: string, msgId: string, paymentMethodToken: string | undefined, user: any) {
        const paidMsg = await paidLiveMessageRepository.findPendingMessage(msgId, sessionId, user._id.toString());
        if (!paidMsg) throw createError.notFound('Pending message not found');

        const customerToken = await getOrCreateSafepayCustomer(user);
        
        let tokenToCharge = paymentMethodToken;
        if (!tokenToCharge) {
            const savedMethod = await getSavedPaymentMethod(customerToken);
            if (!savedMethod || !savedMethod.token) throw createError.invalidInput('No saved card found');
            tokenToCharge = savedMethod.token;
        }

        try {
            await chargesavedCard(customerToken, tokenToCharge, paidMsg.amountPKR, 'PKR');
        } catch (err: any) {
            console.error("[Safepay] Charge failed:", err);
            const error = createError.invalidInput(err.message || 'Payment failed with saved card.');
            Object.assign(error, { code: err.code || 'CHARGE_FAILED', fallbackToNewCard: true });
            throw error;
        }

        await paidLiveMessageRepository.updatePaymentStatus(msgId, 'paid', 'saved-card-' + paidMsg.paymentId);

        const payload: CommonsLiveMessage = {
            id: paidMsg._id.toString(),
            source: 'commons',
            type: 'paid',
            senderId: user._id.toString(),
            senderName: user.displayName,
            senderAvatar: user.avatarUrl || null,
            message: paidMsg.message,
            amountPKR: SubscriptionService.calculateFees(paidMsg.amountPKR).net,
            tier: paidMsg.tier,
            bgColor: paidMsg.bgColor,
            headerColor: paidMsg.headerColor,
            textColor: paidMsg.textColor,
            isPinned: false,
            isHearted: false,
            timestamp: new Date(),
        };

        io.to(`live:${sessionId}`).emit('chat_message.new', { message: payload });
        appendToChatHistory(sessionId, [payload]);
    },

    async confirmPaidMessage(io: SocketIOServer, sessionId: string, trackerToken: string, user: any) {
        const paidMsg = await paidLiveMessageRepository.findByPaymentId(sessionId, trackerToken);
        if (!paidMsg) throw createError.notFound('Message not found');

        if (paidMsg.paymentStatus === 'paid') {
            // Already marked as paid by the webhook. We still emit the socket event to ensure it shows up in chat.
        } else {
            const status = await getSafepayTrackerStatus(trackerToken);
            if (status?.data?.state !== 'TRACKER_ENDED') throw createError.invalidInput('Payment not completed');

            await paidLiveMessageRepository.updatePaymentStatus(paidMsg._id.toString(), 'paid');
        }

        try {
            const customerToken = user.safepayCustomerToken;
            // Removed automatic deletion of older payment methods to support multiple saved cards.
        } catch (e) {
            console.error("Error with payment methods cleanup:", e);
        }

        const payload: CommonsLiveMessage = {
            id: paidMsg._id.toString(),
            source: 'commons',
            type: 'paid',
            senderId: user._id.toString(),
            senderName: user.displayName,
            senderAvatar: user.avatarUrl || null,
            message: paidMsg.message,
            amountPKR: SubscriptionService.calculateFees(paidMsg.amountPKR).net,
            tier: paidMsg.tier,
            bgColor: paidMsg.bgColor,
            headerColor: paidMsg.headerColor,
            textColor: paidMsg.textColor,
            isPinned: false,
            isHearted: false,
            timestamp: new Date(),
        };

        io.to(`live:${sessionId}`).emit('chat_message.new', { message: payload });
        appendToChatHistory(sessionId, [payload]);
    },

    async sendChatMessage(io: SocketIOServer, sessionId: string, message: string, user: any) {
        const session = await liveSessionRepository.findById(sessionId);
        if (!session) throw createError.notFound('Session not found');
        if (session.status !== 'live') throw createError.invalidInput('Session is not live');

        const mute = await ChatMute.findOne({ sessionId: session._id, userId: user._id });
        if (mute && mute.mutedUntil > new Date()) {
            throw createError.forbidden(`You are in timeout until ${mute.mutedUntil.toLocaleTimeString()}`);
        }

        const chatMsg = await liveChatMessageRepository.create({
            sessionId: session._id,
            senderId: user._id,
            senderName: user.displayName,
            senderAvatar: user.avatarUrl || null,
            message: message.trim(),
        });

        const payload: CommonsLiveMessage = {
            id: chatMsg._id.toString(),
            source: 'commons',
            type: 'free',
            senderId: user._id.toString(),
            senderName: user.displayName,
            senderAvatar: user.avatarUrl || null,
            message: chatMsg.message,
            amountPKR: 0,
            tier: 0,
            bgColor: '',
            headerColor: '',
            textColor: '',
            isPinned: false,
            isHearted: false,
            timestamp: new Date(),
        };

        io.to(`live:${sessionId}`).emit('chat_message.new', { message: payload });
        appendToChatHistory(sessionId, [payload]);

        return payload;
    }
};
