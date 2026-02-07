import mongoose, { Schema, Document } from 'mongoose';
import { IComment } from '../types/index.js';

export interface ICommentDocument extends Omit<IComment, '_id'>, Document { }

const commentSchema = new Schema<ICommentDocument>(
    {
        postId: {
            type: Schema.Types.ObjectId,
            ref: 'Post',
            required: true,
        },
        authorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
            required: [true, 'Comment content is required'],
            trim: true,
            minlength: 1,
            maxlength: 2000,
        },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: 'Comment',
            default: null,
        },
        depth: {
            type: Number,
            default: 0,
            min: 0,
            max: 3, // Maximum nesting level
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        isHidden: {
            type: Boolean,
            default: false,
        },
        likeCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        replyCount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ postId: 1, parentId: 1 });
commentSchema.index({ authorId: 1 });
commentSchema.index({ parentId: 1 });

const Comment = mongoose.model<ICommentDocument>('Comment', commentSchema);

export default Comment;
