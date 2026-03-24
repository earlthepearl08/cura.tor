import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Calendar, Users, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { storage } from '@/services/storage';
import { Batch } from '@/types/batch';

const BatchHistory: React.FC = () => {
    const navigate = useNavigate();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [batchStats, setBatchStats] = useState<Map<string, { total: number; verified: number }>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadBatches();
    }, []);

    const loadBatches = async () => {
        setIsLoading(true);
        try {
            const allBatches = await storage.getAllBatches();
            setBatches(allBatches);

            // Load stats for each batch
            const statsMap = new Map();
            for (const batch of allBatches) {
                const stats = await storage.getBatchStats(batch.id);
                statsMap.set(batch.id, stats);
            }
            setBatchStats(statsMap);
        } catch (error) {
            console.error("Failed to load batches:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getScanTypeLabel = (scanType: string) => {
        switch (scanType) {
            case 'multi-card': return 'Multi-Card';
            case 'log-sheet': return 'Log Sheet';
            case 'single': return 'Single Card';
            default: return scanType;
        }
    };

    const getScanTypeColor = (scanType: string) => {
        switch (scanType) {
            case 'multi-card': return 'bg-sky-500/20 border-sky-500/30 text-sky-400';
            case 'log-sheet': return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400';
            case 'single': return 'bg-violet-500/20 border-violet-500/30 text-violet-400';
            default: return 'bg-brand-500/20 border-brand-500/30 text-brand-400';
        }
    };

    const handleViewBatch = (batchId: string) => {
        // Navigate to contacts page with this batch selected
        navigate(`/contacts?batch=${batchId}`);
    };

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between glass sticky top-0 z-10 p-4 border-b border-brand-800">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Batch History</h1>
                <div className="w-10" />
            </div>

            <div className="flex-1 p-4 space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-400"></div>
                    </div>
                ) : batches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                        <div className="w-16 h-16 bg-brand-800/50 rounded-2xl flex items-center justify-center mb-4">
                            <Layers className="w-8 h-8 text-brand-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">No Batches Yet</h2>
                        <p className="text-sm text-slate-500 max-w-xs">
                            When you scan business cards using Multi-Card or Log Sheet scan, they'll be grouped into batches here.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="text-center py-4">
                            <p className="text-sm text-brand-400">
                                <span className="font-bold text-brand-300">{batches.length}</span> scan batch{batches.length !== 1 ? 'es' : ''}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {batches.map((batch) => {
                                const stats = batchStats.get(batch.id) || { total: 0, verified: 0 };
                                return (
                                    <div
                                        key={batch.id}
                                        onClick={() => handleViewBatch(batch.id)}
                                        className="glass border border-brand-800 rounded-2xl overflow-hidden hover:border-brand-500/30 transition-all cursor-pointer active:scale-[0.98]"
                                    >
                                        {/* Thumbnail */}
                                        {batch.thumbnailData && (
                                            <div className="w-full h-32 bg-brand-900 border-b border-brand-800">
                                                <img
                                                    src={batch.thumbnailData}
                                                    alt={batch.name}
                                                    className="w-full h-full object-cover opacity-60"
                                                />
                                            </div>
                                        )}

                                        <div className="p-4">
                                            {/* Header */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-slate-100 truncate mb-1">
                                                        {batch.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Calendar size={12} className="text-brand-500 flex-shrink-0" />
                                                        <span className="text-slate-400">
                                                            {new Date(batch.scannedAt).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric',
                                                                hour: 'numeric',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getScanTypeColor(batch.scanType)}`}>
                                                    {getScanTypeLabel(batch.scanType)}
                                                </span>
                                            </div>

                                            {/* Stats */}
                                            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-brand-800">
                                                <div className="text-center">
                                                    <div className="flex items-center justify-center gap-1 mb-1">
                                                        <Users size={14} className="text-brand-500" />
                                                    </div>
                                                    <p className="text-lg font-bold text-brand-300">{stats.total}</p>
                                                    <p className="text-[10px] text-slate-500">Contacts</p>
                                                </div>
                                                <div className="text-center border-l border-brand-800">
                                                    <div className="flex items-center justify-center gap-1 mb-1">
                                                        <CheckCircle size={14} className="text-emerald-500" />
                                                    </div>
                                                    <p className="text-lg font-bold text-emerald-400">{stats.verified}</p>
                                                    <p className="text-[10px] text-slate-500">Verified</p>
                                                </div>
                                                <div className="text-center border-l border-brand-800">
                                                    <div className="flex items-center justify-center gap-1 mb-1">
                                                        <AlertCircle size={14} className="text-amber-500" />
                                                    </div>
                                                    <p className="text-lg font-bold text-amber-400">{batch.errorCount}</p>
                                                    <p className="text-[10px] text-slate-500">Errors</p>
                                                </div>
                                            </div>

                                            {/* Action hint */}
                                            <div className="mt-3 pt-3 border-t border-brand-800">
                                                <p className="text-xs text-center text-brand-500">
                                                    Tap to view contacts from this batch
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BatchHistory;
