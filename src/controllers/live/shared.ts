import { Server as SocketIOServer } from 'socket.io';

export const activePollingTimeouts = new Map<string, NodeJS.Timeout>();
export const pollingPageTokens = new Map<string, string>();
export const MAX_CHAT_HISTORY = 200;

export interface YouTubeLiveMessage {
    id: string;
    source: 'youtube';
    authorName: string;
    authorAvatar?: string;
    text: string;
    timestamp: Date;
    type: 'chat';
}

export interface CommonsLiveMessage {
    id: string;
    source: 'commons';
    type: 'free' | 'paid';
    senderName: string;
    senderAvatar?: string | null;
    message: string;
    amountPKR: number;
    tier: number;
    bgColor: string;
    headerColor: string;
    textColor: string;
    isPinned: boolean;
    isHearted: boolean;
    timestamp: Date;
}

export type ChatHistoryMessage = YouTubeLiveMessage | CommonsLiveMessage;
export type LiveMessage = YouTubeLiveMessage;

export const liveChatHistory = new Map<string, ChatHistoryMessage[]>();

export function getLiveChatHistory(sessionId: string): ChatHistoryMessage[] {
    return liveChatHistory.get(sessionId) || [];
}

export function appendToChatHistory(sessionId: string, messages: ChatHistoryMessage[]): void {
    const existing = liveChatHistory.get(sessionId) || [];
    const merged = [...existing, ...messages];
    liveChatHistory.set(sessionId, merged.slice(-MAX_CHAT_HISTORY));
}
