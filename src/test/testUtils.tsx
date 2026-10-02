import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserProfile, TIER_LIMITS, TierLimits } from '@/types/user';
import { Contact } from '@/types/contact';
import { OCRResult } from '@/services/ocr';

/** Minimal free-tier profile for auth-gate and flow tests */
export function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    const now = Date.now();
    return {
        uid: 'test-uid-1',
        email: 'tester@example.com',
        displayName: 'Test User',
        photoURL: null,
        tier: 'free',
        scanUsage: {
            count: 0,
            periodStart: now,
            lifetimeCount: 0,
            lifetimeLimit: null,
        },
        contactLimit: 25,
        accessCode: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

export function makeOCRResult(overrides: Partial<OCRResult> = {}): OCRResult {
    return {
        name: 'Jane Doe',
        position: 'Sales Manager',
        company: 'Acme Corp',
        phone: ['+63 917 123 4567'],
        email: ['jane.doe@acme.example'],
        address: 'Makati City, PH',
        notes: '',
        rawText: 'Jane Doe\nSales Manager\nAcme Corp\njane.doe@acme.example\n+63 917 123 4567',
        confidence: 92,
        ...overrides,
    };
}

export function makeContact(overrides: Partial<Contact> = {}): Contact {
    const ocr = makeOCRResult();
    return {
        id: 'contact-1',
        name: ocr.name,
        position: ocr.position,
        company: ocr.company,
        phone: ocr.phone,
        email: ocr.email,
        address: ocr.address,
        notes: '',
        folder: 'Uncategorized',
        rawText: ocr.rawText,
        imageData: 'data:image/jpeg;base64,mock',
        confidence: ocr.confidence,
        isVerified: true,
        createdAt: Date.now(),
        ...overrides,
    };
}

export type AuthMock = {
    user: UserProfile | null;
    isLoading: boolean;
    needsEmailVerification: boolean;
    tierLimits: TierLimits;
    canExportVCard: () => boolean;
    canExportCSV: () => boolean;
    canExportExcel: () => boolean;
    canPerformScan: () => boolean;
    canSaveContact: () => boolean;
    firebaseUser: { email: string; emailVerified: boolean } | null;
    signOut: () => Promise<void>;
    resendVerificationEmail: () => Promise<void>;
    reloadFirebaseUser: () => Promise<void>;
};

export function makeAuthMock(overrides: Partial<AuthMock> = {}): AuthMock {
    const user = overrides.user === undefined ? makeUserProfile() : overrides.user;
    return {
        user,
        isLoading: false,
        needsEmailVerification: false,
        tierLimits: user ? TIER_LIMITS[user.tier] : TIER_LIMITS.free,
        canExportVCard: () => false,
        canExportCSV: () => false,
        canExportExcel: () => false,
        canPerformScan: () => true,
        canSaveContact: () => true,
        firebaseUser: user
            ? { email: user.email, emailVerified: true }
            : null,
        signOut: async () => {},
        resendVerificationEmail: async () => {},
        reloadFirebaseUser: async () => {},
        ...overrides,
    };
}

export function renderWithRouter(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & { route?: string }
) {
    const route = options?.route ?? '/';
    const { route: _r, ...rest } = options ?? {};
    return render(ui, {
        wrapper: ({ children }) => (
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        ),
        ...rest,
    });
}
