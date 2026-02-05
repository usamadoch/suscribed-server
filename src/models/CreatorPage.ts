import mongoose, { Schema, Document } from 'mongoose';
import { ICreatorPage, SocialLink, PageTheme } from 'types/index.js';

export interface ICreatorPageDocument extends Omit<ICreatorPage, '_id'>, Document { }

const socialLinkSchema = new Schema<SocialLink>(
    {
        platform: {
            type: String,
            enum: ['twitter', 'instagram', 'youtube', 'tiktok', 'discord', 'website', 'facebook', 'linkedin', 'pinterest', 'x', 'other'],
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        label: {
            type: String,
            default: '',
        },
    },
    { _id: false }
);

const pageThemeSchema = new Schema<PageTheme>(
    {
        primaryColor: {
            type: String,
            default: '#6366f1', // Indigo
        },
        accentColor: {
            type: String,
            default: '#ec4899', // Pink
        },
        layout: {
            type: String,
            enum: ['default', 'minimal', 'featured'],
            default: 'default',
        },
    },
    { _id: false }
);

const creatorPageSchema = new Schema<ICreatorPageDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        pageSlug: {
            type: String,
            required: [true, 'Page slug is required'],
            unique: true,
            lowercase: true,
            trim: true,
            minlength: 3,
            maxlength: 50,
            match: [/^[a-z0-9_-]+$/, 'Slug can only contain lowercase letters, numbers, underscores, and hyphens'],
        },
        displayName: {
            type: String,
            required: [true, 'Display name is required'],
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        tagline: {
            type: String,
            default: '',
            maxlength: 500,
        },
        category: {
            type: [String],
            default: [],
        },
        avatarUrl: {
            type: String,
            default: null,
        },
        bannerUrl: {
            type: String,
            default: null,
        },
        about: {
            type: String,
            default: '',
            maxlength: 10000,
        },
        socialLinks: {
            type: [socialLinkSchema],
            default: [],
            validate: [
                (val: SocialLink[]) => val.length <= 10,
                'Maximum 10 social links allowed',
            ],
        },
        theme: {
            type: pageThemeSchema,
            default: () => ({}),
        },
        isPublic: {
            type: Boolean,
            default: true,
        },
        status: {
            type: String,
            enum: ['draft', 'published'],
            default: 'draft',
        },
        memberCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        postCount: {
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
creatorPageSchema.index({ pageSlug: 1 });
creatorPageSchema.index({ userId: 1 });
creatorPageSchema.index({ isPublic: 1 });
creatorPageSchema.index({ memberCount: -1 });
creatorPageSchema.index({ createdAt: -1 });

const CreatorPage = mongoose.model<ICreatorPageDocument>('CreatorPage', creatorPageSchema);

export default CreatorPage;
