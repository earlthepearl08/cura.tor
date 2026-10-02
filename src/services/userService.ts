import {
    doc, getDoc, setDoc, updateDoc, increment,
    serverTimestamp, Timestamp
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, OWNER_EMAILS } from '@/config/firebase';
import { UserProfile, UserTier, TIER_LIMITS } from '@/types/user';
import { authFetch } from '@/utils/authFetch';

/** Tracks the last trial-expiry downgrade within the current session so the UI can show a one-time toast. */
let lastTrialExpiry: { previousTier: string; uid: string } | null = null;
/** Returns the pending trial-expiry toast for the given uid (and clears it). Returns null on uid mismatch
 *  so that signing out and signing in as a different user on the same device doesn't show the wrong toast. */
export function consumeLastTrialExpiry(currentUid: string | undefined): { previousTier: string } | null {
    if (!lastTrialExpiry || !currentUid || lastTrialExpiry.uid !== currentUid) return null;
    const val = { previousTier: lastTrialExpiry.previousTier };
    lastTrialExpiry = null;
    return val;
}

/** Convert Firestore doc data to UserProfile */
const docToProfile = (data: any): UserProfile => ({
    uid: data.uid,
    email: data.email,
    displayName: data.displayName,
    photoURL: data.photoURL || null,
    tier: data.tier || 'free',
    scanUsage: {
        count: data.scanUsage?.count || 0,
        periodStart: data.scanUsage?.periodStart?.toMillis?.() || data.scanUsage?.periodStart || Date.now(),
        lifetimeCount: data.scanUsage?.lifetimeCount || 0,
        lifetimeLimit: data.scanUsage?.lifetimeLimit ?? null,
    },
    contactLimit: data.contactLimit ?? TIER_LIMITS[(data.tier || 'free') as UserTier].contactStorage,
    accessCode: data.accessCode || null,
    stripe: data.stripe ? {
        customerId: data.stripe.customerId || '',
        subscriptionId: data.stripe.subscriptionId || null,
        subscriptionStatus: data.stripe.subscriptionStatus || null,
        currentPeriodEnd: data.stripe.currentPeriodEnd || null,
    } : undefined,
    organizationId: data.organizationId || undefined,
    orgRole: data.orgRole || undefined,
    eventIds: Array.isArray(data.eventIds) ? data.eventIds.filter((id: unknown) => typeof id === 'string') : [],
    eventPackCredits: typeof data.eventPackCredits === 'number' ? data.eventPackCredits : 0,
    eventPackPurchased: typeof data.eventPackPurchased === 'number' ? data.eventPackPurchased : 0,
    expiresAt: data.expiresAt?.toMillis?.() ?? data.expiresAt ?? null,
    trialSourceTier: data.trialSourceTier ?? null,
    createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
});

export type GetOrCreateUserResult = {
    profile: UserProfile;
    /** True when a new Firestore user doc was created (signup / first Google login). */
    isNew: boolean;
};

/** Get or create user document on sign-in */
export async function getOrCreateUserDoc(firebaseUser: User): Promise<GetOrCreateUserResult> {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        let profile = docToProfile(snap.data());

        // Trial expiry: if past expiresAt, ask the server to downgrade (admin SDK bypasses
        // the rule that forbids tier downgrades). On success, re-fetch the profile.
        if (profile.expiresAt && Date.now() >= profile.expiresAt && profile.tier !== 'enterprise') {
            try {
                const res = await authFetch('/api/check-tier-expiry', { method: 'POST' });
                if (res.ok) {
                    const body = await res.json();
                    if (body.downgraded) {
                        lastTrialExpiry = { previousTier: body.previousTier, uid: firebaseUser.uid };
                        const refreshed = await getDoc(userRef);
                        if (refreshed.exists()) profile = docToProfile(refreshed.data());
                    }
                }
            } catch (err) {
                console.warn('Trial expiry check failed (non-fatal):', err);
            }
        }

        // Owner bootstrap is server-only (Admin SDK) — clients cannot write tier.
        if (OWNER_EMAILS.includes(firebaseUser.email || '') && profile.tier !== 'pro' && profile.tier !== 'enterprise') {
            try {
                const res = await authFetch('/api/account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'bootstrap-owner' }),
                });
                if (res.ok) {
                    const refreshed = await getDoc(userRef);
                    if (refreshed.exists()) profile = docToProfile(refreshed.data());
                }
            } catch (err) {
                console.warn('Owner bootstrap failed (non-fatal):', err);
            }
        }
        return { profile: await resetMonthlyScansIfNeeded(profile), isNew: false };
    }

    // New users always create as free. Owner bootstrap (if applicable) runs after create.
    const newUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        photoURL: firebaseUser.photoURL || null,
        tier: 'free' as UserTier,
        scanUsage: {
            count: 0,
            periodStart: serverTimestamp(),
            lifetimeCount: 0,
            lifetimeLimit: null,
        },
        contactLimit: TIER_LIMITS.free.contactStorage,
        accessCode: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newUser);

    let profile: UserProfile = {
        ...newUser,
        scanUsage: {
            count: 0,
            periodStart: Date.now(),
            lifetimeCount: 0,
            lifetimeLimit: null,
        },
        contactLimit: TIER_LIMITS.free.contactStorage,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    if (OWNER_EMAILS.includes(firebaseUser.email || '')) {
        try {
            const res = await authFetch('/api/account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'bootstrap-owner' }),
            });
            if (res.ok) {
                const refreshed = await getDoc(userRef);
                if (refreshed.exists()) profile = docToProfile(refreshed.data());
            }
        } catch (err) {
            console.warn('Owner bootstrap after create failed (non-fatal):', err);
        }
    }

    return { profile, isNew: true };
}

