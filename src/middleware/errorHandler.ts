import { Request, Response, NextFunction } from 'express';
import { ErrorCodes, ErrorMessages, ErrorStatusCodes, ErrorCode } from '../utils/errorCodes.js';
import logger from '../config/logger.js';

/**
 * Standard API Error Response Structure
 */
interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, string[]>;
    };
}

/**
 * Custom Application Error class with standardized error codes
 */
export class AppError extends Error {
    statusCode: number;
    code: ErrorCode;
    details?: Record<string, string[]>;
    isOperational: boolean;

    constructor(
        code: ErrorCode,
        message?: string,
        details?: Record<string, string[]>
    ) {
        super(message || ErrorMessages[code]);
        this.code = code;
        this.statusCode = ErrorStatusCodes[code];
        this.details = details;
        this.isOperational = true; // Distinguishes from programming errors
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error factory functions for common error types
 */
export const createError = {
    // Authentication errors
    unauthorized: (message?: string) =>
        new AppError(ErrorCodes.UNAUTHORIZED, message),

    invalidCredentials: (message?: string) =>
        new AppError(ErrorCodes.INVALID_CREDENTIALS, message),

    tokenExpired: () =>
        new AppError(ErrorCodes.TOKEN_EXPIRED),

    invalidToken: () =>
        new AppError(ErrorCodes.INVALID_TOKEN),

    // Authorization errors
    forbidden: (message?: string) =>
        new AppError(ErrorCodes.FORBIDDEN, message),

    notOwner: (resource = 'resource') =>
        new AppError(ErrorCodes.NOT_OWNER, `You can only modify your own ${resource}`),

    insufficientPermissions: (action = 'this action') =>
        new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS, `You do not have permission to perform ${action}`),

    // Validation errors
    validation: (details: Record<string, string[]>) =>
        new AppError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', details),

    invalidInput: (message: string) =>
        new AppError(ErrorCodes.INVALID_INPUT, message),

    // Not found errors
    notFound: (resource = 'Resource') =>
        new AppError(ErrorCodes.NOT_FOUND, `${resource} not found`),

    userNotFound: () =>
        new AppError(ErrorCodes.USER_NOT_FOUND),

    postNotFound: () =>
        new AppError(ErrorCodes.POST_NOT_FOUND),

    pageNotFound: () =>
        new AppError(ErrorCodes.PAGE_NOT_FOUND),

    membershipNotFound: () =>
        new AppError(ErrorCodes.MEMBERSHIP_NOT_FOUND),

    conversationNotFound: () =>
        new AppError(ErrorCodes.CONVERSATION_NOT_FOUND),

    notificationNotFound: () =>
        new AppError(ErrorCodes.NOTIFICATION_NOT_FOUND),

    // Conflict errors
    conflict: (message: string) =>
        new AppError(ErrorCodes.CONFLICT, message),

    duplicateEmail: (message?: string) =>
        new AppError(ErrorCodes.DUPLICATE_EMAIL, message),

    duplicateUsername: () =>
        new AppError(ErrorCodes.DUPLICATE_USERNAME),

    alreadyMember: () =>
        new AppError(ErrorCodes.ALREADY_MEMBER),

    // Rate limiting
    rateLimited: (message?: string) =>
        new AppError(ErrorCodes.RATE_LIMITED, message),

    // Business logic errors
    commentsDisabled: () =>
        new AppError(ErrorCodes.COMMENTS_DISABLED),

    membersOnly: () =>
        new AppError(ErrorCodes.MEMBERS_ONLY),

    accountDeactivated: () =>
        new AppError(ErrorCodes.ACCOUNT_DEACTIVATED),

    // Server errors
    server: (message?: string) =>
        new AppError(ErrorCodes.SERVER_ERROR, message),
};

// Legacy aliases for backwards compatibility
export const createValidationError = createError.validation;
export const createUnauthorizedError = createError.unauthorized;
export const createForbiddenError = createError.forbidden;
export const createNotFoundError = createError.notFound;
export const createConflictError = createError.conflict;
export const createRateLimitError = createError.rateLimited;

/**
 * Global error handler middleware
 */
export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Log error with correlation ID
    const logData = {
        correlationId: req.correlationId,
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
    };

    // Determine if this is an operational error (expected) or programming error
    const isAppError = err instanceof AppError;

    if (isAppError && err.isOperational) {
        // Operational error - log as warning
        logger.warn('Operational error', logData);
    } else {
        // Programming error - log as error
        logger.error('Unexpected error', logData);
    }

    // Build response
    const statusCode = isAppError ? err.statusCode : 500;
    const code = isAppError ? err.code : ErrorCodes.SERVER_ERROR;
    const message = isAppError ? err.message : 'An unexpected error occurred';

    const response: ErrorResponse = {
        success: false,
        error: {
            code,
            message,
            ...(isAppError && err.details && { details: err.details }),
        },
    };

    res.status(statusCode).json(response);
};

export default errorHandler;
