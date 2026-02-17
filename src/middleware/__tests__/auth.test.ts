import { jest } from '@jest/globals';
import { requirePermission } from '../auth';
import { createForbiddenError, createUnauthorizedError } from '../errorHandler';
import { AuthenticatedRequest, IUser, UserRole } from '../../types';
import { Response, NextFunction } from 'express';

describe('Auth Middleware - requirePermission', () => {
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {
            user: {
                role: 'member' as UserRole,
            } as unknown as IUser
        };
        mockRes = {};
        mockNext = jest.fn();
    });

    it('should call next() if user has permission', () => {
        mockReq.user!.role = 'admin'; // Admin has all permissions
        const permission = 'post:delete';

        requirePermission(permission)(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next(ForbiddenError) if user lacks permission', () => {
        mockReq.user!.role = 'member'; // Member cannot delete posts
        const permission = 'post:delete';

        requirePermission(permission)(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(createForbiddenError(`Access denied. Required permission: ${permission}`));
    });

    it('should call next(UnauthorizedError) if no user attached', () => {
        mockReq.user = undefined;
        const permission = 'post:read';

        requirePermission(permission)(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(createUnauthorizedError('Authentication required'));
    });
});
