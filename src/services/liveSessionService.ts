import LiveSession from '../models/LiveSession.js';
import Member from '../models/Member.js';
import CreatorPage from '../models/CreatorPage.js';
import { ILiveSessionDocument } from '../models/LiveSession.js';
import { createError } from '../middleware/errorHandler.js';
import { liveSessionRepository } from '../repositories/liveSession.repository.js';
import { superChatTierRepository } from '../repositories/superChatTier.repository.js';
import { youtubeIntegration } from '../integrations/youtube.js';
import { getOrCreateSafepayCustomer, getSavedPaymentMethod } from './safepayService.js';
import { Server as SocketIOServer } from 'socket.io';

// ============================================================================
// SANITIZATION TYPES
// ============================================================================

/**
 * Public session response — safe fields only.
 * Sensitive creator settings (notification prefs, revenue data) are stripped.
 */
export interface PublicLiveSessionResponse {
    _id: string;
    creatorId: string | {
        _id: string;
        displayName: string;
        pageSlug: string;
        avatarUrl?: string | null;
    };
    title: string;
    youtubeVideoId?: string;
    status: 'live' | 'ended';
    startedAt?: Date;
    endedAt?: Date;
    accessType: 'public' | 'members';
    isLocked: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Strips sensitive / creator-only fields from a live session for public view.
 * 
 * For members-only sessions where user is NOT authorized:
 *   → isLocked: true, youtubeVideoId stripped
 * 
 * For public or authorized sessions:
 *   → isLocked: false, stream ID included
 */
function sanitizeSessionForPublic(
    session: ILiveSessionDocument,
    hasAccess: boolean
): PublicLiveSessionResponse {
    const sessionObj = session.toObject ? session.toObject() : session;

    const base: PublicLiveSessionResponse = {
        _id: sessionObj._id.toString(),
        creatorId: sessionObj.creatorId.toString(),
        title: sessionObj.title,
        status: sessionObj.status as 'live' | 'ended',
        startedAt: sessionObj.startedAt,
        endedAt: sessionObj.endedAt,
        accessType: sessionObj.accessType,
        isLocked: !hasAccess,
        createdAt: sessionObj.createdAt,
        updatedAt: sessionObj.updatedAt,
    };

    if (hasAccess) {
        base.youtubeVideoId = sessionObj.youtubeVideoId;
    }

    return base;
}

// ============================================================================
// SERVICE
// ============================================================================

export const liveSessionService = {
    /**
     * Get a live session for public viewing.
     * 
     * - 404 if not found or draft
     * - 401 if members-only and user not authenticated
     * - 403 if members-only and user has no active membership
     * - Returns sanitized session (no revenue data, no notification prefs)
     * - For locked members-only sessions (no access), returns isLocked: true
     *   with youtubeVideoId stripped
     */
    async getPublicSession(sessionId: string, userId: string | null) {
        const sessionDoc = await LiveSession.findById(sessionId);

        if (!sessionDoc) {
            throw createError.notFound('Session');
        }

        if (sessionDoc.status === 'draft') {
            throw createError.notFound('Session');
        }

        const creatorId = sessionDoc.creatorId.toString();
        const isOwner = userId !== null && userId === creatorId;

        let hasAccess = false;

        // Public sessions → everyone has access
        if (sessionDoc.accessType === 'public') {
            hasAccess = true;
        } else {
            // Members-only access check
            if (!userId) {
                // Not logged in → 401
                throw createError.unauthorized('Authentication required to view this session');
            }

            // Owner always has access
            if (isOwner) {
                hasAccess = true;
            } else {
                // Check active membership
                const activeMembership = await Member.findOne({
                    memberId: userId,
                    creatorId,
                    status: 'active',
                });

                if (!activeMembership) {
                    throw createError.forbidden('Members only. Join this creator to access this live session.');
                }
                
                hasAccess = true;
            }
        }

        const response = sanitizeSessionForPublic(sessionDoc, hasAccess);

        // Populate CreatorPage details for the frontend
        const creatorPage = await CreatorPage.findOne({ userId: creatorId }, '_id displayName pageSlug avatarUrl').lean();
        if (creatorPage) {
            response.creatorId = {
                _id: creatorPage._id.toString(),
                displayName: creatorPage.displayName,
                pageSlug: creatorPage.pageSlug,
                avatarUrl: creatorPage.avatarUrl
            };
        }

        return response;
    },

    async createSession(data: any, creatorId: string, io: SocketIOServer) {
        const existingSession = await liveSessionRepository.findActiveSessionByCreatorId(creatorId);
        if (existingSession) throw createError.invalidInput('An active live session already exists');

        const youtubeLiveChatId = data.youtubeVideoId 
            ? await youtubeIntegration.fetchYouTubeLiveChatId(data.youtubeVideoId)
            : undefined;

        const session = await liveSessionRepository.create({
            creatorId,
            ...data,
            youtubeLiveChatId,
            status: 'live',
            startedAt: new Date()
        });

        if (data.mergeYouTubeChat && session.youtubeLiveChatId) {
            youtubeIntegration.startYouTubePolling(io, session._id.toString(), session.youtubeLiveChatId);
        }

        return session;
    },

    async getSessionForControl(sessionId: string, creatorId: string) {
        const session = await liveSessionRepository.findById(sessionId);
        if (!session) throw createError.notFound('Session not found');
        if (session.creatorId.toString() !== creatorId) throw createError.forbidden('Unauthorized to access this session');
        return session;
    },

    async startLive(sessionId: string, creatorId: string, io: SocketIOServer) {
        const session = await liveSessionRepository.findById(sessionId);
        if (!session) throw createError.notFound('Session not found');
        if (session.creatorId.toString() !== creatorId) throw createError.forbidden('Unauthorized');
        if (session.status !== 'live') throw createError.invalidInput('Session is not live');

        if (session.mergeYouTubeChat && session.youtubeLiveChatId) {
            youtubeIntegration.startYouTubePolling(io, sessionId, session.youtubeLiveChatId);
        }

        return session;
    },

    async endLive(sessionId: string, creatorId: string, io: SocketIOServer) {
        const session = await liveSessionRepository.findById(sessionId);
        if (!session) throw createError.notFound('Session not found');
        if (session.creatorId.toString() !== creatorId) throw createError.forbidden('Unauthorized to end this session');
        if (session.status !== 'live') throw createError.invalidInput('Session is already ended');

        const updated = await liveSessionRepository.updateStatus(sessionId, 'ended', new Date());
        youtubeIntegration.stopYouTubePolling(sessionId);

        io.to(`live:${sessionId}`).emit('session.ended', { sessionId });
        return updated;
    },

    async getSuperChatTiers() {
        return superChatTierRepository.findActiveTiersSorted();
    },

    async getWalletStatus(user: any) {
        const customerToken = await getOrCreateSafepayCustomer(user);
        const { getWallet } = await import('./safepayService.js');
        const wallet = await getWallet(customerToken);
        
        if (wallet && wallet.length > 0) {
            const sorted = wallet.sort((a: any, b: any) => b.created_at.seconds - a.created_at.seconds);
            const methods = sorted.map((method: any) => {
                const provider = method.cybersource || method.mpgs || method.payfast || method;
                let brand = 'Card';
                if (provider.scheme === 1) brand = 'Visa';
                if (provider.scheme === 2) brand = 'Mastercard';
                if (typeof provider.scheme === 'string') brand = provider.scheme;
                return {
                    token: method.token,
                    brand,
                    last4: provider.last_four || provider.last4 || '****'
                };
            });
            return { hasSavedCard: true, methods, brand: methods[0].brand, last4: methods[0].last4 };
        } else {
            return { hasSavedCard: false, methods: [] };
        }
    }
};
