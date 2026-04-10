import type { VercelRequest } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

function ensureAdminInit() {
    if (!getApps().length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!projectId || !clientEmail || !privateKey) {
            throw new Error('Firebase Admin credentials not configured');
        }

        initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
        });
    }
}

export async function verifyAuth(req: VercelRequest): Promise<DecodedIdToken | null> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return null;

        const token = authHeader.slice(7);
        if (!token) return null;

        ensureAdminInit();
        return await getAuth().verifyIdToken(token);
    } catch {
        return null;
    }
}
