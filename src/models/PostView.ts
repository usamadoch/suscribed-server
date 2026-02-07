import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPostViewDocument extends Document {
    postId: Types.ObjectId;
    userId: Types.ObjectId | null;
    sessionId: string;
    viewedAt: Date;
    duration: number;
}

const postViewSchema = new Schema<IPostViewDocument>(
    {
        postId: {
            type: Schema.Types.ObjectId,
            ref: 'Post',
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        sessionId: {
            type: String,
            required: true,
        },
        viewedAt: {
            type: Date,
            default: Date.now,
        },
        duration: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for analytics queries
postViewSchema.index({ postId: 1, viewedAt: -1 });
postViewSchema.index({ postId: 1, userId: 1 });
postViewSchema.index({ postId: 1, sessionId: 1 });
postViewSchema.index({ viewedAt: -1 });

const PostView = mongoose.model<IPostViewDocument>('PostView', postViewSchema);

export default PostView;
