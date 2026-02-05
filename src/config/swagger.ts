import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Patreon MVP API',
            version: '1.0.0',
            description: 'API documentation for the Patreon-inspired platform',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: '/api',
                description: 'API Server',
            },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'accessToken',
                    description: 'JWT access token stored in httpOnly cookie',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: {
                            type: 'object',
                            properties: {
                                code: { type: 'string', example: 'NOT_FOUND' },
                                message: { type: 'string', example: 'Resource not found' },
                            },
                        },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        displayName: { type: 'string' },
                        username: { type: 'string' },
                        role: { type: 'string', enum: ['member', 'creator', 'admin'] },
                        avatarUrl: { type: 'string', nullable: true },
                        bio: { type: 'string' },
                        isEmailVerified: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                Post: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        title: { type: 'string' },
                        excerpt: { type: 'string' },
                        visibility: { type: 'string', enum: ['public', 'members'] },
                        status: { type: 'string', enum: ['draft', 'scheduled', 'published'] },
                        viewCount: { type: 'number' },
                        likeCount: { type: 'number' },
                        commentCount: { type: 'number' },
                        publishedAt: { type: 'string', format: 'date-time', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                CreatorPage: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        pageSlug: { type: 'string' },
                        displayName: { type: 'string' },
                        tagline: { type: 'string' },
                        avatarUrl: { type: 'string', nullable: true },
                        bannerUrl: { type: 'string', nullable: true },
                        memberCount: { type: 'number' },
                        postCount: { type: 'number' },
                        isPublic: { type: 'boolean' },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'number' },
                        limit: { type: 'number' },
                        totalItems: { type: 'number' },
                        totalPages: { type: 'number' },
                        hasNextPage: { type: 'boolean' },
                        hasPrevPage: { type: 'boolean' },
                    },
                },
                CursorPagination: {
                    type: 'object',
                    properties: {
                        cursor: { type: 'string', nullable: true },
                        limit: { type: 'number' },
                        hasMore: { type: 'boolean' },
                        nextCursor: { type: 'string', nullable: true },
                    },
                },
            },
        },
        security: [{ cookieAuth: [] }],
    },
    apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
