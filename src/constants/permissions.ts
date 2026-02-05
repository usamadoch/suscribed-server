
import { Permission, UserRole } from "types";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    creator: [
        'post:create',
        'post:read',
        'post:update',
        'post:delete',
        'dashboard:view',
        'analytics:view',
        'members:view',
        'payouts:view',
        'page:manage'
    ],
    member: [
        'post:read',
        'explore:view',
        'subscriptions:view',
        'security:manage'
    ],
    admin: [
        'post:create',
        'post:read',
        'post:update',
        'post:delete',
        'dashboard:view',
        'analytics:view',
        'members:view',
        'payouts:view',
        'page:manage',
        'explore:view',
        'subscriptions:view',
        'admin:access'
    ]
};

export const hasPermission = (userRole: UserRole | undefined, permission: Permission): boolean => {
    if (!userRole) return false;
    const permissions = ROLE_PERMISSIONS[userRole];
    return permissions?.includes(permission) || false;
};
