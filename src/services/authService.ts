import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

import config from '../config/index.js';
import { userRepository } from '../repositories/userRepository.js';
import { refreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { creatorPageRepository } from '../repositories/creatorPageRepository.js';
import { IUserDocument } from '../models/User.js';
import { JWTPayload, UserRole, ONBOARDING_STEPS, OnboardingStep } from '../types/index.js';
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
    const userExists = await userRepository.existsByEmail(email);
    return !!userExists;
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
    await refreshTokenRepository.create({
        userId: user._id,
        token: refreshToken,
        expiresAt,
    });

    return { accessToken, refreshToken };
};


// Lean user object for auth responses — only fields the auth store needs
const sanitizeUserForAuth = (user: IUserDocument): Partial<IUserDocument> => {
    const obj = user.toObject();
    return {
        _id: obj._id,
        email: obj.email,
        role: obj.role,
        displayName: obj.displayName,
        username: obj.username,
        avatarUrl: obj.avatarUrl,
        onboardingStep: obj.onboardingStep,
    };
};

// Signup service
export const signup = async (input: SignupInput): Promise<AuthResponse> => {
    const { email, password, displayName, username, role } = input;

    // Check if email already exists
    const existingEmail = await userRepository.findByEmail(email);
    if (existingEmail) {
        throw createError.duplicateEmail();
    }

    // Check if username already exists
    const existingUsername = await userRepository.findByUsername(username);
    if (existingUsername) {
        throw createError.duplicateUsername();
    }

    // Create user
    const user = await userRepository.create({
        email: email.toLowerCase(),
        passwordHash: password, // Will be hashed by pre-save hook
        displayName,
        username: username.toLowerCase(),
        role,
        isEmailVerified: true, // Skip email verification for MVP
        onboardingStep: role === 'creator' ? ONBOARDING_STEPS.ACCOUNT_CREATED : ONBOARDING_STEPS.COMPLETE,
    }) as IUserDocument;

    // If creator, create their page
    if (role === 'creator') {
        await creatorPageRepository.create({
            userId: user._id,
            pageSlug: username.toLowerCase(),
            displayName,
        });
    }

    // Generate tokens
    const tokens = await generateTokens(user);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save(); // Using .save() here because we have the document and it has Mongoose hooks

    return {
        user: sanitizeUserForAuth(user),
        tokens,
        isNewUser: true,
    };
};

