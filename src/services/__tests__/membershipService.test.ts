import { jest } from '@jest/globals';
import { createError } from '../../middleware/errorHandler';
// Import types for mocking
import { IMembershipDocument } from '../../models/Membership';
import { ICreatorPageDocument } from '../../models/CreatorPage';

// Define mocks using unstable_mockModule which works with ESM
// These must be defined BEFORE importing the modules under test

jest.unstable_mockModule('../../models/Membership', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
    }
}));

jest.unstable_mockModule('../../models/CreatorPage', () => ({
    __esModule: true,
    default: {
        findById: jest.fn(),
        updateOne: jest.fn(),
    }
}));

jest.unstable_mockModule('../notificationService', () => ({
    __esModule: true,
    NotificationService: {
        sendNotification: jest.fn()
    }
}));

// Mock types
type MockModel<T> = {
    findOne: jest.Mock<(...args: any[]) => Promise<T | null>>;
    create: jest.Mock<(...args: any[]) => Promise<T>>;
    findById: jest.Mock<(...args: any[]) => Promise<T | null>>;
    updateOne: jest.Mock<(...args: any[]) => Promise<any>>;
};

// Dynamic imports variables
// Use strict types for mocked modules
let MembershipService: any; // We can't easily type the service class itself without importing it, but that's fine as we test its methods
let Membership: MockModel<IMembershipDocument>;
let CreatorPage: Pick<MockModel<ICreatorPageDocument>, 'findById' | 'updateOne'>;
let NotificationService: { sendNotification: jest.Mock };

