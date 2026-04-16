import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, UserPlus, Trash2, Shield, ShieldCheck, Copy, Check, RefreshCw, X, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { OrgMember, OrgInvite, OrgRole } from '@/types/organization';
import {
    getMembers,
    getInvites,
    createInvite,
    removeMember,
    updateMemberRole,
    revokeInvite,
    updateOrgSettings,
} from '@/services/organizationService';

const TeamAdmin: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { organization, isAdmin, refreshOrganization } = useWorkspace();
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [invites, setInvites] = useState<OrgInvite[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Invite form state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<OrgRole>('member');
    const [isCreatingInvite, setIsCreatingInvite] = useState(false);
    const [generatedInvite, setGeneratedInvite] = useState<{ code: string; url: string } | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const orgId = organization?.id;

    const loadData = useCallback(async () => {
        if (!orgId) return;
        setIsLoading(true);
        setError(null);
        try {
            const [m, i] = await Promise.all([getMembers(orgId), getInvites(orgId)]);
            setMembers(m);
            setInvites(i);
        } catch (err: any) {
            setError(err.message || 'Failed to load team data');
        } finally {
            setIsLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Redirect non-admins
    useEffect(() => {
        if (!isLoading && !isAdmin) {
            navigate('/settings');
        }
    }, [isLoading, isAdmin, navigate]);

    if (!organization) {
        return (
            <div className="min-h-screen p-6 flex flex-col items-center justify-center">
                <div className="text-slate-400 text-center">
                    <Users size={48} className="mx-auto mb-3 opacity-50" />
                    <p className="text-lg">No team found</p>
                    <p className="text-sm mt-1">You're not a member of any organization</p>
                    <button onClick={() => navigate('/settings')} className="mt-4 text-brand-400 hover:text-brand-300 text-sm">
                        Back to Settings
                    </button>
                </div>
            </div>
        );
    }

    const handleCreateInvite = async () => {
        if (!inviteEmail.trim() || !orgId) return;
        setIsCreatingInvite(true);
        setError(null);
        try {
            const result = await createInvite(orgId, inviteEmail.trim(), inviteRole);
            if (result.success && result.code && result.inviteUrl) {
                setGeneratedInvite({ code: result.code, url: result.inviteUrl });
                setInviteEmail('');
                await loadData();
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create invite');
        } finally {
            setIsCreatingInvite(false);
        }
    };

    const handleCreateOpenCode = async () => {
        if (!orgId) return;
        setIsCreatingInvite(true);
        setError(null);
        try {
            // Open invite: any signed-in user can redeem by typing the code
            const result = await createInvite(orgId, null, inviteRole);
            if (result.success && result.code && result.inviteUrl) {
                setGeneratedInvite({ code: result.code, url: result.inviteUrl });
                await loadData();
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create open code');
        } finally {
            setIsCreatingInvite(false);
        }
    };

    const handleCopyLink = async (url: string, code: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        } catch {
            // Fallback: select text manually
        }
    };

    const handleRemoveMember = async (uid: string, name: string) => {
        if (!orgId) return;
        if (!confirm(`Remove ${name} from the team? They will lose access to all team contacts.`)) return;
        const result = await removeMember(orgId, uid);
        if (result.success) {
            await loadData();
        } else {
            setError(result.message);
        }
    };

    const handleToggleRole = async (member: OrgMember) => {
        if (!orgId) return;
        const newRole: OrgRole = member.role === 'admin' ? 'member' : 'admin';
        const result = await updateMemberRole(orgId, member.uid, newRole);
        if (result.success) {
            await loadData();
        } else {
            setError(result.message);
        }
    };

    const handleRevokeInvite = async (code: string) => {
        if (!orgId) return;
        if (!confirm('Revoke this invite? The link will stop working.')) return;
        const result = await revokeInvite(orgId, code);
        if (result.success) {
            await loadData();
        } else {
            setError(result.message);
        }
    };

    const seatsUsed = members.length + invites.length;
    const seatsRemaining = (organization.seatLimit || 0) - seatsUsed;

    return (
        <div className="min-h-screen p-6 page-enter max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => navigate('/settings')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span className="text-sm">Settings</span>
                </button>
                <button
                    onClick={loadData}
                    className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Org info */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">{organization.name}</h1>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                        <Users size={14} />
                        {seatsUsed} / {organization.seatLimit} seats
                    </span>
                    <span className={seatsRemaining > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        {seatsRemaining > 0 ? `${seatsRemaining} available` : 'Full'}
                    </span>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-sm">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
                </div>
            )}

            {/* Team settings */}
            <div className="mb-6 p-5 glass border border-brand-800 rounded-2xl">
                <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                    <Shield size={18} className="text-brand-400" />
                    Team Settings
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                    Control how members interact with shared contacts.
                </p>

                <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={organization.claimsEnabled !== false}
                        onChange={async (e) => {
                            const result = await updateOrgSettings(organization.id, { claimsEnabled: e.target.checked });
                            if (result.success) {
                                await refreshOrganization();
                            } else {
                                setError(result.message);
                            }
                        }}
                        className="mt-0.5 w-4 h-4 rounded border-brand-700 bg-brand-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-white">Enable claims</p>
                        <p className="text-xs text-slate-500">
                            Members can "claim" contacts they'll follow up on, so teammates don't double-contact the same lead.
                            Teammates always see all contacts either way.
                        </p>
                    </div>
                </label>
            </div>

            {/* Invite section */}
            <div className="mb-8 p-5 glass border border-brand-800 rounded-2xl">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <UserPlus size={18} className="text-brand-400" />
                    Invite Member
                </h2>

                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        disabled={seatsRemaining <= 0}
                        className="flex-1 glass border border-brand-800 rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                    />
                    <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                        disabled={seatsRemaining <= 0}
                        className="glass border border-brand-800 rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                    >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button
                        onClick={handleCreateInvite}
                        disabled={isCreatingInvite || !inviteEmail.trim() || seatsRemaining <= 0}
                        className="px-5 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98] transition-all whitespace-nowrap"
                    >
                        {isCreatingInvite ? <Loader2 className="animate-spin" size={18} /> : 'Generate Link'}
                    </button>
                </div>

                {/* Open code — shareable code anyone can redeem (no email required) */}
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <div className="flex-1 h-px bg-brand-800" />
                    <span>or</span>
                    <div className="flex-1 h-px bg-brand-800" />
                </div>
                <button
                    onClick={handleCreateOpenCode}
                    disabled={isCreatingInvite || seatsRemaining <= 0}
                    className="mt-3 w-full py-2.5 glass border border-brand-800 hover:bg-white/5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                    <UserPlus size={16} className="text-brand-400" />
                    Generate open code (anyone can redeem)
                </button>
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                    Share the code in person. Still counts toward your seat limit until someone joins or you revoke it.
                </p>

                {generatedInvite && (
                    <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <div className="text-xs text-emerald-400 mb-2 font-medium">Invite link generated! Send this to the new member:</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={generatedInvite.url}
                                readOnly
                                className="flex-1 bg-brand-950/50 border border-brand-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                                onClick={() => handleCopyLink(generatedInvite.url, generatedInvite.code)}
                                className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1"
                            >
                                {copiedCode === generatedInvite.code ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Members list */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">Members ({members.length})</h2>
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand-400" size={24} /></div>
                ) : members.length === 0 ? (
                    <p className="text-slate-500 text-sm">No members yet</p>
                ) : (
                    <div className="space-y-2">
                        {members.map(member => {
                            const isOwner = member.uid === organization.ownerId;
                            const isSelf = member.uid === user?.uid;
                            return (
                                <div key={member.uid} className="p-4 glass border border-brand-800 rounded-xl flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                                        {(member.displayName || member.email).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-200 truncate">{member.displayName}</span>
                                            {isOwner && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded uppercase font-semibold">Owner</span>}
                                            {isSelf && !isOwner && <span className="text-[10px] px-1.5 py-0.5 bg-brand-500/20 text-brand-400 rounded uppercase font-semibold">You</span>}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">{member.email}</div>
                                    </div>
                                    {member.role === 'admin' ? (
                                        <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0" />
                                    ) : (
                                        <Shield size={16} className="text-slate-500 flex-shrink-0" />
                                    )}
                                    {!isOwner && !isSelf && (
                                        <>
                                            <button
                                                onClick={() => handleToggleRole(member)}
                                                className="text-xs px-2 py-1 text-slate-400 hover:text-slate-200 transition-colors"
                                                title={`Make ${member.role === 'admin' ? 'member' : 'admin'}`}
                                            >
                                                {member.role === 'admin' ? 'Demote' : 'Promote'}
                                            </button>
                                            <button
                                                onClick={() => handleRemoveMember(member.uid, member.displayName)}
                                                className="p-2 text-red-400/60 hover:text-red-400 transition-colors"
                                                title="Remove member"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pending invites */}
            {invites.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-white mb-4">Pending Invites ({invites.length})</h2>
                    <div className="space-y-2">
                        {invites.map(invite => (
                            <div key={invite.code} className="p-4 glass border border-amber-500/20 rounded-xl flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-200 truncate">{invite.email}</div>
                                    <div className="text-xs text-slate-500">{invite.role} · {new Date(invite.invitedAt).toLocaleDateString()}</div>
                                </div>
                                <button
                                    onClick={() => handleCopyLink(`${window.location.origin}/invite/${invite.code}`, invite.code)}
                                    className="px-2 py-1 text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                                >
                                    {copiedCode === invite.code ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Link</>}
                                </button>
                                <button
                                    onClick={() => handleRevokeInvite(invite.code)}
                                    className="p-2 text-red-400/60 hover:text-red-400 transition-colors"
                                    title="Revoke invite"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamAdmin;
