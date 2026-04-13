import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Loader2, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { acceptInvite } from '@/services/organizationService';

const AcceptInvite: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { user, refreshUserProfile } = useAuth();
    const { switchTo, refreshOrganization } = useWorkspace();

    const [isAccepting, setIsAccepting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; orgName?: string; message: string } | null>(null);

    useEffect(() => {
        if (!user) {
            // Save invite code so we can resume after sign-in
            sessionStorage.setItem('pending_invite_code', code || '');
            navigate('/auth');
        }
    }, [user, code, navigate]);

    const handleAccept = async () => {
        if (!code) return;
        setIsAccepting(true);
        setResult(null);
        try {
            const res = await acceptInvite(code);
            setResult({ success: res.success, orgName: res.orgName, message: res.message });
            if (res.success) {
                // Refresh user profile to get new organizationId
                await refreshUserProfile();
                await refreshOrganization();
                switchTo('team');
                // Clear pending invite
                sessionStorage.removeItem('pending_invite_code');
            }
        } catch (err: any) {
            setResult({ success: false, message: err.message || 'Failed to accept invite' });
        } finally {
            setIsAccepting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen p-6 flex flex-col items-center justify-center page-enter">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
                        <Users className="text-emerald-400" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Team Invitation</h1>
                    <p className="text-slate-400 text-sm">
                        You've been invited to join a team on Cura.tor
                    </p>
                </div>

                <div className="glass border border-brand-800 rounded-2xl p-6">
                    {!result && (
                        <>
                            <div className="text-center mb-6">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Invite Code</div>
                                <div className="text-lg font-mono font-bold text-brand-300 tracking-wider">{code}</div>
                            </div>
                            <button
                                onClick={handleAccept}
                                disabled={isAccepting}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-base font-semibold disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                {isAccepting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Joining...
                                    </>
                                ) : (
                                    <>
                                        Accept Invitation
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-slate-500 text-center mt-4">
                                Signing in as {user.email}
                            </p>
                        </>
                    )}

                    {result?.success && (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 mb-4">
                                <Check className="text-emerald-400" size={24} />
                            </div>
                            <h2 className="text-lg font-semibold text-white mb-2">Welcome to {result.orgName}!</h2>
                            <p className="text-sm text-slate-400 mb-6">You now have access to the team workspace.</p>
                            <button
                                onClick={() => navigate('/contacts')}
                                className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl text-sm font-semibold hover:scale-[1.01] active:scale-[0.98] transition-all"
                            >
                                Go to Team Contacts
                            </button>
                        </div>
                    )}

                    {result && !result.success && (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mb-4">
                                <AlertCircle className="text-red-400" size={24} />
                            </div>
                            <h2 className="text-lg font-semibold text-white mb-2">Could not accept invite</h2>
                            <p className="text-sm text-slate-400 mb-6">{result.message}</p>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full py-3 glass border border-brand-800 text-slate-300 rounded-xl text-sm font-semibold hover:border-brand-600 transition-colors"
                            >
                                Go Home
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AcceptInvite;
