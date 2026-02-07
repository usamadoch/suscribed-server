import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { JWTPayload } from '../types/index.js';
import User from '../models/User.js';

interface SocketUser {
    id: string;
    email: string;
    role: string;
}

interface AuthenticatedSocket extends Socket {
    user?: SocketUser;
}

// Connected users map: userId -> socketId
const connectedUsers = new Map<string, string>();

export const initializeSockets = (io: SocketIOServer): void => {
    // Authentication middleware for sockets
    io.use(async (socket: AuthenticatedSocket, next) => {
        try {
            // Try to get token from auth or from cookies
            let token = socket.handshake.auth.token;

            // Parse cookies from handshake headers
            if (!token && socket.handshake.headers.cookie) {
                const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split('=');
                    acc[key] = value;
                    return acc;
                }, {} as Record<string, string>);
                token = cookies['accessToken'];
            }

            if (!token) {
                // Allow unauthenticated connections for public rooms
                // They just won't have user info
                console.log('Socket connected without auth');
                return next();
            }

            const decoded = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
            const user = await User.findById(decoded.userId);

            if (!user || !user.isActive) {
                return next(new Error('User not found or inactive'));
            }

            socket.user = {
                id: user._id.toString(),
                email: user.email,
                role: user.role,
            };

            next();
        } catch (error) {
            // Allow connection but without user info
            console.log('Socket auth error, connecting anonymously');
            next();
        }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
        const userId = socket.user?.id;

        if (userId) {
            // Store connection
            connectedUsers.set(userId, socket.id);

            // Join personal room for notifications
            socket.join(`user:${userId}`);

            console.log(`User connected: ${userId}`);

            // Broadcast online status
            socket.broadcast.emit('user_online', { userId });
        }

        // Join conversation room
        socket.on('join_room', ({ conversationId }: { conversationId: string }) => {
            socket.join(`conversation:${conversationId}`);
            console.log(`User ${userId} joined conversation:${conversationId}`);
        });

        // Leave conversation room
        socket.on('leave_room', ({ conversationId }: { conversationId: string }) => {
            socket.leave(`conversation:${conversationId}`);
            console.log(`User ${userId} left conversation:${conversationId}`);
        });

        // Typing indicator
        socket.on('typing', ({ conversationId }: { conversationId: string }) => {
            socket.to(`conversation:${conversationId}`).emit('user_typing', {
                userId,
                conversationId,
            });
        });

        // Stop typing indicator
        socket.on('stop_typing', ({ conversationId }: { conversationId: string }) => {
            socket.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
                userId,
                conversationId,
            });
        });

        // Message read acknowledgment
        socket.on('message_read', ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
            socket.to(`conversation:${conversationId}`).emit('message_read', {
                messageId,
                userId,
            });
        });

        // Join creator page room for live updates
        socket.on('join_creator_room', ({ creatorId }: { creatorId: string }) => {
            socket.join(`creator:${creatorId}`);
        });

        socket.on('leave_creator_room', ({ creatorId }: { creatorId: string }) => {
            socket.leave(`creator:${creatorId}`);
        });

        // Disconnect handler
        socket.on('disconnect', () => {
            if (userId) {
                connectedUsers.delete(userId);
                socket.broadcast.emit('user_offline', { userId });
                console.log(`User disconnected: ${userId}`);
            }
        });
    });
};

// Helper function to emit to a specific user
export const emitToUser = (io: SocketIOServer, userId: string, event: string, data: unknown): void => {
    io.to(`user:${userId}`).emit(event, data);
};

// Helper function to emit to a conversation
export const emitToConversation = (io: SocketIOServer, conversationId: string, event: string, data: unknown): void => {
    io.to(`conversation:${conversationId}`).emit(event, data);
};

// Helper function to check if user is online
export const isUserOnline = (userId: string): boolean => {
    return connectedUsers.has(userId);
};

// Helper function to get online users
export const getOnlineUsers = (): string[] => {
    return Array.from(connectedUsers.keys());
};

// Helper function to check if user is in a specific conversation room
export const isUserInConversation = (io: SocketIOServer, userId: string, conversationId: string): boolean => {
    const socketId = connectedUsers.get(userId);
    if (!socketId) return false;

    // Get socket instance
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return false;

    return socket.rooms.has(`conversation:${conversationId}`);
};
