import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signOut as firebaseSignOut,
    sendEmailVerification,
    GoogleAuthProvider,
    User
} from 'firebase/auth';
import { auth, googleProvider } from '@/config/firebase';
import { UserProfile, TIER_LIMITS, TierLimits } from '@/types/user';
import {
    getOrCreateUserDoc,
    canPerformScan as canPerformScanService,
    canSaveContact as canSaveContactService,
    getScansRemaining as getScansRemainingService,
    redeemAccessCode as redeemAccessCodeService,
} from '@/services/userService';
import { storage } from '@/services/storage';

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
    canUseBulkScan: () => boolean;

    // Scan tracking
    incrementScanCount: (count?: number) => Promise<boolean>;

    // Access code
    redeemAccessCode: (code: string) => Promise<{ success: boolean; message: string }>;

    // Email verification
    needsEmailVerification: boolean;
    resendVerificationEmail: () => Promise<void>;
    reloadFirebaseUser: () => Promise<void>;

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
    // Explicit React state for emailVerified. Firebase's User.reload() mutates
    // the user object in place without changing its reference, so setFirebaseUser
    // alone won't trigger a re-render after verification. We mirror it here.
    const [emailVerified, setEmailVerified] = useState(true);

    const tierLimits = user ? TIER_LIMITS[user.tier] : DEFAULT_LIMITS;
    const scansRemaining = user ? getScansRemainingService(user) : 0;

    // Listen to auth state
    useEffect(() => {
        // Handle redirect sign-in result (mobile PWA fallback)
        getRedirectResult(auth).then((result) => {
            if (result) {
                const credential = GoogleAuthProvider.credentialFromResult(result);
                if (credential?.accessToken) {
                    sessionStorage.setItem('gdrive_token', credential.accessToken);
                    if (result.user) {
                        sessionStorage.setItem('gdrive_user', JSON.stringify({
                            email: result.user.email || '',
                            name: result.user.displayName || '',
                        }));
                    }
                }
            }
        }).catch(() => {});

        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            setFirebaseUser(fbUser);
            setEmailVerified(fbUser?.emailVerified ?? true);
            if (fbUser) {
                try {
                    storage.switchUser(fbUser.uid);
                    await storage.migrateFromLegacyDB();
                    const profile = await getOrCreateUserDoc(fbUser);
                    setUser(profile);
                } catch (err) {
                    console.error('Failed to load user profile:', err);
                    setUser(null);
                }
            } else {
                storage.switchUser(null);
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
            const result = await signInWithPopup(auth, googleProvider);
            // Capture Google OAuth access token for automatic Drive access
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                sessionStorage.setItem('gdrive_token', credential.accessToken);
                if (result.user) {
                    sessionStorage.setItem('gdrive_user', JSON.stringify({
                        email: result.user.email || '',
                        name: result.user.displayName || '',
                    }));
                }
            }
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
        // Fire-and-forget — if the email fails to send, the user can hit "Resend" from the gate screen.
        try {
            await sendEmailVerification(credential.user, {
                url: window.location.origin,
            });
        } catch (err) {
            console.warn('Failed to send initial verification email:', err);
        }
    }, []);

    const resendVerificationEmail = useCallback(async () => {
        if (!auth.currentUser) throw new Error('Not signed in');
        await sendEmailVerification(auth.currentUser, {
            url: window.location.origin,
        });
    }, []);

    const reloadFirebaseUser = useCallback(async () => {
        if (!auth.currentUser) return;
        await auth.currentUser.reload();
        // Read the updated emailVerified into explicit React state so the gate
        // re-evaluates. (User.reload() mutates in place; same reference.)
        setEmailVerified(auth.currentUser.emailVerified);
    }, []);

    const signOut = useCallback(async () => {
        await firebaseSignOut(auth);
        storage.switchUser(null);
        // Clear Drive session so it doesn't persist across accounts
        sessionStorage.removeItem('gdrive_token');
        sessionStorage.removeItem('gdrive_user');
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

    const canUseBulkScan = useCallback((): boolean => {
        return tierLimits.bulkScan;
    }, [tierLimits]);

    // --- Scan tracking ---
    //
    // The actual scan increment is now performed server-side inside /api/ocr
    // and /api/gemini. This client-side function is kept for backward
    // compatibility with existing call sites in Scan.tsx, Upload.tsx,
    // MultiCardScan.tsx, and LogScan.tsx. It refreshes the user profile from
    // Firestore so the local cached count reflects the server-side increment,
    // then returns true.
    //
    // The contract the callers expect: "did THIS scan count successfully?".
    // By the time this function is called, the server has already returned
    // 200 and charged the scan — if the server had rejected the scan
    // (quota-exceeded 429, rate-limit 429, etc.) then ocrService.processImage
    // would have thrown and we would never reach this point. So a successful
    // refresh always means success. Returning false here would incorrectly
    // discard the last scan in a batch (e.g. a free user's 5th scan: server
    // charged it, refresh shows 5/5, but "can you do ANOTHER?" is false).
    //
    // The mid-batch "should we continue to the NEXT scan?" gate lives
    // separately in each page's top-of-loop canPerformScan() check.

    const incrementScanCount = useCallback(async (_count: number = 1): Promise<boolean> => {
        if (!firebaseUser) return false;
        try {
            const refreshed = await getOrCreateUserDoc(firebaseUser);
            setUser(refreshed);
            return true;
        } catch (err) {
            console.error('Failed to refresh profile after scan:', err);
            return false;
        }
    }, [firebaseUser]);

    // --- Access code ---

    const redeemAccessCode = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
        if (!user) return { success: false, message: 'Not signed in' };
        const result = await redeemAccessCodeService(user.uid, code);
        if (result.success && result.profile) {
            setUser(result.profile);
        }
        return result;
    }, [user]);

    // Unverified email/password users must verify before using the app.
    // Google sign-ins set emailVerified=true automatically, so this only blocks
    // password-provider accounts that haven't clicked the link yet.
    const needsEmailVerification = !!firebaseUser && !emailVerified;

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
            canUseBulkScan,
            incrementScanCount,
            redeemAccessCode,
            needsEmailVerification,
            resendVerificationEmail,
            reloadFirebaseUser,
            refreshUserProfile,
        }}>
            {children}
        </AuthContext.Provider>
    );
};
