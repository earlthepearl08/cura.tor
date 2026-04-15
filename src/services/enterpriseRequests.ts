import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { authFetch } from '@/utils/authFetch';
import { EnterpriseRequest } from '@/types/enterpriseRequest';

function docToRequest(id: string, data: any): EnterpriseRequest {
    return {
        id,
        uid: data.uid,
        email: data.email || '',
        displayName: data.displayName || '',
        orgName: data.orgName || '',
        teamSize: data.teamSize || 0,
        contactEmail: data.contactEmail || '',
        notes: data.notes || '',
        status: data.status || 'pending',
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
        resolvedAt: data.resolvedAt instanceof Timestamp ? data.resolvedAt.toMillis() : data.resolvedAt,
        resolvedBy: data.resolvedBy,
        orgId: data.orgId,
        rejectionReason: data.rejectionReason,
    };
}

export async function submitEnterpriseRequest(input: {
    orgName: string;
    teamSize: number;
    contactEmail: string;
    notes: string;
}): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    await addDoc(collection(db, 'enterpriseRequests'), {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        orgName: input.orgName.trim(),
        teamSize: input.teamSize,
        contactEmail: input.contactEmail.trim(),
        notes: input.notes.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
    });
}

export async function listEnterpriseRequests(): Promise<EnterpriseRequest[]> {
    const res = await authFetch('/api/admin/enterprise-requests');
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load requests');
    }
    const data = await res.json();
    return (data.requests || []).map((r: any) => docToRequest(r.id, r));
}

export async function approveEnterpriseRequest(requestId: string, seatLimit: number): Promise<{ orgId: string }> {
    const res = await authFetch('/api/admin/enterprise-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', requestId, seatLimit }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Approval failed');
    }
    return res.json();
}

export async function rejectEnterpriseRequest(requestId: string, reason: string): Promise<void> {
    const res = await authFetch('/api/admin/enterprise-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', requestId, reason }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Rejection failed');
    }
}
