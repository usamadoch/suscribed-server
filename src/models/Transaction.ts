import mongoose, { Schema, Document } from 'mongoose';
import { ITransaction, TransactionStatus, TransactionType } from '../types/index.js';

export interface ITransactionDocument extends Omit<ITransaction, '_id'>, Document { }

const transactionSchema = new Schema<ITransactionDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        creatorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        pageId: {
            type: Schema.Types.ObjectId,
            ref: 'CreatorPage',
            required: true,
        },
        type: {
            type: String,
            enum: ['subscription', 'refund'] as TransactionType[],
            required: true,
        },
        gross: {
            type: Number,
            required: true,
        },
        platformFee: {
            type: Number,
            required: true,
        },
        net: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'available', 'refunded', 'paid', 'completed', 'failed'] as TransactionStatus[],
            default: 'pending',
        },
        releaseAt: {
            type: Date,
            required: true,
        },
        payoutId: {
            type: Schema.Types.ObjectId,
            ref: 'Payout',
        },
        description: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

transactionSchema.index({ creatorId: 1, status: 1 });
transactionSchema.index({ creatorId: 1, type: 1 });
transactionSchema.index({ releaseAt: 1, status: 1 });

const Transaction = mongoose.model<ITransactionDocument>('Transaction', transactionSchema);

export default Transaction;
