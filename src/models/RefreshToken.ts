import mongoose, { Schema, Document } from 'mongoose';
import { IRefreshToken } from '../types/index.js';

export interface IRefreshTokenDocument extends Omit<IRefreshToken, '_id'>, Document { }

const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        token: {
            type: String,
            required: true,
            unique: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for cleanup of expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ token: 1 });

const RefreshToken = mongoose.model<IRefreshTokenDocument>('RefreshToken', refreshTokenSchema);

export default RefreshToken;
