import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPostLikeDocument extends Document {
    postId: Types.ObjectId;
    userId: Types.ObjectId;
    createdAt: Date;
}

const postLikeSchema = new Schema<IPostLikeDocument>(
    {
        postId: {
            type: Schema.Types.ObjectId,
            ref: 'Post',
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index to prevent duplicate likes
postLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });
postLikeSchema.index({ postId: 1 });
postLikeSchema.index({ userId: 1 });

const PostLike = mongoose.model<IPostLikeDocument>('PostLike', postLikeSchema);

export default PostLike;
