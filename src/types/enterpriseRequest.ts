export type EnterpriseRequestStatus = 'pending' | 'approved' | 'rejected';

export interface EnterpriseRequest {
    id: string;
    uid: string;
    email: string;
    displayName: string;
    orgName: string;
    teamSize: number;
    contactEmail: string;
    notes: string;
    status: EnterpriseRequestStatus;
    createdAt: number;
    resolvedAt?: number;
    resolvedBy?: string;
    orgId?: string;
    rejectionReason?: string;
}