// Login service
export const login = async (input: LoginInput): Promise<AuthResponse> => {
    const { email, password } = input;

    // Find user with password field
    const user = await userRepository.findOne({ email: email.toLowerCase() }, '+passwordHash') as IUserDocument;

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
        user: sanitizeUserForAuth(user),
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
    let user = await userRepository.findByEmail(lowerEmail) as IUserDocument;
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

        user = await userRepository.create({
            email: lowerEmail,
            passwordHash: password,
            displayName: name || email.split('@')[0],
            username,
            role: role as UserRole,
            isEmailVerified: true,
            googleId,
            avatarUrl: picture,
            onboardingStep: role === 'creator' ? ONBOARDING_STEPS.ACCOUNT_CREATED : ONBOARDING_STEPS.COMPLETE,
        }) as IUserDocument;
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

    // Ensure Creator Page exists for creators
    if (role === 'creator') {
        if (user.role !== 'creator') {
            user.role = 'creator';
            await user.save();
        }

        const existingPage = await creatorPageRepository.findOne({ userId: user._id });
        if (!existingPage) {
            await creatorPageRepository.create({
                userId: user._id,
                pageSlug: user.username,
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
        user: sanitizeUserForAuth(user),
        tokens,
        isNewUser,
    };
};

// Refresh token service
export const refreshAccessToken = async (refreshToken: string): Promise<AuthTokens> => {
    // Find refresh token
    const tokenDoc = await refreshTokenRepository.findOne({ token: refreshToken });

    if (!tokenDoc) {
        throw createError.invalidToken();
    }

    if (tokenDoc.expiresAt < new Date()) {
        await refreshTokenRepository.deleteOne({ _id: tokenDoc._id });
        throw createError.tokenExpired();
    }

    // Get minimal user required for generating tokens
    const user = await userRepository.findById(tokenDoc.userId, '_id email role isActive') as IUserDocument;

    if (!user || !user.isActive) {
        throw createError.userNotFound();
    }

    // Delete old refresh token
    await refreshTokenRepository.deleteOne({ _id: tokenDoc._id });

    // Generate new tokens
    return generateTokens(user);
};

// Logout service
export const logout = async (userId: string, refreshToken?: string): Promise<void> => {
    if (refreshToken) {
        // Delete specific refresh token
        await refreshTokenRepository.deleteOne({ userId, token: refreshToken });
    } else {
        // Delete all refresh tokens for user
        await refreshTokenRepository.deleteMany({ userId });
    }
};

// Get current user — lean auth fields only (used by /auth/me)
export const getCurrentUser = async (userId: string): Promise<Partial<IUserDocument> | null> => {
    const user = await userRepository.findById(userId, '_id email role displayName username avatarUrl onboardingStep');
    return user ? user.toObject() as Partial<IUserDocument> : null;
};

// Get full user profile (used by settings page via /auth/me/full)
export const getFullUser = async (userId: string): Promise<Partial<IUserDocument> | null> => {
    const user = await userRepository.findById(userId, '-passwordHash -__v -lastLoginAt -isActive');
    return user ? user.toObject() as Partial<IUserDocument> : null;
};

// Change password service
export const changePassword = async (
    userId: string,
    input: ChangePasswordInput
): Promise<void> => {
    const { currentPassword, newPassword } = input;

    // Find user with password
    const user = await userRepository.findById(userId, '+passwordHash') as IUserDocument;
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
    await refreshTokenRepository.deleteMany({ userId });
};

// Update onboarding step
export const updateOnboardingStep = async (
    userId: string,
    step: number
): Promise<Partial<IUserDocument> | null> => {
    if (step < ONBOARDING_STEPS.ACCOUNT_CREATED || step > ONBOARDING_STEPS.COMPLETE) {
        throw createError.invalidInput(`Invalid onboarding step. Must be between ${ONBOARDING_STEPS.ACCOUNT_CREATED} and ${ONBOARDING_STEPS.COMPLETE}.`);
    }

    const validStep = step as OnboardingStep;

    const user = await userRepository.findById(userId) as IUserDocument;
    if (!user) {
        throw createError.userNotFound();
    }

    // Only allow forward movement (prevent going back)
    if (validStep <= user.onboardingStep) {
        return sanitizeUserForAuth(user);
    }

    user.onboardingStep = validStep;
    await user.save();

    return sanitizeUserForAuth(user);
};

// Fetch YouTube Channels
export const fetchYoutubeChannels = async (userId: string, code: string): Promise<{ channels: any[], token: string }> => {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const googleRes = await client.request({
        url: 'https://youtube.googleapis.com/youtube/v3/channels?part=snippet&mine=true'
    });

    const channels = (googleRes.data as any).items;

    if (!channels || channels.length === 0) {
        throw createError.invalidInput('No YouTube channel found for this account.');
    }

    const leanerChannels = channels.map((c: any) => ({
        id: c.id,
        title: c.snippet.title,
        thumbnail: c.snippet.thumbnails?.default?.url || null
    }));

    const token = jwt.sign(
        { userId, channels: leanerChannels },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
    );

    return { channels: leanerChannels, token };
};

// Connect YouTube
export const connectYoutube = async (userId: string, channelId: string, secureToken: string): Promise<void> => {
    let decoded: any;
    try {
        decoded = jwt.verify(secureToken, config.jwt.accessSecret);
    } catch (err) {
        throw createError.unauthorized('Invalid or expired youtube selection session.');
    }

    if (decoded.userId !== userId) {
        throw createError.unauthorized('Invalid youtube selection session user.');
    }

    const channel = decoded.channels.find((c: any) => c.id === channelId);
    if (!channel) {
        throw createError.invalidInput('Selected channel is not associated with the authenticated Google account.');
    }

    await creatorPageRepository.updateOne(
        { userId: userId },
        {
            $set: {
                youtube: {
                    channelId: channel.id,
                    channelName: channel.title,
                    thumbnail: channel.thumbnail,
                    isVerified: true
                }
            }
        }
    );
};

// Disconnect YouTube
export const disconnectYoutube = async (userId: string): Promise<void> => {
    await creatorPageRepository.updateOne(
        { userId },
        {
            $unset: { youtube: 1 }
        }
    );
};
