import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as authService from '../services/authService.js';
import config from '../config/index.js';

// Cookie options
// Cookie options
const cookieOptions = {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: config.env === 'production' ? 'none' as const : 'lax' as const,
    path: '/',
    domain: config.env === 'production' ? '.onrender.com' : undefined // Optional but helps sometimes
};

// Signup controller
export const signup = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const result = await authService.signup(req.body);

        // Set cookies
        res.cookie('accessToken', result.tokens.accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie('refreshToken', result.tokens.refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(201).json({
            success: true,
            data: {
                user: result.user,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Check email controller
export const checkEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Email is required',
                },
            });
            return;
        }

        const exists = await authService.checkEmail(email);
        res.json({
            success: true,
            data: { exists },
        });
    } catch (error) {
        next(error);
    }
};

// Login controller
export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const result = await authService.login(req.body);

        // Set cookies
        res.cookie('accessToken', result.tokens.accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000,
        });

        res.cookie('refreshToken', result.tokens.refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({
            success: true,
            data: {
                user: result.user,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Google Login controller
export const googleLogin = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { code, role } = req.body;

        if (!code) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Authorization code is required',
                },
            });
            return;
        }

        const result = await authService.googleLogin(code, role);

        // Set cookies
        res.cookie('accessToken', result.tokens.accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000,
        });

        res.cookie('refreshToken', result.tokens.refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({
            success: true,
            data: {
                user: result.user,
                isNewUser: result.isNewUser,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Refresh token controller
export const refresh = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'No refresh token provided',
                },
            });
            return;
        }

        const tokens = await authService.refreshAccessToken(refreshToken);

        // Set new cookies
        res.cookie('accessToken', tokens.accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000,
        });

        res.cookie('refreshToken', tokens.refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({
            success: true,
            data: { message: 'Tokens refreshed successfully' },
        });
    } catch (error) {
        next(error);
    }
};

// Logout controller
export const logout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const refreshToken = req.cookies.refreshToken;
        // user is guaranteed by AuthenticatedRequest
        const userId = req.user._id.toString();

        await authService.logout(userId, refreshToken);

        // Clear cookies
        res.clearCookie('accessToken', cookieOptions);
        res.clearCookie('refreshToken', cookieOptions);

        res.json({
            success: true,
            data: { message: 'Logged out successfully' },
        });
    } catch (error) {
        next(error);
    }
};

// Get current user controller
export const me = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user._id.toString();
        const user = await authService.getCurrentUser(userId);

        if (!user) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found',
                },
            });
            return;
        }

        res.json({
            success: true,
            data: { user },
        });
    } catch (error) {
        next(error);
    }
};

// Change password controller
export const changePassword = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user._id.toString();
        await authService.changePassword(userId, req.body);

        res.json({
            success: true,
            data: { message: 'Password updated successfully' },
        });
    } catch (error) {
        next(error);
    }
};
