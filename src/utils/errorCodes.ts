/**
 * Standardized API Error Codes and Messages
 * 
 * This file defines all error codes and provides helper functions
 * for consistent error responses across the API.
 */

// Error code definitions
export const ErrorCodes = {
    // Authentication errors (401)
    UNAUTHORIZED: 'UNAUTHORIZED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',

    // Authorization errors (403)
    FORBIDDEN: 'FORBIDDEN',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    NOT_OWNER: 'NOT_OWNER',

    // Validation errors (400)
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

    // Resource errors (404)
    NOT_FOUND: 'NOT_FOUND',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    POST_NOT_FOUND: 'POST_NOT_FOUND',
    PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
    MEMBERSHIP_NOT_FOUND: 'MEMBERSHIP_NOT_FOUND',
    CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
    MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
    NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',

    // Conflict errors (409)
    CONFLICT: 'CONFLICT',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
    DUPLICATE_USERNAME: 'DUPLICATE_USERNAME',
    ALREADY_MEMBER: 'ALREADY_MEMBER',

    // Rate limiting (429)
    RATE_LIMITED: 'RATE_LIMITED',
    TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

    // Server errors (500)
    SERVER_ERROR: 'SERVER_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',

    // Business logic errors (400/403)
    COMMENTS_DISABLED: 'COMMENTS_DISABLED',
    MEMBERS_ONLY: 'MEMBERS_ONLY',
    ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Standard error messages for each code
export const ErrorMessages: Record<ErrorCode, string> = {
    [ErrorCodes.UNAUTHORIZED]: 'Authentication required',
    [ErrorCodes.INVALID_CREDENTIALS]: 'Invalid email or password',
    [ErrorCodes.TOKEN_EXPIRED]: 'Token has expired',
    [ErrorCodes.INVALID_TOKEN]: 'Invalid or malformed token',

    [ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this action',
    [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions for this operation',
    [ErrorCodes.NOT_OWNER]: 'You can only modify your own resources',

    [ErrorCodes.VALIDATION_ERROR]: 'Invalid input data',
    [ErrorCodes.INVALID_INPUT]: 'The provided input is invalid',
    [ErrorCodes.MISSING_REQUIRED_FIELD]: 'A required field is missing',

    [ErrorCodes.NOT_FOUND]: 'The requested resource was not found',
    [ErrorCodes.USER_NOT_FOUND]: 'User not found',
    [ErrorCodes.POST_NOT_FOUND]: 'Post not found',
    [ErrorCodes.PAGE_NOT_FOUND]: 'Creator page not found',
    [ErrorCodes.MEMBERSHIP_NOT_FOUND]: 'Membership not found',
    [ErrorCodes.CONVERSATION_NOT_FOUND]: 'Conversation not found',
    [ErrorCodes.MESSAGE_NOT_FOUND]: 'Message not found',
    [ErrorCodes.NOTIFICATION_NOT_FOUND]: 'Notification not found',

    [ErrorCodes.CONFLICT]: 'Resource already exists',
    [ErrorCodes.ALREADY_EXISTS]: 'This resource already exists',
    [ErrorCodes.DUPLICATE_EMAIL]: 'Email is already registered',
    [ErrorCodes.DUPLICATE_USERNAME]: 'Username is already taken',
    [ErrorCodes.ALREADY_MEMBER]: 'You are already a member',

    [ErrorCodes.RATE_LIMITED]: 'Too many requests, please try again later',
    [ErrorCodes.TOO_MANY_REQUESTS]: 'Request limit exceeded',

    [ErrorCodes.SERVER_ERROR]: 'An unexpected error occurred',
    [ErrorCodes.DATABASE_ERROR]: 'Database operation failed',

    [ErrorCodes.COMMENTS_DISABLED]: 'Comments are disabled for this post',
    [ErrorCodes.MEMBERS_ONLY]: 'This content is only available to members',
    [ErrorCodes.ACCOUNT_DEACTIVATED]: 'This account has been deactivated',
};

// HTTP status code mapping
export const ErrorStatusCodes: Record<ErrorCode, number> = {
    [ErrorCodes.UNAUTHORIZED]: 401,
    [ErrorCodes.INVALID_CREDENTIALS]: 401,
    [ErrorCodes.TOKEN_EXPIRED]: 401,
    [ErrorCodes.INVALID_TOKEN]: 401,

    [ErrorCodes.FORBIDDEN]: 403,
    [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,
    [ErrorCodes.NOT_OWNER]: 403,

    [ErrorCodes.VALIDATION_ERROR]: 400,
    [ErrorCodes.INVALID_INPUT]: 400,
    [ErrorCodes.MISSING_REQUIRED_FIELD]: 400,

    [ErrorCodes.NOT_FOUND]: 404,
    [ErrorCodes.USER_NOT_FOUND]: 404,
    [ErrorCodes.POST_NOT_FOUND]: 404,
    [ErrorCodes.PAGE_NOT_FOUND]: 404,
    [ErrorCodes.MEMBERSHIP_NOT_FOUND]: 404,
    [ErrorCodes.CONVERSATION_NOT_FOUND]: 404,
    [ErrorCodes.MESSAGE_NOT_FOUND]: 404,
    [ErrorCodes.NOTIFICATION_NOT_FOUND]: 404,

    [ErrorCodes.CONFLICT]: 409,
    [ErrorCodes.ALREADY_EXISTS]: 409,
    [ErrorCodes.DUPLICATE_EMAIL]: 409,
    [ErrorCodes.DUPLICATE_USERNAME]: 409,
    [ErrorCodes.ALREADY_MEMBER]: 409,

    [ErrorCodes.RATE_LIMITED]: 429,
    [ErrorCodes.TOO_MANY_REQUESTS]: 429,

    [ErrorCodes.SERVER_ERROR]: 500,
    [ErrorCodes.DATABASE_ERROR]: 500,

    [ErrorCodes.COMMENTS_DISABLED]: 403,
    [ErrorCodes.MEMBERS_ONLY]: 403,
    [ErrorCodes.ACCOUNT_DEACTIVATED]: 403,
};
