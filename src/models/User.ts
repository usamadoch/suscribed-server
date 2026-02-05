import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, NotificationPreferences, UserRole } from '../types/index.js';

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
    comparePassword(candidatePassword: string): Promise<boolean>;
}


const userSchema = new Schema<IUserDocument>(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        passwordHash: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 8,
            select: false,
        },
        role: {
            type: String,
            enum: ['member', 'creator', 'admin'] as UserRole[],
            default: 'member',
            required: true,
        },
        displayName: {
            type: String,
            required: [true, 'Display name is required'],
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        username: {
            type: String,
            required: [true, 'Username is required'],
            unique: true,
            lowercase: true,
            trim: true,
            minlength: 3,
            maxlength: 30,
            match: [/^[a-z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'],
        },
        bio: {
            type: String,
            default: '',
            maxlength: 500,
        },
        avatarUrl: {
            type: String,
            default: null,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
        googleId: {
            type: String,
            sparse: true,
        },
        notificationPreferences: {
            email: {
                newMembers: { type: Boolean, default: true },
                newComments: { type: Boolean, default: true },
                newMessages: { type: Boolean, default: true },
                weeklyDigest: { type: Boolean, default: true },
            },
            push: {
                newMembers: { type: Boolean, default: true },
                newPosts: { type: Boolean, default: true },
                newComments: { type: Boolean, default: true },
                newMessages: { type: Boolean, default: true },
                mentions: { type: Boolean, default: true },
            },
            inApp: {
                all: { type: Boolean, default: true },
            },
            quietHours: {
                enabled: { type: Boolean, default: false },
                startTime: { type: String, default: '22:00' },
                endTime: { type: String, default: '08:00' },
                timezone: { type: String, default: 'UTC' },
            },
        },
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('passwordHash')) {
        return;
    }

    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Index for efficient queries
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model<IUserDocument>('User', userSchema);

export default User;
