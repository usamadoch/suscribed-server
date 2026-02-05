import mongoose, { Schema, Document } from 'mongoose';
import { IPost, MediaAttachment, PostType, PostStatus, PostVisibility } from '../types/index.js';

export interface IPostDocument extends Omit<IPost, '_id'>, Document { }

const mediaAttachmentSchema = new Schema<MediaAttachment>(
    {
        type: {
            type: String,
            enum: ['image', 'video'],
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        thumbnailUrl: String,
        filename: {
            type: String,
            required: true,
        },
        fileSize: {
            type: Number,
            required: true,
        },
        mimeType: {
            type: String,
            required: true,
        },
        duration: Number,
        dimensions: {
            width: Number,
            height: Number,
        },
    },
    { _id: false }
);

// EditorJS block schema - NO LONGER USED BUT KEPT FOR REFERENCE IF NEEDED TO MIGRATE OLD DATA
/*
const editorBlockSchema = new Schema(
    {
        id: { type: String },
        type: { type: String, required: true },
        data: { type: Schema.Types.Mixed },
    },
    { _id: false }
);

const editorJSContentSchema = new Schema<EditorJSContent>(
    {
        time: Number,
        blocks: [editorBlockSchema],
        version: String,
    },
    { _id: false }
);
*/

const postSchema = new Schema<IPostDocument>(
    {
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
        caption: {
            type: String,
            required: [true, 'Caption is required'],
            trim: true,
            maxlength: 2200,
        },
        // Content, Title, and FeaturedImage removed
        mediaAttachments: {
            type: [mediaAttachmentSchema],
            default: [],
        },
        postType: {
            type: String,
            enum: ['text', 'image', 'video'] as PostType[],
            default: 'text',
        },
        tags: {
            type: [String],
            default: [],
            validate: [
                (val: string[]) => val.length <= 10,
                'Maximum 10 tags allowed',
            ],
        },
        visibility: {
            type: String,
            enum: ['public', 'members'] as PostVisibility[],
            default: 'public',
        },
        status: {
            type: String,
            enum: ['draft', 'scheduled', 'published'] as PostStatus[],
            default: 'draft',
        },
        publishedAt: {
            type: Date,
            default: null,
        },
        scheduledFor: {
            type: Date,
            default: null,
        },
        viewCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        likeCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        commentCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        allowComments: {
            type: Boolean,
            default: true,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Set publishedAt when status changes to published
postSchema.pre('save', function () {
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
        this.publishedAt = new Date();
    }
});

// Indexes
postSchema.index({ creatorId: 1, status: 1 });
postSchema.index({ pageId: 1, status: 1, publishedAt: -1 });
postSchema.index({ visibility: 1, status: 1, publishedAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ publishedAt: -1 });
postSchema.index({ viewCount: -1 });
postSchema.index({ likeCount: -1 });

const Post = mongoose.model<IPostDocument>('Post', postSchema);

export default Post;
