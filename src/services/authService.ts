import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

import config from '../config/index.js';
import User, { IUserDocument } from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import CreatorPage from '../models/CreatorPage.js';
import { JWTPayload, UserRole } from '../types/index.js';
import { SignupInput, LoginInput, ChangePasswordInput } from '../utils/validators.js';
import { createError } from '../middleware/errorHandler.js';

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage'
);

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

interface AuthResponse {
    user: Partial<IUserDocument>;
    tokens: AuthTokens;
    isNewUser: boolean;
}

// Check if email exists
export const checkEmail = async (email: string): Promise<boolean> => {
    const user = await User.findOne({ email: email.toLowerCase() });
    return !!user;
};

// Generate JWT tokens
const generateTokens = async (user: IUserDocument): Promise<AuthTokens> => {
    const payload: JWTPayload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role as UserRole,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessExpiry as string,
    } as jwt.SignOptions);

    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Calculate expiry date for refresh token
    const expiryDays = parseInt(config.jwt.refreshExpiry.replace('d', ''), 10) || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Store refresh token in database
    await RefreshToken.create({
        userId: user._id,
        token: refreshToken,
        expiresAt,
    });

    return { accessToken, refreshToken };
};

// Clean user object for response
const sanitizeUser = (user: IUserDocument): Partial<IUserDocument> => {
    const userObj = user.toObject();
    const { passwordHash: _, ...sanitized } = userObj;
    return sanitized;
};

// Signup service
export const signup = async (input: SignupInput): Promise<AuthResponse> => {
    const { email, password, displayName, username, role } = input;

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
        throw createError.duplicateEmail();
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
        throw createError.duplicateUsername();
    }

    // Create user
    const user = await User.create({
        email: email.toLowerCase(),
        passwordHash: password, // Will be hashed by pre-save hook
        displayName,
        username: username.toLowerCase(),
        role,
        isEmailVerified: true, // Skip email verification for MVP
    });

    // If creator, create their page
    if (role === 'creator') {
        await CreatorPage.create({
            userId: user._id,
            pageSlug: username.toLowerCase(),
            displayName,
        });
    }

    // Generate tokens
    const tokens = await generateTokens(user);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    return {
        user: sanitizeUser(user),
        tokens,
        isNewUser: true,
    };
};

// Login service
export const login = async (input: LoginInput): Promise<AuthResponse> => {
    const { email, password } = input;

    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    if (!user) {
        throw createError.invalidCredentials();
    }

    if (!user.isActive) {
        throw createError.accountDeactivated();
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        // If user has googleId, they should use Google login
        if (user.googleId) {
            throw createError.invalidCredentials('This account uses Google Sign-In. Please sign in with Google.');
        }
        throw createError.invalidCredentials();
    }

    // Generate tokens
    const tokens = await generateTokens(user);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    return {
        user: sanitizeUser(user),
        tokens,
        isNewUser: false,
    };
};

// Google Login service
export const googleLogin = async (code: string, role: string = 'member'): Promise<AuthResponse> => {
    // Exchange code for tokens
    const { tokens: googleTokens } = await client.getToken(code);

    if (!googleTokens.id_token) {
        throw createError.invalidInput('Failed to retrieve ID token from Google');
    }

    // Verify Google Token
    const ticket = await client.verifyIdToken({
        idToken: googleTokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
        throw createError.invalidInput('Invalid Google token');
    }

    const { email, name, sub: googleId, picture } = payload;
    const lowerEmail = email.toLowerCase();

    // Check if user exists
    let user = await User.findOne({ email: lowerEmail });
    let isNewUser = false;

    if (!user) {
        isNewUser = true;
        // Create new user if not exists
        const baseUsername = name ? name.replace(/\s/g, '').toLowerCase() : email.split('@')[0];
        // Ensure username is unique and meets criteria
        const uniqueSuffix = crypto.randomBytes(3).toString('hex');
        const username = `${baseUsername.replace(/[^a-z0-9]/g, '')}${uniqueSuffix}`.substring(0, 30);

        // Create random password (user can reset later if they want to use password login)
        const password = crypto.randomBytes(32).toString('hex');

        user = await User.create({
            email: lowerEmail,
            passwordHash: password,
            displayName: name || email.split('@')[0],
            username,
            role: role as UserRole,
            isEmailVerified: true,
            googleId,
            avatarUrl: picture
        });

        // Ensure creator page creation if needed? User role is 'member' by default so no.
    } else {
        // Link Google ID if not already linked
        if (!user.googleId) {
            throw createError.duplicateEmail("This email is already registered. Please log in using your email and password.");
        }
    }

    // Check if user is active
    if (!user.isActive) {
        throw createError.accountDeactivated();
    }

    // Ensure Creator Page exists for creators (handles case where existing member logs in as creator or partial signup)
    if (role === 'creator') {
        // If user role is not creator, upgrade them (optional, depends on business logic, here we assume intention)
        if (user.role !== 'creator') {
            user.role = 'creator';
            await user.save();
        }

        const existingPage = await CreatorPage.findOne({ userId: user._id });
        if (!existingPage) {
            await CreatorPage.create({
                userId: user._id,
                pageSlug: user.username, // Default slug
                displayName: user.displayName,
            });
        }
    }

    // Generate tokens
    const tokens = await generateTokens(user);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    return {
        user: sanitizeUser(user),
        tokens,
        isNewUser,
    };
};

// Refresh token service
export const refreshAccessToken = async (refreshToken: string): Promise<AuthTokens> => {
    // Find refresh token
    const tokenDoc = await RefreshToken.findOne({ token: refreshToken });

    if (!tokenDoc) {
        throw createError.invalidToken();
    }

    if (tokenDoc.expiresAt < new Date()) {
        await RefreshToken.deleteOne({ _id: tokenDoc._id });
        throw createError.tokenExpired();
    }

    // Get user
    const user = await User.findById(tokenDoc.userId);

    if (!user || !user.isActive) {
        throw createError.userNotFound();
    }

    // Delete old refresh token
    await RefreshToken.deleteOne({ _id: tokenDoc._id });

    // Generate new tokens
    return generateTokens(user);
};

// Logout service
export const logout = async (userId: string, refreshToken?: string): Promise<void> => {
    if (refreshToken) {
        // Delete specific refresh token
        await RefreshToken.deleteOne({ userId, token: refreshToken });
    } else {
        // Delete all refresh tokens for user
        await RefreshToken.deleteMany({ userId });
    }
};

// Get current user profile
export const getCurrentUser = async (userId: string): Promise<Partial<IUserDocument> | null> => {
    const user = await User.findById(userId);
    return user ? sanitizeUser(user) : null;
};

// Change password service
export const changePassword = async (
    userId: string,
    input: ChangePasswordInput
): Promise<void> => {
    const { currentPassword, newPassword } = input;

    // Find user with password
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
        throw createError.userNotFound();
    }

    // Check if Google user
    if (user.googleId) {
        throw createError.forbidden('Google authenticated users cannot change password');
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw createError.invalidCredentials('Current password is incorrect');
    }

    // Update password
    user.passwordHash = newPassword; // Pre-save hook will hash it
    await user.save();

    // Invalidate all existing sessions
    await RefreshToken.deleteMany({ userId });
};