describe('MembershipService', () => {
    const mockMemberId = 'member123';
    const mockCreatorId = 'creator456';
    const mockPageId = 'page789';
    const mockMembershipId = 'membershipABC';
    const mockMemberDisplayName = 'Test User';
    const mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

    beforeAll(async () => {
        const membershipServiceModule = await import('../membershipService');
        MembershipService = membershipServiceModule.MembershipService;

        const membershipModule = await import('../../models/Membership');
        Membership = membershipModule.default as unknown as MockModel<IMembershipDocument>;

        const creatorPageModule = await import('../../models/CreatorPage');
        CreatorPage = creatorPageModule.default as unknown as MockModel<ICreatorPageDocument>;

        const notificationServiceModule = await import('../notificationService');
        NotificationService = notificationServiceModule.NotificationService as unknown as { sendNotification: jest.Mock };
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('joinCreator', () => {
        it('should throw error if page does not exist', async () => {
            CreatorPage.findById.mockResolvedValue(null);

            await expect(MembershipService.joinCreator({
                memberId: mockMemberId,
                creatorId: mockCreatorId,
                pageId: mockPageId,
                memberDisplayName: mockMemberDisplayName,
            })).rejects.toEqual(createError.notFound('Page not found'));
        });

        it('should throw error if already an active member', async () => {
            CreatorPage.findById.mockResolvedValue({ _id: mockPageId } as unknown as ICreatorPageDocument);
            Membership.findOne.mockResolvedValue({ status: 'active' } as unknown as IMembershipDocument);

            await expect(MembershipService.joinCreator({
                memberId: mockMemberId,
                creatorId: mockCreatorId,
                pageId: mockPageId,
                memberDisplayName: mockMemberDisplayName,
            })).rejects.toEqual(createError.conflict('Already a member'));
        });

        it('should reactivate membership if status is cancelled', async () => {
            const mockMembership = {
                status: 'cancelled',
                joinedAt: new Date('2023-01-01'),
                cancelledAt: new Date('2023-02-01'),
                save: jest.fn(),
                _id: mockMembershipId
            } as unknown as IMembershipDocument;

            CreatorPage.findById.mockResolvedValue({ _id: mockPageId } as unknown as ICreatorPageDocument);
            Membership.findOne.mockResolvedValue(mockMembership);

            await MembershipService.joinCreator({
                memberId: mockMemberId,
                creatorId: mockCreatorId,
                pageId: mockPageId,
                memberDisplayName: mockMemberDisplayName,
            });

            expect(mockMembership.status).toBe('active');
            expect(mockMembership.cancelledAt).toBeNull();
            expect(mockMembership.save).toHaveBeenCalled();
            expect(CreatorPage.updateOne).toHaveBeenCalledWith(
                { _id: mockPageId },
                { $inc: { memberCount: 1 } }
            );
        });

        it('should create new membership if none exists', async () => {
            CreatorPage.findById.mockResolvedValue({ _id: mockPageId } as unknown as ICreatorPageDocument);
            Membership.findOne.mockResolvedValue(null);
            const mockNewMembership = { _id: mockMembershipId } as unknown as IMembershipDocument;
            Membership.create.mockResolvedValue(mockNewMembership);

            await MembershipService.joinCreator({
                memberId: mockMemberId,
                creatorId: mockCreatorId,
                pageId: mockPageId,
                memberDisplayName: mockMemberDisplayName,
                io: mockIo
            });

            expect(Membership.create).toHaveBeenCalledWith({
                memberId: mockMemberId,
                creatorId: mockCreatorId,
                pageId: mockPageId,
            });
            expect(CreatorPage.updateOne).toHaveBeenCalledWith(
                { _id: mockPageId },
                { $inc: { memberCount: 1 } }
            );
            expect(NotificationService.sendNotification).toHaveBeenCalledWith(
                mockCreatorId,
                'new_member',
                'New member!',
                `${mockMemberDisplayName} joined`,
                {
                    actionUrl: '/members',
                    actionLabel: 'View members',
                    metadata: { memberId: mockMemberId, membershipId: mockMembershipId },
                    io: mockIo
                }
            );
        });
    });

    describe('leaveCreator', () => {
        it('should throw error if membership not found', async () => {
            Membership.findOne.mockResolvedValue(null);

            await expect(MembershipService.leaveCreator(mockMemberId, mockMembershipId))
                .rejects.toEqual(createError.notFound('Membership not found'));
        });

        it('should successfully cancel active membership', async () => {
            const mockMembership = {
                _id: mockMembershipId,
                pageId: mockPageId,
                status: 'active',
                save: jest.fn()
            } as unknown as IMembershipDocument;
            Membership.findOne.mockResolvedValue(mockMembership);

            await MembershipService.leaveCreator(mockMemberId, mockMembershipId);

            expect(mockMembership.status).toBe('cancelled');
            expect(mockMembership.save).toHaveBeenCalled();
            expect(CreatorPage.updateOne).toHaveBeenCalledWith(
                { _id: mockPageId, memberCount: { $gt: 0 } },
                { $inc: { memberCount: -1 } }
            );
        });

        it('should do nothing if already cancelled (Idempotency)', async () => {
            const mockMembership = {
                _id: mockMembershipId,
                pageId: mockPageId,
                status: 'cancelled',
                save: jest.fn()
            } as unknown as IMembershipDocument;
            Membership.findOne.mockResolvedValue(mockMembership);

            await MembershipService.leaveCreator(mockMemberId, mockMembershipId);

            expect(mockMembership.save).not.toHaveBeenCalled();
            expect(CreatorPage.updateOne).not.toHaveBeenCalled();
        });
    });

    describe('checkMembership', () => {
        it('should return isMember true if active membership exists', async () => {
            const mockMembership = { status: 'active' } as unknown as IMembershipDocument;
            Membership.findOne.mockResolvedValue(mockMembership);

            const result = await MembershipService.checkMembership(mockMemberId, mockPageId);

            expect(result).toEqual({
                isMember: true,
                membership: mockMembership
            });
        });

        it('should return isMember false if no active membership', async () => {
            Membership.findOne.mockResolvedValue(null);

            const result = await MembershipService.checkMembership(mockMemberId, mockPageId);

            expect(result).toEqual({
                isMember: false,
                membership: undefined
            });
        });
    });
});
