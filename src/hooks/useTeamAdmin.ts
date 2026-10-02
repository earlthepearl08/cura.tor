import { useState, useEffect } from 'react';
import { OrgMember, OrgInvite } from '@/types/organization';
import { subscribeMembers, subscribeInvites } from '@/services/organizationService';

export interface UseTeamAdminResult {
    members: OrgMember[];
    invites: OrgInvite[];
    isLoading: boolean;
    error: string | null;
    isLive: boolean;
}

/**
 * Live Firestore listeners for org members + pending invites (Team Admin page).
 */
export function useTeamAdmin(orgId: string | undefined): UseTeamAdminResult {
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [invites, setInvites] = useState<OrgInvite[]>([]);
    const [isLoading, setIsLoading] = useState(!!orgId);
    const [error, setError] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        if (!orgId) {
            setMembers([]);
            setInvites([]);
            setIsLoading(false);
            setIsLive(false);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        let membersReady = false;
        let invitesReady = false;

        const maybeReady = () => {
            if (membersReady && invitesReady) {
                setIsLoading(false);
                setIsLive(true);
            }
        };

        const unsubMembers = subscribeMembers(
            orgId,
            (data) => {
                setMembers(data);
                membersReady = true;
                maybeReady();
            },
            (err) => {
                setError(err.message || 'Failed to sync members');
                setIsLoading(false);
                setIsLive(false);
            },
        );

        const unsubInvites = subscribeInvites(
            orgId,
            (data) => {
                setInvites(data);
                invitesReady = true;
                maybeReady();
            },
            (err) => {
                setError(err.message || 'Failed to sync invites');
                setIsLoading(false);
                setIsLive(false);
            },
        );

        return () => {
            unsubMembers();
            unsubInvites();
            setIsLive(false);
        };
    }, [orgId]);

    return { members, invites, isLoading, error, isLive };
}
