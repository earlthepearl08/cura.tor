export type UserTier = 'free' | 'early_access' | 'pro';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    tier: UserTier;
    scanUsage: {
        count: number;           // scans used in current period (free = monthly, early_access = lifetime)
        periodStart: number;     // timestamp: start of current monthly period (free tier)
        lifetimeCount: number;   // total scans ever
        lifetimeLimit: number | null; // null = unlimited, number = early access cap
    };
    contactLimit: number | null; // null = unlimited, 25 = free, 50 = early_access
    accessCode: {
        code: string;
        redeemedAt: number;
    } | null;
    createdAt: number;
    updatedAt: number;
}

export interface TierLimits {
    scansPerMonth: number | null;      // null = unlimited
    contactStorage: number | null;     // null = unlimited
    csvExport: boolean;
    excelExport: boolean;
    bulkVCardExport: boolean;
    googleDriveSync: boolean;
    individualVCard: boolean;
    bulkScan: boolean;                 // log sheet scan + multi-card scan
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
    free: {
        scansPerMonth: 5,
        contactStorage: 25,
        csvExport: false,
        excelExport: false,
        bulkVCardExport: false,
        googleDriveSync: false,
        individualVCard: false,
        bulkScan: false,
    },
    early_access: {
        scansPerMonth: null,           // controlled by lifetimeLimit in user doc
        contactStorage: 50,
        csvExport: true,
        excelExport: true,
        bulkVCardExport: true,
        googleDriveSync: true,
        individualVCard: true,
        bulkScan: true,
    },
    pro: {
        scansPerMonth: null,
        contactStorage: null,
        csvExport: true,
        excelExport: true,
        bulkVCardExport: true,
        googleDriveSync: true,
        individualVCard: true,
        bulkScan: true,
    },
};
