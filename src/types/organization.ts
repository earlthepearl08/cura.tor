export type OrgRole = 'admin' | 'member';

export interface Organization {
    id: string;
    name: string;
    ownerId: string;
    seatLimit: number;
    createdAt: number;
    updatedAt: number;
}

export interface OrgMember {
    uid: string;
    email: string;
    displayName: string;
    role: OrgRole;
    joinedAt: number;
    invitedBy: string;
}

export interface OrgInvite {
    code: string;
    email: string;
    role: OrgRole;
    invitedBy: string;
    invitedByName: string;
    invitedAt: number;
    status: 'pending' | 'accepted' | 'revoked';
}
