import { Server as SocketIOServer } from 'socket.io';
import { activePollingTimeouts, pollingPageTokens, liveChatHistory, appendToChatHistory, LiveMessage } from '../controllers/live/shared.js';

export const youtubeIntegration = {
    startYouTubePolling(io: SocketIOServer, sessionId: string, liveChatId: string): void {
        if (activePollingTimeouts.has(sessionId)) return;

        const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            console.warn(`[YT Poll] No API key, skipping polling for session ${sessionId}`);
            return;
        }

        const poll = async () => {
            if (!activePollingTimeouts.has(sessionId) && pollingPageTokens.get(sessionId) === undefined) return;

            try {
                const pageToken = pollingPageTokens.get(sessionId) || '';
                const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&key=${apiKey}${pageToken ? '&pageToken=' + pageToken : ''}`;

                const apiRes = await fetch(url);
                if (!apiRes.ok) {
                    console.error(`[YT Poll] API error for session ${sessionId}:`, await apiRes.text());
                    const retryTimeout = setTimeout(poll, 10000);
                    activePollingTimeouts.set(sessionId, retryTimeout);
                    return;
                }

                interface YouTubeLiveChatMessage {
                    id: string;
                    snippet?: { displayMessage?: string; publishedAt?: string; };
                    authorDetails?: { displayName?: string; profileImageUrl?: string; };
                }

                interface YouTubeLiveChatResponse {
                    nextPageToken?: string;
                    pollingIntervalMillis: number;
                    items?: YouTubeLiveChatMessage[];
                }

                const data: YouTubeLiveChatResponse = await apiRes.json();

                if (data.nextPageToken) {
                    pollingPageTokens.set(sessionId, data.nextPageToken);
                }

                const messages: LiveMessage[] = (data.items || []).map((item: YouTubeLiveChatMessage) => ({
                    id: item.id,
                    source: 'youtube' as const,
                    authorName: item.authorDetails?.displayName || 'Unknown',
                    authorAvatar: item.authorDetails?.profileImageUrl,
                    text: item.snippet?.displayMessage || '',
                    timestamp: new Date(item.snippet?.publishedAt || Date.now()),
                    type: 'chat' as const,
                }));

                if (messages.length > 0) {
                    io.to(`live:${sessionId}`).emit('youtube_message.new', { messages });
                    appendToChatHistory(sessionId, messages);
                }

                const nextTimeout = setTimeout(poll, data.pollingIntervalMillis);
                activePollingTimeouts.set(sessionId, nextTimeout);
            } catch (err) {
                console.error(`[YT Poll] Error for session ${sessionId}:`, err);
                const retryTimeout = setTimeout(poll, 10000);
                activePollingTimeouts.set(sessionId, retryTimeout);
            }
        };

        const initialTimeout = setTimeout(poll, 0);
        activePollingTimeouts.set(sessionId, initialTimeout);
    },

    stopYouTubePolling(sessionId: string): void {
        const timeout = activePollingTimeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            activePollingTimeouts.delete(sessionId);
            pollingPageTokens.delete(sessionId);
            liveChatHistory.delete(sessionId);
        }
    },

    getYoutubeId(url: string): string {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : url;
    },

    async validateYouTubeUrl(url: string) {
        const videoId = this.getYoutubeId(url);
        if (!videoId || videoId.length !== 11) {
            throw new Error('Invalid YouTube URL or Video ID');
        }

        const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return { videoId, isLive: true, title: 'YouTube Live Stream (API Key missing, assuming live)', activeLiveChatId: 'mock-live-chat-id' };
        }

        const apiRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${apiKey}`
        );

        if (!apiRes.ok) {
            throw new Error('Failed to fetch video details from YouTube');
        }

        const data: any = await apiRes.json();
        const item = data.items?.[0];

        if (!item) {
            throw new Error('YouTube video not found');
        }

        const liveStreamingDetails = item.liveStreamingDetails;
        const activeLiveChatId = liveStreamingDetails?.activeLiveChatId;
        const isLive = !!activeLiveChatId;

        return { videoId, isLive, title: item.snippet?.title || 'YouTube Live Stream', activeLiveChatId: activeLiveChatId || null };
    },

    async fetchYouTubeLiveChatId(youtubeVideoId: string): Promise<string | undefined> {
        const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) return undefined;

        try {
            const apiRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${youtubeVideoId}&key=${apiKey}`
            );
            if (apiRes.ok) {
                const data: any = await apiRes.json();
                const item = data.items?.[0];
                return item?.liveStreamingDetails?.activeLiveChatId;
            }
        } catch (err) {
            console.error('Error fetching YouTube live streaming details:', err);
        }
        return undefined;
    }
};
