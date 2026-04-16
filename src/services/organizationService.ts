import { doc, getDoc, getDocs, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Organization, OrgMember, OrgInvite, OrgRole } from '@/types/organization';
import { authFetch } from '@/utils/authFetch';

/** Convert Firestore doc data to Organization */
function docToOrganization(data: any, id: string): Organization {
    return {
        id,
        name: data.name || '',
        ownerId: data.ownerId || '',
        seatLimit: data.seatLimit || 5,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : (data.updatedAt || Date.now()),
    };
}

/** Convert Firestore doc data to OrgMember */
function docToMember(data: any): OrgMember {
    return {
        uid: data.uid || '',
        email: data.email || '',
        displayName: data.displayName || '',
        role: (data.role as OrgRole) || 'member',
        joinedAt: data.joinedAt instanceof Timestamp ? data.joinedAt.toMillis() : (data.joinedAt || Date.now()),
        invitedBy: data.invitedBy || '',
    };
}

/** Convert Firestore doc data to OrgInvite */
function docToInvite(data: any, id: string): OrgInvite {
    return {
        code: id,
        email: data.email || '',
        role: (data.role as OrgRole) || 'member',
        invitedBy: data.invitedBy || '',
        invitedByName: data.invitedByName || '',
        invitedAt: data.invitedAt instanceof Timestamp ? data.invitedAt.toMillis() : (data.invitedAt || Date.now()),
        status: data.status || 'pending',
    };
}

/** Fetch organization metadata */
export async function getOrganization(orgId: string): Promise<Organization | null> {
    const snap = await getDoc(doc(db, 'organizations', orgId));
    if (!snap.exists()) return null;
    return docToOrganization(snap.data(), snap.id);
}

/** List all members of an organization */
export async function getMembers(orgId: string): Promise<OrgMember[]> {
    const snap = await getDocs(collection(db, 'organizations', orgId, 'members'));
    return snap.docs
        .map(d => docToMember(d.data()))
        .sort((a, b) => a.joinedAt - b.joinedAt);
}

/** List pending invites for an organization */
export async function getInvites(orgId: string): Promise<OrgInvite[]> {
    const snap = await getDocs(collection(db, 'organizations', orgId, 'invites'));
    return snap.docs
        .map(d => docToInvite(d.data(), d.id))
        .filter(i => i.status === 'pending')
        .sort((a, b) => b.invitedAt - a.invitedAt);
}

/** Generate a new invite code (admin only). Pass null/empty email for an "open" invite
 *  that any signed-in user can redeem without an email match. */
export async function createInvite(
    orgId: string,
    email: string | null,
    role: OrgRole
): Promise<{ success: boolean; code?: string; inviteUrl?: string; isOpen?: boolean; message: string }> {
    try {
        const res = await authFetch('/api/org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'invite', orgId, email: email || '', role }),
        });
        const data = await res.json();
        if (!res.ok) {
            return { success: false, message: data.error || 'Failed to create invite' };
        }
        return { success: true, code: data.code, inviteUrl: data.inviteUrl, isOpen: data.isOpen, message: 'Invite created' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to create invite' };
    }
}

/** Accept an invite by code */
export async function acceptInvite(
    code: string
): Promise<{ success: boolean; orgId?: string; orgName?: string; message: string }> {
    try {
        const res = await authFetch('/api/org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept-invite', code }),
        });
        const data = await res.json();
        if (!res.ok) {
            return { success: false, message: data.error || 'Failed to accept invite' };
        }
        return { success: true, orgId: data.orgId, orgName: data.orgName, message: 'Joined team' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to accept invite' };
    }
}

/** Remove a member from the organization (admin only) */
export async function removeMember(
    orgId: string,
    uid: string
): Promise<{ success: boolean; message: string }> {
    try {
        const res = await authFetch('/api/org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove-member', orgId, uid }),
        });
        const data = await res.json();
        if (!res.ok) {
            return { success: false, message: data.error || 'Failed to remove member' };
        }
        return { success: true, message: 'Member removed' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to remove member' };
    }
}

/** Update a member's role (admin only) */
export async function updateMemberRole(
    orgId: string,
    uid: string,
    role: OrgRole
): Promise<{ success: boolean; message: string }> {
    try {
        const res = await authFetch('/api/org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update-role', orgId, uid, role }),
        });
        const data = await res.json();
        if (!res.ok) {
            return { success: false, message: data.error || 'Failed to update role' };
        }
        return { success: true, message: 'Role updated' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to update role' };
    }
}

/** Update organization settings (admin only) */
export async function updateOrgSettings(
    orgId: string,
    settings: { claimsEnabled?: boolean }
): Promise<{ success: boolean; message: string }> {
    try {
        const res = await authFetch('/api/org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update-settings', orgId, ...settings }),
        });
        const data = await res.json();
        if (!res.ok) {
            return { success: false, message: data.error || 'Failed to update settings' };
        }
        return { success: true, message: 'Settings updated' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to update settings' };
    }
}

/** Revoke a pending invite (admin only) */
export async function revokeInvite(
    orgId: string,
    code: string
): Promise<{ success: boolean; message: string }> {
    try {
        const res = await authFetch('/api/org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'revoke-invite', orgId, code }),
        });
        const data = await res.json();
        if (!res.ok) {
            return { success: false, message: data.error || 'Failed to revoke invite' };
        }
        return { success: true, message: 'Invite revoked' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to revoke invite' };
    }
}