/** Get the next reset date: same day-of-month as periodStart, one month later */
function getNextResetDate(periodStart: number): number {
    const d = new Date(periodStart);
    const targetDay = d.getDate();
    // Move to day 1 of next month to avoid overflow (e.g., Jan 31 → Mar 3)
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    // Set to the original day, or last day of month if it doesn't exist
    const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(targetDay, lastDayOfMonth));
    // Reset at midnight
    next.setHours(0, 0, 0, 0);
    return next.getTime();
}

/**
 * Free-tier monthly reset for local UI only.
 * Authoritative reset happens in api/_lib/scanGuards (Admin SDK). Clients can no
 * longer write scanUsage.count back to 0 (that was a quota-bypass vector).
 */
export async function resetMonthlyScansIfNeeded(profile: UserProfile): Promise<UserProfile> {
    if (profile.tier !== 'free') return profile;

    const now = Date.now();
    const nextReset = getNextResetDate(profile.scanUsage.periodStart);

    if (now >= nextReset) {
        return {
            ...profile,
            scanUsage: {
                ...profile.scanUsage,
                count: 0,
                periodStart: now,
            },
        };
    }

    return profile;
}

/** Increment scan count. Returns updated profile or null if limit reached. */
export async function incrementScanCount(profile: UserProfile, count: number = 1): Promise<UserProfile | null> {
    // Pro / Enterprise — always allowed
    if (profile.tier === 'pro' || profile.tier === 'enterprise') {
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, {
            'scanUsage.count': increment(count),
            'scanUsage.lifetimeCount': increment(count),
            updatedAt: serverTimestamp(),
        });
        return {
            ...profile,
            scanUsage: {
                ...profile.scanUsage,
                count: profile.scanUsage.count + count,
                lifetimeCount: profile.scanUsage.lifetimeCount + count,
            },
        };
    }

    // Free tier — check monthly limit
    if (profile.tier === 'free') {
        const limit = TIER_LIMITS.free.scansPerMonth!;
        if (profile.scanUsage.count + count > limit) return null;

        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, {
            'scanUsage.count': increment(count),
            'scanUsage.lifetimeCount': increment(count),
            updatedAt: serverTimestamp(),
        });
        return {
            ...profile,
            scanUsage: {
                ...profile.scanUsage,
                count: profile.scanUsage.count + count,
                lifetimeCount: profile.scanUsage.lifetimeCount + count,
            },
        };
    }

    // Early Access — check lifetime limit
    if (profile.tier === 'early_access') {
        const limit = profile.scanUsage.lifetimeLimit;
        if (limit !== null && profile.scanUsage.lifetimeCount + count > limit) return null;

        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, {
            'scanUsage.count': increment(count),
            'scanUsage.lifetimeCount': increment(count),
            updatedAt: serverTimestamp(),
        });
        return {
            ...profile,
            scanUsage: {
                ...profile.scanUsage,
                count: profile.scanUsage.count + count,
                lifetimeCount: profile.scanUsage.lifetimeCount + count,
            },
        };
    }

    return null;
}

/** Check if user can perform a scan */
export function canPerformScan(profile: UserProfile, count: number = 1): boolean {
    if (profile.tier === 'pro' || profile.tier === 'enterprise') return true;
    if (profile.tier === 'free') {
        const limit = TIER_LIMITS.free.scansPerMonth!;
        return profile.scanUsage.count + count <= limit;
    }
    if (profile.tier === 'early_access') {
        const limit = profile.scanUsage.lifetimeLimit;
        if (limit === null) return true;
        return profile.scanUsage.lifetimeCount + count <= limit;
    }
    return false;
}

/** Check if user can save more contacts */
export function canSaveContact(profile: UserProfile, currentContactCount: number): boolean {
    const limit = profile.contactLimit;
    if (limit === null) return true;
    return currentContactCount < limit;
}

/** Get the next scan reset date for free tier users */
export function getNextScanReset(profile: UserProfile): Date | null {
    if (profile.tier !== 'free') return null;
    return new Date(getNextResetDate(profile.scanUsage.periodStart));
}

/** Get scans remaining for display */
export function getScansRemaining(profile: UserProfile): number | null {
    if (profile.tier === 'pro' || profile.tier === 'enterprise') return null; // unlimited
    if (profile.tier === 'free') {
        return Math.max(0, TIER_LIMITS.free.scansPerMonth! - profile.scanUsage.count);
    }
    if (profile.tier === 'early_access') {
        const limit = profile.scanUsage.lifetimeLimit;
        if (limit === null) return null;
        return Math.max(0, limit - profile.scanUsage.lifetimeCount);
    }
    return 0;
}

/** Redeem an access code (server-side — clients cannot write tier / accessCodes). */
export async function redeemAccessCode(
    uid: string,
    code: string
): Promise<{ success: boolean; message: string; profile?: UserProfile }> {
    try {
        const res = await authFetch('/api/account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'redeem-access-code', code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { success: false, message: data.error || 'Failed to redeem code' };
        }

        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            return {
                success: true,
                message: data.message || 'Access code redeemed!',
                profile: docToProfile(snap.data()),
            };
        }
        return { success: true, message: data.message || 'Access code redeemed!' };
    } catch (error: any) {
        console.error('Failed to redeem code:', error);
        return { success: false, message: 'Failed to redeem code. Please try again.' };
    }
}
