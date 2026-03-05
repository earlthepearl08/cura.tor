import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signOut as firebaseSignOut,
    User
} from 'firebase/auth';
import { auth, googleProvider } from '@/config/firebase';
import { UserProfile, TIER_LIMITS, TierLimits } from '@/types/user';
import {
    getOrCreateUserDoc,
    incrementScanCount as incrementScanCountService,
    canPerformScan as canPerformScanService,
    canSaveContact as canSaveContactService,
    getScansRemaining as getScansRemainingService,
    redeemAccessCode as redeemAccessCodeService,
} from '@/services/userService';

interface AuthContextType {
    user: UserProfile | null;
    firebaseUser: User | null;
    isLoading: boolean;
    tierLimits: TierLimits;
    scansRemaining: number | null;

    // Auth methods
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
    signOut: () => Promise<void>;

    // Tier checks
    canPerformScan: (count?: number) => boolean;
    canSaveContact: (currentContactCount: number) => boolean;
    canExportCSV: () => boolean;
    canExportExcel: () => boolean;
    canExportBulkVCard: () => boolean;
    canExportVCard: () => boolean;
    canUseGoogleDrive: () => boolean;

    // Scan tracking
    incrementScanCount: (count?: number) => Promise<boolean>;

    // Access code
    redeemAccessCode: (code: string) => Promise<{ success: boolean; message: string }>;

    // Refresh
    refreshUserProfile: () => Promise<void>;
}

const DEFAULT_LIMITS: TierLimits = TIER_LIMITS.free;

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const tierLimits = user ? TIER_LIMITS[user.tier] : DEFAULT_LIMITS;
    const scansRemaining = user ? getScansRemainingService(user) : 0;

    // Listen to auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            setFirebaseUser(fbUser);
            if (fbUser) {
                try {
                    const profile = await getOrCreateUserDoc(fbUser);
                    setUser(profile);
                } catch (err) {
                    console.error('Failed to load user profile:', err);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const refreshUserProfile = useCallback(async () => {
        if (firebaseUser) {
            const profile = await getOrCreateUserDoc(firebaseUser);
            setUser(profile);
        }
    }, [firebaseUser]);

    // --- Auth methods ---

    const signInWithGoogle = useCallback(async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err: any) {
            // Popup blocked (common on mobile PWA) — fallback to redirect
            if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
                await signInWithRedirect(auth, googleProvider);
            } else {
                throw err;
            }
        }
    }, []);

    const signInWithEmail = useCallback(async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    }, []);

    const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName });
    }, []);

    const signOut = useCallback(async () => {
        await firebaseSignOut(auth);
        setUser(null);
        setFirebaseUser(null);
    }, []);

    // --- Tier checks ---

    const canPerformScan = useCallback((count: number = 1): boolean => {
        if (!user) return false;
        return canPerformScanService(user, count);
    }, [user]);

    const canSaveContact = useCallback((currentContactCount: number): boolean => {
        if (!user) return false;
        return canSaveContactService(user, currentContactCount);
    }, [user]);

    const canExportCSV = useCallback((): boolean => {
        return tierLimits.csvExport;
    }, [tierLimits]);

    const canExportExcel = useCallback((): boolean => {
        return tierLimits.excelExport;
    }, [tierLimits]);

    const canExportBulkVCard = useCallback((): boolean => {
        return tierLimits.bulkVCardExport;
    }, [tierLimits]);

    const canExportVCard = useCallback((): boolean => {
        return tierLimits.individualVCard;
    }, [tierLimits]);

    const canUseGoogleDrive = useCallback((): boolean => {
        return tierLimits.googleDriveSync;
    }, [tierLimits]);

    // --- Scan tracking ---

    const incrementScanCount = useCallback(async (count: number = 1): Promise<boolean> => {
        if (!user) return false;
        const updated = await incrementScanCountService(user, count);
        if (updated) {
            setUser(updated);
            return true;
        }
        return false;
    }, [user]);

    // --- Access code ---

    const redeemAccessCode = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
        if (!user) return { success: false, message: 'Not signed in' };
        const result = await redeemAccessCodeService(user.uid, code);
        if (result.success && result.profile) {
            setUser(result.profile);
        }
        return result;
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user,
            firebaseUser,
            isLoading,
            tierLimits,
            scansRemaining,
            signInWithGoogle,
            signInWithEmail,
            signUpWithEmail,
            signOut,
            canPerformScan,
            canSaveContact,
            canExportCSV,
            canExportExcel,
            canExportBulkVCard,
            canExportVCard,
            canUseGoogleDrive,
            incrementScanCount,
            redeemAccessCode,
            refreshUserProfile,
        }}>
            {children}
        </AuthContext.Provider>
    );
};
