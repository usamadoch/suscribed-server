import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JWTPayload, UserRole } from '../types/index.js';
import config from '../config/index.js';

import { createUnauthorizedError, createForbiddenError } from './errorHandler.js';
import User from 'models/User.js';

// Protect routes - require authentication
export const protect = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        let token: string | undefined;

        // Check for token in cookies first, then Authorization header
        if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        } else if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(createUnauthorizedError('No token provided'));
        }

        // Verify token
        const decoded = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;

        // Get user from database
        const user = await User.findById(decoded.userId).select('-passwordHash');

        if (!user) {
            return next(createUnauthorizedError('User not found'));
        }

        if (!user.isActive) {
            return next(createUnauthorizedError('Account is deactivated'));
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return next(createUnauthorizedError('Token expired'));
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return next(createUnauthorizedError('Invalid token'));
        }
        next(error);
    }
};

// Optional authentication - attach user if token present, but don't require it
export const optionalAuth = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        let token: string | undefined;

        if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        } else if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
        const user = await User.findById(decoded.userId).select('-passwordHash');

        if (user && user.isActive) {
            req.user = user;
        }

        next();
    } catch {
        // Token invalid or expired, but that's okay for optional auth
        next();
    }
};

// Require specific role
export const requireRole = (...roles: UserRole[]) => {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(createUnauthorizedError('Authentication required'));
        }

        if (!roles.includes(req.user.role)) {
            return next(createForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`));
        }

        next();
    };
};

// Require creator role specifically
export const requireCreator = requireRole('creator', 'admin');

// Require admin role specifically
export const requireAdmin = requireRole('admin');

import { Permission } from '../types/index.js';
import { hasPermission } from 'constants/permissions.js';

// Require specific permission
export const requirePermission = (permission: Permission) => {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(createUnauthorizedError('Authentication required'));
        }

        if (!hasPermission(req.user.role, permission)) {
            return next(createForbiddenError(`Access denied. Required permission: ${permission}`));
        }

        next();
    };
};
